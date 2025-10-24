import React from 'react';

const TodayView = () => {
    return (
        <div className="view today-view">
            <h2>📅 План на сегодня</h2>

            <div className="card">
                <div className="card-header">
                    <h3>Тренировка верха тела</h3>
                    <span className="badge">Силовая</span>
                </div>

                <div className="exercises-list">
                    <div className="exercise-item">
                        <div className="exercise-name">1. Подтягивания</div>
                        <div className="exercise-details">4 × 8 повторов</div>
                        <div className="exercise-meta">Отдых: 90 сек | RPE: 7</div>
                    </div>

                    <div className="exercise-item">
                        <div className="exercise-name">2. Отжимания</div>
                        <div className="exercise-details">3 × 12 повторов</div>
                        <div className="exercise-meta">Отдых: 60 сек | RPE: 6</div>
                    </div>

                    <div className="exercise-item">
                        <div className="exercise-name">3. Планка</div>
                        <div className="exercise-details">3 × 60 сек</div>
                        <div className="exercise-meta">Отдых: 45 сек</div>
                    </div>
                </div>

                <div className="card-actions">
                    <button className="btn btn-primary">✅ Начать тренировку</button>
                    <button className="btn btn-secondary">🔄 Перенести</button>
                </div>
            </div>

            <div className="tips-card">
                <h4>💡 Совет дня</h4>
                <p>Следи за техникой в подтягиваниях: локти направлены вниз, корпус жёсткий.</p>
            </div>
        </div>
    );
};

export default TodayView;

