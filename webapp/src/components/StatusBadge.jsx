import React from 'react';

const STATUS_CONFIG = {
    rest: {
        icon: '😴',
        label: 'День отдыха',
        tone: 'rest',
        description: 'Перезаряжаемся и следим за восстановлением.',
    },
    training: {
        icon: '🏃‍♂️',
        label: 'День тренировки',
        tone: 'training',
        description: 'Тренировка в фокусе — двигаемся к прогрессу.',
    },
};

const StatusBadge = ({ status = 'training', compact = false }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.training;
    return (
        <div className={`status-badge status-${config.tone} ${compact ? 'status-compact' : ''}`}>
            <div className="status-icon">{config.icon}</div>
            <div className="status-content">
                <span className="status-label">{config.label}</span>
                {!compact && <span className="status-description">{config.description}</span>}
            </div>
        </div>
    );
};

export default StatusBadge;
