import React from 'react';

const ExerciseCard = ({
    exercise,
    expanded = false,
    onToggle,
    history = [],
    loadingHistory = false,
}) => {
    const latest = exercise.latest_progress;

    const backgroundStyle = exercise.media?.image
        ? { backgroundImage: `url(${exercise.media.image})` }
        : { backgroundImage: 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(167,139,250,0.25))' };

    return (
        <div className={`card exercise-card ${expanded ? 'expanded' : ''}`}>
            <button className="exercise-header" onClick={() => onToggle(exercise.key)}>
                <div className="exercise-preview" style={backgroundStyle} aria-hidden />
                <div className="exercise-summary">
                    <h3>{exercise.title}</h3>
                    <p className="text-muted">{exercise.focus}</p>
                    {exercise.tags && (
                        <div className="exercise-tags">
                            {exercise.tags.map(tag => (
                                <span key={tag} className="tag-chip">{tag}</span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="exercise-meta">
                    {latest ? (
                        <>
                            <span className="badge">Уровень {latest.level || '—'}</span>
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

                    {exercise.media?.video && (
                        <div className="exercise-media">
                            <a
                                className="btn btn-secondary"
                                href={exercise.media.video}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Смотреть видеоразбор
                            </a>
                        </div>
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
