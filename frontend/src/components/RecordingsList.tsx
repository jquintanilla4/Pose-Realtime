import React, { useEffect, useState } from 'react';

interface RecordingSummary {
    id: string;
    created_at_iso: string;
    mode: string;
    duration_s: number;
}

interface RecordingsListProps {
    onLoad: (id: string) => void;
    refreshTrigger: number;
}

export const RecordingsList: React.FC<RecordingsListProps> = ({ onLoad, refreshTrigger }) => {
    const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchRecordings();
    }, [refreshTrigger]);

    const fetchRecordings = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:8000/recordings');
            if (res.ok) {
                const data = await res.json();
                setRecordings(data);
            }
        } catch (e) {
            console.error("Failed to load recordings", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="recordings-list glass-panel">
            <h3>Saved Recordings</h3>
            {loading && <p>Loading...</p>}
            {!loading && recordings.length === 0 && <p className="empty-state">No recordings yet.</p>}
            <div className="list-content">
                {recordings.map(rec => (
                    <div key={rec.id} className="rec-item" onClick={() => onLoad(rec.id)}>
                        <div className="rec-info">
                            <span className="rec-date">{new Date(rec.created_at_iso).toLocaleString()}</span>
                            <span className="rec-meta">{rec.mode} • {rec.duration_s.toFixed(1)}s</span>
                        </div>
                        <button className="btn-small">Load</button>
                    </div>
                ))}
            </div>
        </div>
    );
};
