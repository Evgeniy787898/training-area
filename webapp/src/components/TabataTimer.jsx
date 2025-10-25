import React, { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_WORK = 40;
const DEFAULT_REST = 20;
const DEFAULT_ROUNDS = 8;

const formatTimer = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
};

const TabataTimer = ({ onSessionComplete }) => {
    const [workDuration, setWorkDuration] = useState(DEFAULT_WORK);
    const [restDuration, setRestDuration] = useState(DEFAULT_REST);
    const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
    const [activePhase, setActivePhase] = useState('work');
    const [remaining, setRemaining] = useState(DEFAULT_WORK);
    const [currentRound, setCurrentRound] = useState(1);
    const [running, setRunning] = useState(false);
    const intervalRef = useRef(null);
    const phaseRef = useRef(activePhase);
    const roundRef = useRef(currentRound);

    useEffect(() => {
        phaseRef.current = activePhase;
    }, [activePhase]);

    useEffect(() => {
        roundRef.current = currentRound;
    }, [currentRound]);

    const totalSeconds = useMemo(() => {
        return rounds * (workDuration + restDuration);
    }, [rounds, workDuration, restDuration]);

    useEffect(() => {
        setRemaining(activePhase === 'work' ? workDuration : restDuration);
    }, [workDuration, restDuration, activePhase]);

    useEffect(() => {
        if (!running) {
            return;
        }

        intervalRef.current = setInterval(() => {
            setRemaining(prev => {
                if (prev > 1) {
                    return prev - 1;
                }

                const wasWork = phaseRef.current === 'work';
                const nextPhase = wasWork ? 'rest' : 'work';
                setActivePhase(nextPhase);
                phaseRef.current = nextPhase;

                if (!wasWork) {
                    const nextRound = roundRef.current + 1;
                    if (nextRound > rounds) {
                        clearInterval(intervalRef.current);
                        setRunning(false);
                        onSessionComplete?.();
                        setCurrentRound(roundRef.current);
                        return 0;
                    }
                    setCurrentRound(nextRound);
                    roundRef.current = nextRound;
                }

                return wasWork ? restDuration : workDuration;
            });
        }, 1000);

        return () => clearInterval(intervalRef.current);
    }, [running, activePhase, restDuration, workDuration, rounds, onSessionComplete]);

    const handleStart = () => {
        if (running) {
            return;
        }
        setRunning(true);
    };

    const handlePause = () => {
        setRunning(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    };

    const handleReset = () => {
        handlePause();
        setActivePhase('work');
        setRemaining(workDuration);
        setCurrentRound(1);
        phaseRef.current = 'work';
        roundRef.current = 1;
    };

    const progress = useMemo(() => {
        if (!totalSeconds) {
            return 0;
        }
        const elapsedRounds = currentRound - 1;
        const elapsedInRound = activePhase === 'work' ? workDuration - remaining : workDuration + (restDuration - remaining);
        const elapsed = elapsedRounds * (workDuration + restDuration) + elapsedInRound;
        return Math.min(100, Math.round((elapsed / totalSeconds) * 100));
    }, [currentRound, activePhase, remaining, workDuration, restDuration, totalSeconds]);

    return (
        <div className="tabata">
            <header className="tabata-header">
                <h4>⏱️ Табата таймер</h4>
                <span className={`tabata-phase tabata-${activePhase}`}>
                    {activePhase === 'work' ? 'Работа' : 'Отдых'} — раунд {currentRound}/{rounds}
                </span>
            </header>

            <div className="tabata-display">
                <div className="tabata-time">{formatTimer(remaining)}</div>
                <div className="tabata-progress">
                    <div className="tabata-progress-bar" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="tabata-controls">
                <button className="btn btn-primary" onClick={handleStart} disabled={running}>
                    ▶️ Старт
                </button>
                <button className="btn btn-secondary" onClick={handlePause}>
                    ⏸ Пауза
                </button>
                <button className="btn btn-secondary" onClick={handleReset}>
                    🔄 Сброс
                </button>
            </div>

            <div className="tabata-settings">
                <label>
                    Работа, сек
                    <input
                        type="number"
                        min="10"
                        max="120"
                        value={workDuration}
                        onChange={event => setWorkDuration(Number(event.target.value) || DEFAULT_WORK)}
                    />
                </label>
                <label>
                    Отдых, сек
                    <input
                        type="number"
                        min="10"
                        max="120"
                        value={restDuration}
                        onChange={event => setRestDuration(Number(event.target.value) || DEFAULT_REST)}
                    />
                </label>
                <label>
                    Раунды
                    <input
                        type="number"
                        min="1"
                        max="12"
                        value={rounds}
                        onChange={event => setRounds(Number(event.target.value) || DEFAULT_ROUNDS)}
                    />
                </label>
            </div>
        </div>
    );
};

export default TabataTimer;
