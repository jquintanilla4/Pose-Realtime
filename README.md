# Pose Realtime (Antigravity Pose)

Browser-based pose tracking + recording. There is **no Python/backend server**: pose inference runs in the browser and recordings are saved locally using **IndexedDB**.

## What this app does

- Starts your webcam and runs pose inference in real time
- Draws pose landmarks on a canvas overlay
- Records pose “frames” (timestamps + keypoints)
- Saves and loads recordings from your browser (IndexedDB)

## Tech stack (beginner-friendly)

- **Vite + React + TypeScript** for the UI (`src/`)
- **MediaPipe Holistic** for “max detail” single-person tracking
- **TensorFlow.js MoveNet** for multi-person tracking
- **IndexedDB** for local persistence (no server needed)

## Requirements

- **Node.js 18+** (Node 20 recommended)
- A webcam
- A browser that supports `getUserMedia` (Chrome/Edge/Firefox/Safari)

## Setup

```bash
npm install
```

During install we automatically generate MediaPipe runtime assets in `public/mediapipe/` (see “MediaPipe assets” below).

## Run (development)

```bash
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

If you prefer `make`:

```bash
make dev
```

## Using the app

1. Click **Start Camera** and allow camera permissions in your browser.
2. Pick a mode:
   - **Max Detail (1 Person)** (Holistic)
   - **Multi-Person** (MoveNet)
3. Click **Record** to start saving frames, then **Stop Recording** when you’re done.
4. Click **Stop Camera** to switch into playback mode for the most recent recording.
5. Use the play/pause button and scrubber to review, or load older sessions from **Saved Recordings**.

## Build (production)

```bash
npm run build
```

This outputs a static site in `dist/`. You can preview it locally:

```bash
npm run preview
```

## Lint

```bash
npm run lint
```

## How recordings work (IndexedDB)

- Recordings are saved into your browser’s **IndexedDB** database named `pose-realtime`.
- They are **local to your browser profile** (they won’t sync to other devices).
- To clear recordings:
  - Chrome/Edge: DevTools → Application → Storage/IndexedDB → delete the `pose-realtime` database (or “Clear site data”).

The storage code lives in `src/storage/recordings.ts`.

## Pose modes

- **Max Detail (1 Person)**: MediaPipe Holistic (`src/pose/HolisticAdapter.ts`)
- **Multi-Person**: MoveNet via TensorFlow.js (`src/pose/MoveNetAdapter.ts`)

## MediaPipe assets (generated, not committed)

MediaPipe Holistic needs large runtime files (WASM, model files, packed assets). We serve them from:

- `public/mediapipe/*` → fetched by the browser at runtime as `/mediapipe/*`

Those files are intentionally **git-ignored** because they are large. Instead, we generate them by copying from:

- `node_modules/@mediapipe/holistic/*`

Scripts:

- `npm run setup:mediapipe` — (re)generate `public/mediapipe/`
- `postinstall` — runs `setup:mediapipe` automatically after `npm install`
- `prebuild` — runs `setup:mediapipe` automatically before `npm run build`

If you see 404s in the browser for `/mediapipe/*`, run:

```bash
npm run setup:mediapipe
```

The generator script is `scripts/setup-mediapipe.mjs`.

## Project layout

- `src/App.tsx` — app wiring (camera start/stop, recording, playback)
- `src/components/*` — UI components
- `src/pose/*` — pose adapters + drawing helpers
- `src/recorder/*` — real-time loop + playback controller
- `src/storage/recordings.ts` — IndexedDB save/load/list
- `public/` — static files served by Vite (includes generated `public/mediapipe/`)

## Troubleshooting

- **“Cannot find module …” in the editor**
  - Make sure your editor opened the repo root (the folder that contains `package.json`).
  - In VS Code: run “TypeScript: Restart TS server”.
- **Camera won’t start**
  - Allow camera permission for `http://localhost:*`.
  - Close other apps/tabs that might be using the camera.
- **Pose overlay is blank**
  - Check the browser console for MediaPipe asset 404s.
  - Run `npm run setup:mediapipe` and reload.
