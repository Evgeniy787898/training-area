import React from 'react';
import { useAppContext } from '../context/AppContext';

const ReportView = () => {
    const { showToast } = useAppContext();

    const handleOpenChat = () => {
        showToast?.({
            title: 'Отправь отчёт в чате',
            message: 'Команда /report поможет пройти три шага: RPE → выполнение → заметки.',
            type: 'info',
        });
        window.Telegram?.WebApp?.close();
    };

    return (
        <div className="view report-view">
            <h2>📝 Отчёт о тренировке</h2>

            <div className="card">
                <p className="text-muted">Отчёт заполняется в чате, чтобы бот смог проанализировать результаты и дать рекомендации.</p>
                <ol className="report-steps">
                    <li>Открой чат и введи команду <code>/report</code>.</li>
                    <li>Выбери тренировку, оцени RPE и отметь выполнение.</li>
                    <li>Добавь заметки — бот подстроит план и сохранит прогресс.</li>
                </ol>

                <button className="btn btn-primary" onClick={handleOpenChat}>
                    Вернуться в чат
                </button>
            </div>
        </div>
    );
};

export default ReportView;

