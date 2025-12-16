import type { PoseMode, StandardPoseFrame } from '../pose/types';

export interface VideoInfo {
  width: number;
  height: number;
}

export interface Recording {
  id: string;
  created_at_iso: string;
  fps: number;
  video: VideoInfo;
  mode: PoseMode;
  requested_people: number;
  duration_ms: number;
  frames: StandardPoseFrame[];
}

export interface RecordingSummary {
  id: string;
  created_at_iso: string;
  mode: PoseMode;
  duration_s: number;
}

const DB_NAME = 'pose-realtime';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('created_at_iso', 'created_at_iso', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });

  return dbPromise;
}

function txRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function saveRecording(input: Omit<Recording, 'id' | 'duration_ms'> & { id?: string }): Promise<string> {
  const db = await openDb();
  const id = input.id ?? randomId();
  const duration_ms = input.frames.length > 0 ? input.frames[input.frames.length - 1].t_ms : 0;

  const recording: Recording = {
    ...input,
    id,
    duration_ms,
  };

  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await txRequest(store.put(recording));

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });

  return id;
}

export async function listRecordings(): Promise<RecordingSummary[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const records = await txRequest(store.getAll());

  const summaries = (records as Recording[]).map((rec) => ({
    id: rec.id,
    created_at_iso: rec.created_at_iso,
    mode: rec.mode,
    duration_s: (rec.duration_ms ?? 0) / 1000,
  }));

  summaries.sort((a, b) => b.created_at_iso.localeCompare(a.created_at_iso));
  return summaries;
}

export async function getRecording(id: string): Promise<Recording | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const rec = await txRequest(store.get(id));
  return (rec as Recording | undefined) ?? null;
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await txRequest(store.delete(id));

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

