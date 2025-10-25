import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';

const TIMEZONES = [
    'Europe/Moscow',
    'Europe/Kaliningrad',
    'Europe/Samara',
    'Asia/Yekaterinburg',
    'Asia/Novosibirsk',
    'Asia/Vladivostok',
];

const SettingsView = () => {
    const { profileSummary, refreshProfile, showToast } = useAppContext();
    const [form, setForm] = useState({
        notification_time: '06:00',
        timezone: 'Europe/Moscow',
        notifications_paused: false,
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!profileSummary?.profile) {
            return;
        }

        const notification = profileSummary.profile.notification_time?.slice(0, 5) || '06:00';
        setForm({
            notification_time: notification,
            timezone: profileSummary.profile.timezone || 'Europe/Moscow',
            notifications_paused: profileSummary.profile.notifications_paused || false,
        });
    }, [profileSummary]);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const payload = {
                notification_time: form.notification_time,
                timezone: form.timezone,
                notifications_paused: form.notifications_paused,
            };
            await apiClient.updatePreferences(payload);
            showToast({ title: 'Настройки обновлены', type: 'success' });
            await refreshProfile?.();
        } catch (error) {
            showToast({ title: 'Не удалось обновить настройки', message: error.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="view settings-view">
            <h2>⚙️ Настройки</h2>

            <form className="card" onSubmit={handleSubmit}>
                <div className="form-field">
                    <label htmlFor="notification_time">Время уведомления</label>
                    <input
                        id="notification_time"
                        name="notification_time"
                        type="time"
                        value={form.notification_time}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="timezone">Часовой пояс</label>
                    <select id="timezone" name="timezone" value={form.timezone} onChange={handleChange}>
                        {TIMEZONES.map(tz => (
                            <option key={tz} value={tz}>{tz}</option>
                        ))}
                    </select>
                </div>

                <div className="form-field checkbox-field">
                    <label htmlFor="notifications_paused">Пауза уведомлений</label>
                    <input
                        id="notifications_paused"
                        name="notifications_paused"
                        type="checkbox"
                        checked={form.notifications_paused}
                        onChange={handleChange}
                    />
                </div>

                <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Сохраняю…' : 'Сохранить'}
                </button>
            </form>

            <div className="card">
                <h3>ℹ️ Советы</h3>
                <p className="text-muted">Измени время уведомления — напоминания придут к указанному часу.</p>
                <p className="text-muted">Пауза поможет отключить сигналы на время отпуска или восстановления.</p>
            </div>
        </div>
    );
};

export default SettingsView;

