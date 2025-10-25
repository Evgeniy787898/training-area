import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';

const SettingsView = () => {
    const { profileSummary, refreshProfile, showToast } = useAppContext();
    const [form, setForm] = useState({
        notification_time: '06:00',
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
                notifications_paused: form.notifications_paused,
            };
            await apiClient.updatePreferences(payload);
            showToast({ title: 'Настройки обновлены', type: 'success' });
            await refreshProfile?.();
        } catch (error) {
            showToast({ title: 'Не удалось обновить настройки', message: error.message, type: 'error', traceId: error.traceId });
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
                <p className="text-muted">Измени время уведомления — бот подстроит рассылку на следующий день.</p>
                <p className="text-muted">Пауза помогает отключить напоминания на время отпуска.</p>
                <p className="text-muted">Текущий часовой пояс: {profileSummary?.profile?.timezone || 'Europe/Moscow'} (изменение доступно по запросу тренеру).</p>
                <button className="btn btn-secondary" onClick={() => window.Telegram?.WebApp?.close()}>
                    Вернуться в чат
                </button>
            </div>
        </div>
    );
};

export default SettingsView;
