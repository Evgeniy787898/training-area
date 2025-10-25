import React from 'react';

const ExerciseCard = ({
    exercise,
    expanded = false,
    onToggle,
    history = [],
    loadingHistory = false,
}) => {
    const latest = exercise.latest_progress;

    return (
        <div className={`card exercise-card ${expanded ? 'expanded' : ''}`}>
            <button className="exercise-header" onClick={() => onToggle(exercise.key)}>
                <div>
                    <h3>{exercise.title}</h3>
                    <p className="text-muted">{exercise.focus}</p>
                </div>
                <div className="exercise-meta">
                    {latest ? (
                        <>
                            <span className="badge">Последний уровень: {latest.level || '—'}</span>
                            {latest.session_date && (
                                <span className="badge muted">{latest.session_date}</span>
                            )}
                        </>
                    ) : (
                        <span className="badge muted">Нет записей</span>
                    )}
                    <span className="expand-icon" aria-hidden>
                        {expanded ? '▴' : '▾'}
                    </span>
                </div>
            </button>

            {expanded && (
                <div className="exercise-body">
                    {exercise.description && (
                        <p className="exercise-description">{exercise.description}</p>
                    )}

                    {exercise.cue && (
                        <p className="exercise-cue">💡 {exercise.cue}</p>
                    )}

                    <h4>Прогрессия</h4>
                    <div className="levels-grid">
                        {exercise.levels.map(level => (
                            <div key={level.id} className="level-item">
                                <div className="level-title">{level.id}</div>
                                <div className="level-name">{level.title}</div>
                                <div className="level-prescription">
                                    {level.sets} × {level.reps}
                                </div>
                            </div>
                        ))}
                    </div>

                    <h4>История</h4>
                    {loadingHistory ? (
                        <p className="text-muted">Загружаю историю...</p>
                    ) : history.length === 0 ? (
                        <p className="text-muted">Пока нет отметок по этому упражнению.</p>
                    ) : (
                        <ul className="history-list">
                            {history.map(item => (
                                <li key={`${item.recorded_at}-${item.level_result || item.level_target}`}>
                                    <div className="history-row">
                                        <span className="history-date">{item.session_date || '—'}</span>
                                        <span className="history-level">{item.level_result || item.level_target}</span>
                                        {item.rpe && (
                                            <span className="history-rpe">RPE {item.rpe}</span>
                                        )}
                                    </div>
                                    {item.decision && (
                                        <div className={`history-decision decision-${item.decision}`}>
                                            {item.decision === 'advance' && '🔥 Прогрессируем'}
                                            {item.decision === 'hold' && '🔁 Закрепляем'}
                                            {item.decision === 'regress' && '🛠️ Облегчаем'}
                                            {item.decision && !['advance', 'hold', 'regress'].includes(item.decision) && item.decision}
                                        </div>
                                    )}
                                    {item.notes && <div className="history-notes">📝 {item.notes}</div>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default ExerciseCard;
