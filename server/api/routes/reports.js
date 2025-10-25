import { Router } from 'express';
import { subDays } from 'date-fns';
import { z } from 'zod';
import { db } from '../../infrastructure/supabase.js';

const router = Router();

const reportSchema = z.object({
    range: z.string().optional(),
});

function parseRange(range = '30d') {
    const match = /^(\d+)([dw])$/.exec(range);
    if (!match) {
        const error = new Error('Неверный формат диапазона');
        error.status = 422;
        error.code = 'range_invalid';
        throw error;
    }

    const value = Number(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'd':
            return { startDate: subDays(new Date(), value), label: `${value}d` };
        case 'w':
            return { startDate: subDays(new Date(), value * 7), label: `${value}w` };
        default:
            throw new Error('unsupported_range');
    }
}

router.get('/:slug', async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { range } = reportSchema.parse(req.query);
        const { startDate, label } = parseRange(range);

        switch (slug) {
            case 'volume_trend': {
                const trend = await db.getVolumeTrend(req.profileId, startDate);

                await db.logEvent(req.profileId, 'report_requested', 'info', {
                    slug,
                    range: label,
                    trace_id: req.traceId,
                });

                return res.json({
                    report: slug,
                    range: label,
                    chart: trend.chart,
                    summary: trend.summary,
                    generated_at: new Date().toISOString(),
                });
            }
            case 'rpe_distribution': {
                const distribution = await db.getRpeDistribution(req.profileId, startDate);

                await db.logEvent(req.profileId, 'report_requested', 'info', {
                    slug,
                    range: label,
                    trace_id: req.traceId,
                });

                return res.json({
                    report: slug,
                    range: label,
                    chart: distribution.chart,
                    summary: distribution.summary,
                    generated_at: new Date().toISOString(),
                });
            }
            default:
                return res.status(404).json({ error: 'report_not_available', message: 'Отчёт недоступен' });
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(422).json({ error: 'validation_failed', message: 'Некорректные параметры запроса', issues: error.issues });
        }

        next(error);
    }
});

export default router;
