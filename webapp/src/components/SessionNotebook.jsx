import React from 'react';

const SessionNotebook = ({ session, history = {}, onExerciseChange }) => {
    if (!session) {
        return null;
    }

    const exercises = Array.isArray(session.exercises) ? session.exercises : [];

    return (
        <div className="notebook">
            <div className="notebook-page">
                <header className="notebook-header">
                    <div>
                        <h3>{session.session_type || 'Тренировка'}</h3>
                        <p className="notebook-focus">🎯 {session.focus || 'Баланс силы и мобильности'}</p>
                    </div>
                    <div className="notebook-meta">
                        <span>RPE {session.rpe || 6}</span>
                        {session.duration_minutes && <span>{session.duration_minutes} мин</span>}
                    </div>
                </header>

                <section className="notebook-section">
                    <h4>1. Разминка</h4>
                    <p>5 минут суставной мобилизации + дыхание 4-6-4.</p>
                </section>

                <section className="notebook-section">
                    <h4>2. Основная часть</h4>
                    <ul className="notebook-list">
                        {exercises.map((exercise, index) => {
                            const exerciseKey = exercise.exercise_key || `exercise_${index}`;
                            const prev = history[exerciseKey];
                            const volumeParts = [];
                            if (exercise.target?.sets) {
                                volumeParts.push(`${exercise.target.sets} подхода`);
                            }
                            if (exercise.target?.reps) {
                                volumeParts.push(`${exercise.target.reps} повторов`);
                            }
                            if (exercise.target?.duration_seconds) {
                                volumeParts.push(`${Math.round(exercise.target.duration_seconds / 60)} мин`);
                            }
                            const targetLabel = volumeParts.join(' · ');

                            return (
                                <li key={exerciseKey} className="notebook-row">
                                    <div className="row-main">
                                        <span className="row-index">{index + 1}</span>
                                        <div className="row-body">
                                            <span className="row-title">{exercise.name || exercise.exercise_key}</span>
                                            <span className="row-target">{targetLabel || 'Свободный формат'}</span>
                                            {prev && (
                                                <span className="row-history">Прошлый раз: {prev}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="row-actions">
                                        <label className="row-input">
                                            Сделал:
                                            <input
                                                type="number"
                                                min="0"
                                                inputMode="numeric"
                                                placeholder="повторы"
                                                onChange={event => onExerciseChange?.(exerciseKey, Number(event.target.value))}
                                            />
                                        </label>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <section className="notebook-section">
                    <h4>3. Заминка</h4>
                    <p>Лёгкая растяжка плеч, кошка-корова, прогулка 5 минут.</p>
                </section>
            </div>
        </div>
    );
};

export default SessionNotebook;
