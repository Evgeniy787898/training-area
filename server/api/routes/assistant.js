import { Router } from 'express';
import { z } from 'zod';
import conversationService from '../../services/conversation.js';
import internalAssistantEngine from '../../services/internalAssistantEngine.js';
import { loadAssistantHistory, persistAssistantTurn } from '../../services/history.js';
import { db } from '../../infrastructure/supabase.js';

const router = Router();

function shortenText(text, limit = 120) {
    if (!text) {
        return '';
    }
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= limit) {
        return normalized;
    }
    return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

const replySchema = z.object({
    message: z.string().min(1, 'Сообщение не может быть пустым'),
    mode: z.enum(['chat', 'command']).default('chat'),
    persist: z.boolean().optional().default(true),
});

const noteCreateSchema = z.object({
    content: z.string().min(1, 'Текст заметки обязателен'),
    title: z.string().trim().optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
});

router.post('/reply', async (req, res, next) => {
    try {
        const payload = replySchema.parse(req.body || {});
        const historyState = await loadAssistantHistory(req.profileId);
        const history = historyState.messages;

        const interpretation = internalAssistantEngine.interpretCommand({
            profile: req.profile,
            message: payload.message,
            history,
        });

        const reply = await conversationService.generateReply({
            profile: req.profile,
            message: payload.message,
            history,
            mode: payload.mode,
        });

        if (payload.persist) {
            await persistAssistantTurn({
                profileId: req.profileId,
                previousState: historyState,
                userMessage: payload.message,
                assistantMessage: reply,
                intent: interpretation.intent,
                mode: payload.mode,
            });
        }

        res.json({
            reply,
            intent: interpretation.intent,
            confidence: interpretation.confidence,
            candidates: interpretation.candidateIntents,
            saved: Boolean(payload.persist),
        });
    } catch (error) {
        next(error);
    }
});

router.get('/notes', async (req, res, next) => {
    const limit = Number.parseInt(req.query.limit, 10);
    const cappedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;

    try {
        const notes = await db.getAssistantNotes(req.profileId, { limit: cappedLimit });
        res.json({ notes });
    } catch (error) {
        next(error);
    }
});

router.post('/notes', async (req, res, next) => {
    try {
        const payload = noteCreateSchema.parse(req.body || {});
        const note = await db.saveAssistantNote(req.profileId, {
            title: payload.title,
            content: payload.content,
            tags: payload.tags || [],
            metadata: {
                source: 'api',
            },
        });

        try {
            await db.mergeDialogState(req.profileId, 'ai_chat_history', (state = {}) => ({
                ...state,
                notes_saved: (state?.notes_saved || 0) + 1,
                last_saved_note_id: note.id,
                last_saved_note_at: note.created_at,
                last_note_preview: shortenText(note.content),
            }));
        } catch (error) {
            console.error('Failed to merge dialog state after API note save:', error);
        }

        await db.logEvent(req.profileId, 'assistant_note_saved', 'info', {
            note_id: note.id,
            source: 'api',
        });

        res.status(201).json({ note });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(422).json({
                error: 'validation_failed',
                message: 'Некорректные данные',
                issues: error.issues,
            });
        }
        next(error);
    }
});

export default router;
