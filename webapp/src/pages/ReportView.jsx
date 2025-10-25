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
                    <li>Впиши, что сделал по каждому упражнению (например, «Подтягивания 3x8»).</li>
                    <li>Оцени RPE, подтверди выполнение и добавь заметки — бот адаптирует план.</li>
                </ol>

                <button className="btn btn-primary" onClick={handleOpenChat}>
                    Вернуться в чат
                </button>
            </div>
        </div>
    );
};

export default ReportView;
