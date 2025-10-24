import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import TodayView from './pages/TodayView';
import WeekPlanView from './pages/WeekPlanView';
import ReportView from './pages/ReportView';
import ProgressView from './pages/ProgressView';
import SettingsView from './pages/SettingsView';

function App() {
    const [activeTab, setActiveTab] = useState('today');
    const [userData, setUserData] = useState(null);

    useEffect(() => {
        // Get Telegram WebApp data
        const tg = window.Telegram?.WebApp;
        if (tg && tg.initDataUnsafe) {
            setUserData(tg.initDataUnsafe.user);
        }
    }, []);

    const renderView = () => {
        switch (activeTab) {
            case 'today':
                return <TodayView />;
            case 'week':
                return <WeekPlanView />;
            case 'report':
                return <ReportView />;
            case 'progress':
                return <ProgressView />;
            case 'settings':
                return <SettingsView />;
            default:
                return <TodayView />;
        }
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>💪 Training Bot</h1>
                {userData && <p className="user-info">Привет, {userData.first_name}!</p>}
            </header>

            <main className="app-main">
                {renderView()}
            </main>

            <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
    );
}

export default App;

