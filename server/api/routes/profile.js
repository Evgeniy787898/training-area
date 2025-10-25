import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../infrastructure/supabase.js';
import config from '../../config/env.js';
import internalAssistantEngine from '../../services/internalAssistantEngine.js';

const router = Router();

const ENGINE_ID = config.assistant.engineId || 'internal';
const allowedProviders = [ENGINE_ID];

const preferencesSchema = z.object({
    notification_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    timezone: z.string().optional(),
    notifications_paused: z.boolean().optional(),
    ai_provider: z.string()
        .trim()
        .toLowerCase()
        .refine(value => !value || allowedProviders.includes(value), 'Недоступный движок ассистента')
        .optional(),
});

router.get('/summary', async (req, res, next) => {
    try {
        const profile = req.profile;
        const adherence = await db.getAdherenceSummary(req.profileId);
        const latestMetrics = await db.getLatestMetrics(req.profileId);
        const providerCatalog = internalAssistantEngine.getEngineCatalog({
            successThreshold: config.assistant.successThreshold,
            slumpThreshold: config.assistant.slumpThreshold,
        });
        const resolvedProvider = internalAssistantEngine.resolveEngine({ profile });

        res.json({
            profile: {
                id: profile.id,
                notification_time: profile.notification_time,
                timezone: profile.timezone,
                preferences: profile.preferences,
                notifications_paused: profile.notifications_paused,
            },
            adherence,
            metrics: latestMetrics,
            ai: {
                preferred_provider: profile.preferences?.ai_provider || null,
                selected_provider: resolvedProvider,
                providers: providerCatalog,
            },
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/preferences', async (req, res, next) => {
    try {
        const payload = preferencesSchema.parse(req.body);

        const updates = {};
        let preferencesUpdates = null;
        let hasChanges = false;

        if (payload.notification_time) {
            updates.notification_time = `${payload.notification_time}:00`;
            hasChanges = true;
        }

        if (payload.timezone) {
            updates.timezone = payload.timezone;
            hasChanges = true;
        }

        if (payload.notifications_paused !== undefined) {
            updates.notifications_paused = payload.notifications_paused;
            hasChanges = true;
        }

        if (payload.ai_provider !== undefined) {
            const currentPreferences = req.profile.preferences || {};
            const currentProvider = currentPreferences.ai_provider || null;
            const nextProvider = payload.ai_provider || null;

            if (nextProvider !== currentProvider) {
                preferencesUpdates = { ...currentPreferences };
                if (nextProvider) {
                    preferencesUpdates.ai_provider = nextProvider;
                } else {
                    delete preferencesUpdates.ai_provider;
                }
                hasChanges = true;
            }
        }

        if (!hasChanges) {
            return res.status(400).json({ error: 'invalid_payload', message: 'Нет данных для обновления' });
        }

        if (preferencesUpdates) {
            updates.preferences = preferencesUpdates;
        }

        const updatedProfile = await db.updateProfile(req.profileId, updates);

        await db.logEvent(req.profileId, 'preferences_updated', 'info', {
            updates,
            trace_id: req.traceId,
        });

        res.json({ success: true, profile: updatedProfile, effective_at: new Date().toISOString() });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(422).json({ error: 'validation_failed', message: 'Некорректные данные', issues: error.issues });
        }

        next(error);
    }
});

export default router;
