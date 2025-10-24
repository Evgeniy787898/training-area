import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../infrastructure/supabase.js';

const router = Router();

const preferencesSchema = z.object({
    notification_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    timezone: z.string().optional(),
    notifications_paused: z.boolean().optional(),
});

router.get('/summary', async (req, res, next) => {
    try {
        const profile = req.profile;
        const adherence = await db.getAdherenceSummary(req.profileId);
        const latestMetrics = await db.getLatestMetrics(req.profileId);

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
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/preferences', async (req, res, next) => {
    try {
        const payload = preferencesSchema.parse(req.body);

        const updates = {};

        if (payload.notification_time) {
            updates.notification_time = `${payload.notification_time}:00`;
        }

        if (payload.timezone) {
            updates.timezone = payload.timezone;
        }

        if (payload.notifications_paused !== undefined) {
            updates.notifications_paused = payload.notifications_paused;
        }

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'invalid_payload', message: 'Нет данных для обновления' });
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
