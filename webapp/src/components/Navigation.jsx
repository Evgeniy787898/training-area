import React from 'react';

const Navigation = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: 'today', label: 'Сегодня', icon: '📅' },
        { id: 'week', label: 'Неделя', icon: '📆' },
        { id: 'report', label: 'Отчёт', icon: '📝' },
        { id: 'progress', label: 'Прогресс', icon: '📊' },
        { id: 'exercises', label: 'Упражнения', icon: '🏋️' },
        { id: 'library', label: 'Справка', icon: '🧠' },
        { id: 'settings', label: 'Настройки', icon: '⚙️' },
    ];

    return (
        <nav className="bottom-nav">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                    <span className="nav-icon">{tab.icon}</span>
                    <span className="nav-label">{tab.label}</span>
                </button>
            ))}
        </nav>
    );
};

export default Navigation;
