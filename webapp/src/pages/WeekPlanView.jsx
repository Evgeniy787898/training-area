import React from 'react';

const WeekPlanView = () => {
    const weekPlan = [
        { day: 'Пн', date: '27', status: 'done', type: 'Верх' },
        { day: 'Вт', date: '28', status: 'done', type: 'Низ' },
        { day: 'Ср', date: '29', status: 'today', type: 'Верх' },
        { day: 'Чт', date: '30', status: 'planned', type: 'Низ' },
        { day: 'Пт', date: '31', status: 'planned', type: 'Верх' },
        { day: 'Сб', date: '1', status: 'rest', type: 'Отдых' },
        { day: 'Вс', date: '2', status: 'rest', type: 'Отдых' },
    ];

    const getStatusIcon = (status) => {
        switch (status) {
            case 'done': return '✅';
            case 'today': return '👉';
            case 'planned': return '📋';
            case 'rest': return '💤';
            default: return '';
        }
    };

    return (
        <div className="view week-view">
            <h2>📆 План на неделю</h2>

            <div className="week-calendar">
                {weekPlan.map((day, index) => (
                    <div
                        key={index}
                        className={`day-card ${day.status}`}
                    >
                        <div className="day-header">
                            <span className="day-name">{day.day}</span>
                            <span className="day-date">{day.date}</span>
                        </div>
                        <div className="day-status">{getStatusIcon(day.status)}</div>
                        <div className="day-type">{day.type}</div>
                    </div>
                ))}
            </div>

            <div className="week-stats">
                <div className="stat-item">
                    <span className="stat-label">Выполнено</span>
                    <span className="stat-value">2/5</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Прогресс</span>
                    <span className="stat-value">40%</span>
                </div>
            </div>
        </div>
    );
};

export default WeekPlanView;

