import React from 'react';
import type { PoseMode } from '../pose/types';

interface ControlsProps {
    mode: PoseMode;
    peopleCount: number;
    isRecording: boolean;
    isPlaying: boolean;
    playbackTime: number;
    playbackDuration: number;
    onModeChange: (mode: PoseMode) => void;
    onPeopleCountChange: (count: number) => void;
    onStartCamera: () => void;
    onStopCamera: () => void;
    onToggleRecord: () => void;
    onTogglePlay: () => void;
    onSeek: (time: number) => void;
    cameraActive: boolean;
    hasRecording: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
    mode,
    peopleCount,
    isRecording,
    isPlaying,
    playbackTime,
    playbackDuration,
    onModeChange,
    onPeopleCountChange,
    onStartCamera,
    onStopCamera,
    onToggleRecord,
    onTogglePlay,
    onSeek,
    cameraActive,
    hasRecording
}) => {
    // Format time helpers
    const formatTime = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const sec = s % 60;
        const msPart = Math.floor((ms % 1000) / 10);
        return `${m}:${sec.toString().padStart(2, '0')}.${msPart.toString().padStart(2, '0')}`;
    };

    return (
        <div className="controls-container glass-panel">
            {/* Top Bar: Settings */}
            <div className="control-group">
                <label>Mode</label>
                <div className="segmented-control">
                    <button
                        className={mode === 'holistic' ? 'active' : ''}
                        onClick={() => onModeChange('holistic')}
                        disabled={cameraActive || isRecording}
                    >
                        Max Detail (1 Person)
                    </button>
                    <button
                        className={mode === 'movenet' ? 'active' : ''}
                        onClick={() => onModeChange('movenet')}
                        disabled={cameraActive || isRecording}
                    >
                        Multi-Person
                    </button>
                </div>
            </div>

            <div className="control-group">
                <label>People</label>
                <select
                    value={peopleCount}
                    onChange={(e) => onPeopleCountChange(Number(e.target.value))}
                    disabled={mode === 'holistic' || cameraActive || isRecording}
                    className="styled-select"
                >
                    {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>
            </div>

            <div className="separator" />

            {/* Camera Controls */}
            <div className="control-group">
                {!cameraActive ? (
                    <button className="btn-primary" onClick={onStartCamera}>Start Camera</button>
                ) : (
                    <button className="btn-danger" onClick={onStopCamera} disabled={isRecording}>Stop Camera</button>
                )}
            </div>

            {/* Recording */}
            {cameraActive && (
                <div className="control-group">
                    <button
                        className={`btn-record ${isRecording ? 'recording' : ''}`}
                        onClick={onToggleRecord}
                    >
                        {isRecording ? 'Stop Recording' : 'Record'}
                    </button>
                    {isRecording && <div className="recording-indicator">REC</div>}
                </div>
            )}

            {/* Playback Controls */}
            {!cameraActive && hasRecording && (
                <div className="playback-controls">
                    <button className="btn-icon" onClick={onTogglePlay}>
                        {isPlaying ? '⏸' : '▶'}
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={playbackDuration || 1}
                        value={playbackTime}
                        onChange={(e) => onSeek(Number(e.target.value))}
                        className="scrubber"
                    />
                    <span className="time-display">
                        {formatTime(playbackTime)} / {formatTime(playbackDuration)}
                    </span>
                </div>
            )}
        </div>
    );
};
