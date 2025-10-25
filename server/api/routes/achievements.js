import { Router } from 'express';
import { db } from '../../infrastructure/supabase.js';

const router = Router();

router.get('/', async (req, res, next) => {
    try {
        const achievements = await db.getAchievements(req.profileId, { limit: 10 });
        await db.logEvent(req.profileId, 'achievements_viewed', 'info', {
            count: achievements.length,
            trace_id: req.traceId,
        });
        res.json({ achievements });
    } catch (error) {
        next(error);
    }
});

export default router;
