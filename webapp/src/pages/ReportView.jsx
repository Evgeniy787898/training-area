import React from 'react';

const ReportView = () => {
    return (
        <div className="view report-view">
            <h2>📝 Отчёт о тренировке</h2>

            <div className="card">
                <p className="text-muted">Отчёт о тренировках отправляется через бота.</p>
                <p>Вернись в чат и используй команду <code>/report</code></p>

                <button
                    className="btn btn-primary"
                    onClick={() => window.Telegram?.WebApp?.close()}
                >
                    Вернуться в чат
                </button>
            </div>
        </div>
    );
};

export default ReportView;

