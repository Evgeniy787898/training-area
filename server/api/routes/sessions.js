import { Router } from 'express';
import { addDays, format, isValid, parseISO, startOfWeek } from 'date-fns';
import { z } from 'zod';
import { db } from '../../infrastructure/supabase.js';

const router = Router();

const updateSessionSchema = z.object({
    status: z.enum(['planned', 'in_progress', 'done', 'skipped', 'rescheduled']).optional(),
    completed_at: z.string().datetime({ offset: true }).optional(),
    exercises: z.array(z.object({
        exercise_key: z.string(),
        target: z.object({
            sets: z.number().int().positive().optional(),
            reps: z.number().int().positive().optional(),
            duration_seconds: z.number().int().positive().optional(),
        }).partial().optional(),
        actual: z.object({
            sets: z.number().int().nonnegative().optional(),
            reps: z.number().int().nonnegative().optional(),
            duration_seconds: z.number().int().nonnegative().optional(),
        }).partial().optional(),
        rpe: z.number().min(1).max(10).optional(),
        notes: z.string().max(500).optional(),
        state: z.enum(['planned', 'in_progress', 'done', 'skipped']).optional(),
    })).optional(),
    rpe: z.number().min(1).max(10).optional(),
    notes: z.string().max(1000).optional(),
});

function ensureSessionBelongsToProfile(session, profileId) {
    if (session.profile_id !== profileId) {
        const error = new Error('Сессия принадлежит другому профилю');
        error.status = 403;
        error.code = 'forbidden';
        throw error;
    }
}

router.get('/today', async (req, res, next) => {
    try {
        const targetDate = req.query.date ? parseISO(req.query.date) : new Date();
        if (!isValid(targetDate)) {
            return res.status(400).json({ error: 'invalid_date', message: 'Некорректная дата запроса' });
        }

        const dateKey = format(targetDate, 'yyyy-MM-dd');

        const sessions = await db.getTrainingSessions(req.profileId, {
            startDate: dateKey,
            endDate: dateKey,
        });

        if (!sessions?.length) {
            const weekPlan = await db.getOrCreateFallbackWeekPlan(req.profile, req.profileId, targetDate);
            const session = weekPlan.sessions.find(item => item.date === dateKey) || null;

            await db.logEvent(req.profileId, 'plan_viewed', 'info', {
                scope: 'today',
                source: 'fallback',
                trace_id: req.traceId,
            });

            return res.json({ session, source: 'fallback' });
        }

        await db.logEvent(req.profileId, 'plan_viewed', 'info', {
            scope: 'today',
            source: 'database',
            date: dateKey,
            trace_id: req.traceId,
        });

        return res.json({ session: sessions[0], source: 'database' });
    } catch (error) {
        next(error);
    }
});

router.get('/week', async (req, res, next) => {
    try {
        const referenceDate = req.query.date ? new Date(req.query.date) : new Date();
        const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);

        const sessions = await db.getTrainingSessions(req.profileId, {
            startDate: format(weekStart, 'yyyy-MM-dd'),
            endDate: format(weekEnd, 'yyyy-MM-dd'),
        });

        if (!sessions?.length) {
            const plan = await db.getOrCreateFallbackWeekPlan(req.profile, req.profileId, referenceDate);

            await db.logEvent(req.profileId, 'plan_viewed', 'info', {
                scope: 'week',
                source: 'fallback',
                week_start: format(weekStart, 'yyyy-MM-dd'),
                trace_id: req.traceId,
            });

            return res.json({
                week_start: format(weekStart, 'yyyy-MM-dd'),
                week_end: format(weekEnd, 'yyyy-MM-dd'),
                sessions: plan.sessions,
                source: 'fallback',
            });
        }

        await db.logEvent(req.profileId, 'plan_viewed', 'info', {
            scope: 'week',
            source: 'database',
            week_start: format(weekStart, 'yyyy-MM-dd'),
            trace_id: req.traceId,
        });

        return res.json({
            week_start: format(weekStart, 'yyyy-MM-dd'),
            week_end: format(weekEnd, 'yyyy-MM-dd'),
            sessions,
            source: 'database',
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const session = await db.getTrainingSession(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'session_not_found', message: 'Тренировка не найдена' });
        }

        ensureSessionBelongsToProfile(session, req.profileId);

        res.json({ session });
    } catch (error) {
        next(error);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const session = await db.getTrainingSession(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'session_not_found', message: 'Тренировка не найдена' });
        }

        ensureSessionBelongsToProfile(session, req.profileId);

        const payload = updateSessionSchema.parse(req.body);

        const updates = {
            ...payload,
            status: payload.status || 'done',
            exercises: payload.exercises || session.exercises,
            rpe: payload.rpe ?? session.rpe,
            notes: payload.notes ?? session.notes,
            completed_at: payload.completed_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const updatedSession = await db.updateTrainingSession(session.id, updates);

        await db.logEvent(req.profileId, 'session_marked_done', 'info', {
            session_id: session.id,
            status: updates.status,
            trace_id: req.traceId,
        });

        const decision = await db.calculateProgressionDecision(req.profileId, updatedSession);

        res.json({ success: true, session: updatedSession, decision: decision.decision, next_steps: decision.next_steps });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(422).json({
                error: 'validation_failed',
                message: 'Некорректный формат данных',
                issues: error.issues,
            });
        }

        next(error);
    }
});

export default router;
