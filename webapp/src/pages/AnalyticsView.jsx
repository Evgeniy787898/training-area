import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';
import { DEMO_ANALYTICS, DEMO_REPORT_HINT } from '../services/demoData';

const AnalyticsView = () => {
    const { profileSummary, showToast, demoMode } = useAppContext();
    const [state, setState] = useState({ loading: true, error: null, volume: null, rpe: null, achievements: [], fallback: false });
    const [selectedPoint, setSelectedPoint] = useState(0);

    const loadAnalytics = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null, fallback: false }));
        try {
            const [volume, rpe, achievements] = await Promise.all([
                apiClient.getReport('volume_trend', { range: '30d' }),
                apiClient.getReport('rpe_distribution', { range: '30d' }),
                apiClient.getAchievements(),
            ]);

            setState({
                loading: false,
                error: null,
                volume: volume.data,
                rpe: rpe.data,
                achievements: achievements.data.achievements || [],
                fallback: false,
            });
        } catch (error) {
            setState({
                loading: false,
                error: null,
                volume: DEMO_ANALYTICS.volume,
                rpe: DEMO_ANALYTICS.rpe,
                achievements: DEMO_ANALYTICS.achievements,
                fallback: true,
            });
            showToast?.({
                title: 'Демо аналитика',
                message: 'Показываю пример статистики, пока не удалось получить данные с сервера.',
                type: 'warning',
                traceId: error.traceId,
            });
        }
    }, [showToast]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    useEffect(() => {
        if (state.volume?.chart?.length) {
            setSelectedPoint(state.volume.chart.length - 1);
        }
    }, [state.volume]);

    const adherence = profileSummary?.adherence?.adherence_percent || 0;
    const averageVolume = state.volume?.summary?.average_volume || 0;
    const heavyShare = state.rpe?.summary?.heavy_share || 0;

    const volumeSeries = useMemo(() => {
        return (state.volume?.chart || []).map(item => ({
            ...item,
            label: format(parseISO(item.date), 'd MMM', { locale: ru }),
        }));
    }, [state.volume]);

    const selectedSession = volumeSeries[selectedPoint] || null;

    const renderVolumeChart = () => {
        if (!volumeSeries.length) {
            return <p className="text-muted">Недостаточно данных. Отмечай тренировки, чтобы появился график.</p>;
        }

        return (
            <ResponsiveContainer width="100%" height={240}>
                <LineChart data={volumeSeries} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" interval={Math.max(0, Math.floor(volumeSeries.length / 6))} />
                    <YAxis stroke="var(--text-secondary)" allowDecimals={false} />
                    <Tooltip formatter={(value) => [`Объём: ${value}`, '']} />
                    <Line type="monotone" dataKey="volume" stroke="var(--primary-color)" strokeWidth={3} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        );
    };

    const renderRpeChart = () => {
        const data = state.rpe?.chart || [];

        if (!data.length) {
            return <p className="text-muted">RPE пока не собраны — отправь отчёт о тренировке.</p>;
        }

        return (
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" interval={0} angle={-12} textAnchor="end" height={60} />
                    <YAxis stroke="var(--text-secondary)" allowDecimals={false} />
                    <Tooltip formatter={(value) => [`${value} тренировок`, '']} />
                    <Bar dataKey="value" fill="var(--accent-color)" radius={[6, 6, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        );
    };

    const handleOpenReport = () => {
        showToast?.({
            title: 'Отчёт по тренировке',
            message: 'Отметь тренировку в разделе «Сегодня», чтобы построить полноценный отчёт и синхронизировать с Supabase.',
            type: 'info',
        });
    };

    if (state.loading) {
        return (
            <div className="view analytics-view">
                <div className="analytics-header">
                    <h2>📊 Аналитика и отчёты</h2>
                </div>
                <SkeletonCard lines={5} />
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="view analytics-view">
                <div className="analytics-header">
                    <h2>📊 Аналитика и отчёты</h2>
                </div>
                <ErrorState message={state.error.message} actionLabel="Обновить" onRetry={loadAnalytics} />
            </div>
        );
    }

    return (
        <div className="view analytics-view">
            <div className="analytics-header">
                <h2>📊 Аналитика и отчёты</h2>
                {(state.fallback || demoMode) && (
                    <span className="demo-chip">пример данных</span>
                )}
            </div>

            <div className="stats-summary">
                <div className="stat-card">
                    <div className="stat-icon">🔥</div>
                    <div className="stat-content">
                        <div className="stat-value">{adherence}%</div>
                        <div className="stat-label">Регулярность</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">💪</div>
                    <div className="stat-content">
                        <div className="stat-value">{averageVolume}</div>
                        <div className="stat-label">Средний объём</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">📈</div>
                    <div className="stat-content">
                        <div className="stat-value">{heavyShare}%</div>
                        <div className="stat-label">Тяжёлых сессий</div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <div>
                        <h3>📈 Объём за 30 дней</h3>
                        <p className="card-subtitle">Следи, как растёт твой объём тренировок</p>
                    </div>
                    <span className="badge">{state.volume?.summary?.period_sessions || 0} трен.</span>
                </div>
                {renderVolumeChart()}
                {volumeSeries.length > 0 && (
                    <div className="timeline-slider">
                        <input
                            type="range"
                            min="0"
                            max={volumeSeries.length - 1}
                            value={selectedPoint}
                            onChange={event => setSelectedPoint(Number(event.target.value))}
                        />
                        {selectedSession && (
                            <div className="timeline-details">
                                <span>{selectedSession.label}</span>
                                <span>Объём: {selectedSession.volume}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="card">
                <div className="card-header">
                    <div>
                        <h3>💥 Распределение RPE</h3>
                        <p className="card-subtitle">Балансируй лёгкие и тяжёлые тренировки</p>
                    </div>
                    <span className="badge">30 дней</span>
                </div>
                {renderRpeChart()}
            </div>

            <div className="card report-card">
                <div className="card-header">
                    <div>
                        <h3>📝 Отчёт по последней сессии</h3>
                        <p className="card-subtitle">Фиксируй результат после тренировки — графики обновятся автоматически.</p>
                    </div>
                    <button className="btn btn-secondary" onClick={handleOpenReport}>
                        Открыть отчёт
                    </button>
                </div>
                <pre className="report-hint">{DEMO_REPORT_HINT}</pre>
            </div>

            <div className="card achievements-card">
                <div className="card-header">
                    <div>
                        <h3>🏆 Достижения</h3>
                        <p className="card-subtitle">Награды помогают отслеживать стабильность</p>
                    </div>
                </div>
                {state.achievements.length === 0 ? (
                    <p className="text-muted">Выполняй тренировки, и я буду отмечать ключевые достижения.</p>
                ) : (
                    <div className="achievements">
                        {state.achievements.map(item => (
                            <div key={item.id} className="achievement-badge">
                                <span className="achievement-icon">🏅</span>
                                <div>
                                    <span className="achievement-name">{item.title}</span>
                                    {item.description && (
                                        <span className="achievement-description">{item.description}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsView;
