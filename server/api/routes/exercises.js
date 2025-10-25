import { Router } from 'express';
import { db } from '../../infrastructure/supabase.js';
import { buildProgressionCatalog } from '../../services/staticPlan.js';

const router = Router();

router.get('/catalog', async (req, res, next) => {
    try {
        const catalog = buildProgressionCatalog();
        let latest = [];

        try {
            latest = await db.getExerciseProgressOverview(req.profileId, { limit: 40 });
        } catch (error) {
            console.warn('Failed to load exercise overview:', error.message);
        }

        const latestByKey = new Map(latest.map(item => [item.exercise_key, item]));

        const items = catalog.map(item => {
            const entry = latestByKey.get(item.key);
            return {
                ...item,
                latest_progress: entry ? {
                    level: entry.level_result || entry.level_target || null,
                    decision: entry.decision || null,
                    session_date: entry.training_sessions?.date || null,
                    updated_at: entry.created_at,
                } : null,
            };
        });

        res.json({
            items,
            generated_at: new Date().toISOString(),
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:exerciseKey/history', async (req, res, next) => {
    try {
        const { exerciseKey } = req.params;
        const history = await db.getExerciseProgressHistory(req.profileId, exerciseKey, 20);

        res.json({
            exercise: exerciseKey,
            items: history.map(record => ({
                level_target: record.level_target,
                level_result: record.level_result,
                volume_target: record.volume_target,
                volume_actual: record.volume_actual,
                rpe: record.rpe,
                decision: record.decision,
                notes: record.notes,
                session_date: record.training_sessions?.date || null,
                recorded_at: record.created_at,
            })),
        });
    } catch (error) {
        next(error);
    }
});

export default router;
