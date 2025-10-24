import React from 'react';

const ErrorState = ({ title = 'Что-то пошло не так', message, actionLabel, onRetry }) => (
    <div className="card error-card" role="alert">
        <h3>{title}</h3>
        {message && <p className="text-muted">{message}</p>}
        {onRetry && (
            <button className="btn btn-primary" onClick={onRetry} aria-label="Повторить запрос">
                {actionLabel || 'Повторить'}
            </button>
        )}
    </div>
);

export default ErrorState;
