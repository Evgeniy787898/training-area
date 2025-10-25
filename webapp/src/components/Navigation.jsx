import React from 'react';

const ICONS = {
    today: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 9h18" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="9" cy="13" r="1.2" fill="currentColor" />
            <circle cx="15" cy="13" r="1.2" fill="currentColor" />
            <circle cx="9" cy="17" r="1.2" fill="currentColor" />
        </svg>
    ),
    analytics: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 19V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M12 19V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M19 19v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    ),
    exercises: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M6 17h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    ),
    settings: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
            />
            <path
                d="m19 12.5.94-1.62a.5.5 0 0 0-.18-.68l-1.66-.96.02-1.9a.5.5 0 0 0-.4-.49l-1.88-.36-.9-1.71a.5.5 0 0 0-.64-.21l-1.74.78-1.74-.78a.5.5 0 0 0-.64.21l-.9 1.71-1.88.36a.5.5 0 0 0-.4.49l.02 1.9-1.66.96a.5.5 0 0 0-.18.68l.94 1.62-.94 1.62a.5.5 0 0 0 .18.68l1.66.96-.02 1.9a.5.5 0 0 0 .4.49l1.88.36.9 1.71a.5.5 0 0 0 .64.21l1.74-.78 1.74.78a.5.5 0 0 0 .64-.21l.9-1.71 1.88-.36a.5.5 0 0 0 .4-.49l-.02-1.9 1.66-.96a.5.5 0 0 0 .18-.68Z"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
            />
        </svg>
    ),
};

const tabs = [
    { id: 'today', label: 'Сегодня' },
    { id: 'analytics', label: 'Аналитика' },
    { id: 'exercises', label: 'Упражнения' },
    { id: 'settings', label: 'Настройки' },
];

const Navigation = ({ activeTab, onTabChange }) => {
    return (
        <nav className="bottom-nav">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                    <span className="nav-icon">{ICONS[tab.id]}</span>
                    <span className="nav-label">{tab.label}</span>
                </button>
            ))}
        </nav>
    );
};

export default Navigation;
