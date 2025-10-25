import React, { useEffect } from 'react';

const Toast = ({ toast, onClose }) => {
    useEffect(() => {
        if (!toast) {
            return undefined;
        }

        const timer = setTimeout(() => onClose(toast.id), toast.duration || 3500);
        return () => clearTimeout(timer);
    }, [toast, onClose]);

    if (!toast) {
        return null;
    }

    return (
        <div className={`toast toast-${toast.type || 'info'}`} role="status">
            <span className="toast-icon" aria-hidden>
                {toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✅' : 'ℹ️'}
            </span>
            <div className="toast-content">
                <p className="toast-title">{toast.title}</p>
                {toast.message && <p className="toast-message">{toast.message}</p>}
            </div>
            <button className="toast-close" onClick={() => onClose(toast.id)} aria-label="Закрыть уведомление">
                ×
            </button>
        </div>
    );
};

export default Toast;
