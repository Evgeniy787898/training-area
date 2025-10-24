import React, { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';

const ProgressView = () => {
    const { profileSummary } = useAppContext();
    const [state, setState] = useState({ loading: true, error: null, volume: null, rpe: null, achievements: [] });

    const loadAnalytics = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
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
            });
        } catch (error) {
            setState({ loading: false, error, volume: null, rpe: null, achievements: [] });
        }
    }, []);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    const renderVolumeChart = () => {
        const data = state.volume?.chart?.map(item => ({
            ...item,
            label: format(parseISO(item.date), 'd MMM', { locale: ru }),
        })) || [];

        if (!data.length) {
            return <p className="text-muted">Недостаточно данных. Отмечай тренировки, чтобы появился график.</p>;
        }

        return (
            <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" interval={Math.max(0, Math.floor(data.length / 6))} />
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
                    <Tooltip formatter={(value) => [`${value} тренировок`, '']}/>
                    <Bar dataKey="value" fill="var(--accent-color)" radius={[6, 6, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        );
    };

    if (state.loading) {
        return (
            <div className="view progress-view">
                <h2>📊 Твой прогресс</h2>
                <SkeletonCard lines={4} />
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="view progress-view">
                <h2>📊 Твой прогресс</h2>
                <ErrorState
                    message={state.error.message}
                    actionLabel="Попробовать ещё"
                    onRetry={loadAnalytics}
                />
            </div>
        );
    }

    const adherence = profileSummary?.adherence?.adherence_percent || 0;
    const averageVolume = state.volume?.summary?.average_volume || 0;
    const heavyShare = state.rpe?.summary?.heavy_share || 0;

    return (
        <div className="view progress-view">
            <h2>📊 Твой прогресс</h2>

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
                        <div className="stat-label">Тяжёлых трен.</div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3>📈 Объём за 30 дней</h3>
                    <span className="badge">{state.volume?.summary?.period_sessions || 0} тренировок</span>
                </div>
                {renderVolumeChart()}
            </div>

            <div className="card">
                <div className="card-header">
                    <h3>💥 Распределение RPE</h3>
                    <span className="badge">30 дней</span>
                </div>
                {renderRpeChart()}
            </div>

            <div className="card">
                <h3>🏆 Достижения</h3>
                {state.achievements.length === 0 ? (
                    <p className="text-muted">Пока нет достижений — выполненные тренировки откроют награды.</p>
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

export default ProgressView;

