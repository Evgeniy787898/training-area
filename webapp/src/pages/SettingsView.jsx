import React from 'react';

const SettingsView = () => {
    return (
        <div className="view settings-view">
            <h2>⚙️ Настройки</h2>

            <div className="card">
                <p className="text-muted">Настройки управляются через бота.</p>
                <p>Вернись в чат и используй команду <code>/settings</code></p>

                <button
                    className="btn btn-primary"
                    onClick={() => window.Telegram?.WebApp?.close()}
                >
                    Вернуться в чат
                </button>
            </div>

            <div className="card">
                <h3>ℹ️ О приложении</h3>
                <p><strong>Версия:</strong> 1.0.0</p>
                <p><strong>Разработчик:</strong> Training Bot Team</p>
            </div>
        </div>
    );
};

export default SettingsView;

