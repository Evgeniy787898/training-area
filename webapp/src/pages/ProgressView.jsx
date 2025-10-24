import React from 'react';

const ProgressView = () => {
    return (
        <div className="view progress-view">
            <h2>📊 Твой прогресс</h2>

            <div className="stats-summary">
                <div className="stat-card">
                    <div className="stat-icon">🔥</div>
                    <div className="stat-content">
                        <div className="stat-value">80%</div>
                        <div className="stat-label">Регулярность</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">💪</div>
                    <div className="stat-content">
                        <div className="stat-value">7.2</div>
                        <div className="stat-label">Средний RPE</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📈</div>
                    <div className="stat-content">
                        <div className="stat-value">+15%</div>
                        <div className="stat-label">Прогресс</div>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3>🏆 Достижения</h3>
                <div className="achievements">
                    <div className="achievement-badge">
                        <span className="achievement-icon">✅</span>
                        <span className="achievement-name">Первая тренировка</span>
                    </div>
                    <div className="achievement-badge">
                        <span className="achievement-icon">🔥</span>
                        <span className="achievement-name">Серия 7 дней</span>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3>📈 Графики и детальная аналитика</h3>
                <p className="text-muted">🚧 Раздел в разработке</p>
                <p>Скоро здесь будут графики прогресса по упражнениям, динамика нагрузки и другая аналитика.</p>
            </div>
        </div>
    );
};

export default ProgressView;

