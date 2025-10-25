import React from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const DaySwitcher = ({ date, onChange }) => {
    const handleShift = (days) => {
        if (!date) {
            return;
        }
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        onChange?.(next);
    };

    const handleInputChange = (event) => {
        const value = event.target.value;
        if (!value) {
            return;
        }
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            onChange?.(parsed);
        }
    };

    const isoDate = date ? format(date, 'yyyy-MM-dd') : '';
    const humanDate = date
        ? format(date, "d MMMM, EEEE", { locale: ru }).replace(/^./, char => char.toUpperCase())
        : '';

    return (
        <div className="day-switcher">
            <button className="switcher-btn" onClick={() => handleShift(-1)} aria-label="Предыдущий день">
                ←
            </button>
            <div className="switcher-center">
                <span className="switcher-date">{humanDate}</span>
                <input
                    className="switcher-input"
                    type="date"
                    value={isoDate}
                    onChange={handleInputChange}
                    aria-label="Выбрать дату"
                />
            </div>
            <button className="switcher-btn" onClick={() => handleShift(1)} aria-label="Следующий день">
                →
            </button>
        </div>
    );
};

export default DaySwitcher;
