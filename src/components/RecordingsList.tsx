import React, { useEffect, useState } from 'react';
import { deleteRecording, listRecordings, type RecordingSummary } from '../storage/recordings';

interface RecordingsListProps {
    onLoad: (id: string) => void;
    refreshTrigger: number;
}

export const RecordingsList: React.FC<RecordingsListProps> = ({ onLoad, refreshTrigger }) => {
    const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        fetchRecordings();
    }, [refreshTrigger]);

    const fetchRecordings = async () => {
        setLoading(true);
        try {
            const data = await listRecordings();
            setRecordings(data);
        } catch (e) {
            console.error("Failed to load recordings", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (deletingId) return;
        const ok = window.confirm("Delete this recording? This can't be undone.");
        if (!ok) return;

        setDeletingId(id);
        try {
            await deleteRecording(id);
            await fetchRecordings();
        } catch (e) {
            console.error("Failed to delete recording", e);
            alert("Failed to delete recording");
        } finally {
            setDeletingId(null);
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
                        <div className="rec-actions">
                            <button
                                className="btn-small btn-delete"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleDelete(rec.id);
                                }}
                                disabled={deletingId === rec.id}
                                aria-label="Delete recording"
                                title="Delete"
                            >
                                Delete
                            </button>
                            <button
                                className="btn-small"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onLoad(rec.id);
                                }}
                                aria-label="Load recording"
                                title="Load"
                            >
                                Load
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
