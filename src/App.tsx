import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VideoCanvas } from './components/VideoCanvas';
import { Controls } from './components/Controls';
import { RecordingsList } from './components/RecordingsList';
import { AppLoop } from './recorder/Loop';
import { PlaybackController } from './recorder/Playback';
import { HolisticAdapter } from './pose/HolisticAdapter';
import { MoveNetAdapter } from './pose/MoveNetAdapter';
import { type PoseMode, type PoseAdapter, type QualityMode } from './pose/types';
import { drawFrame } from './pose/drawing';
import { getRecording, saveRecording } from './storage/recordings';
import './index.css';

const App: React.FC = () => {
  // UI State
  const [mode, setMode] = useState<PoseMode>('holistic');
  // Quality mode: 'fast' for real-time performance, 'quality' for higher accuracy
  // This setting is passed to adapters to configure model complexity/resolution
  const [qualityMode, setQualityMode] = useState<QualityMode>('fast');
  const [peopleCount, setPeopleCount] = useState(1);
  const [cameraActive, setCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [hasRecordingLoaded, setHasRecordingLoaded] = useState(false);
  const [refreshListTrigger, setRefreshListTrigger] = useState(0);

  // Refs (Logic)
  const appLoop = useRef(new AppLoop());
  const playback = useRef(new PlaybackController());
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null); // Keep track of stream to stop tracks

  // Initialize
  useEffect(() => {
    const loop = appLoop.current;
    const player = playback.current;

    // Setup callbacks
    loop.onFrame = (frame) => {
      const canvas = canvasEl.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      try {
        drawFrame(ctx, frame, canvas.width, canvas.height);
      } catch (err) {
        console.error('Draw error (live):', err);
      }
    };
    loop.onRecordingUpdate = () => {
      // Optional: update UI with elapsed time
    };

    player.onFrame = (frame, t) => {
      setPlaybackTime(t);
      const canvas = canvasEl.current;
      if (!canvas || !frame) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      try {
        drawFrame(ctx, frame, canvas.width, canvas.height);
      } catch (err) {
        console.error('Draw error (playback):', err);
      }
    };
    player.onEnd = () => setIsPlaying(false);

    return () => {
      loop.stop();
      player.pause();
    };
  }, []);

  /**
   * Initialize a pose detection adapter based on the selected mode and quality.
   * @param m - Pose mode: 'holistic' for single person with face/hands, 'movenet' for multi-person
   * @param p - Max number of people to detect (only used by MoveNet)
   * @param q - Quality mode: 'fast' or 'quality' - affects model complexity/resolution
   */
  const initAdapter = useCallback(async (m: PoseMode, p: number, q: QualityMode) => {
    let adapter: PoseAdapter;
    if (m === 'holistic') {
      adapter = new HolisticAdapter();
    } else {
      adapter = new MoveNetAdapter();
    }

    // Configure
    adapter.maxPeople = p; // Holistic doesn't use this but MoveNet does

    // Initialize with quality setting - this configures model complexity/resolution
    await adapter.init(q);
    appLoop.current.setAdapter(adapter);

    // If components are ready
    if (videoEl.current) {
      appLoop.current.setComponents(videoEl.current);
    }
  }, []);

  // Mode Switching
  useEffect(() => {
    if (cameraActive) {
      // If camera is active, we should theoretically switch adapter on the fly.
      // For simplicity/robustness, we'll ask user to stop camera first?
      // Or just restart loop.
      // Let's restart logic if running.
      void initAdapter(mode, peopleCount, qualityMode).catch((err) => {
        console.error('Adapter init failed (mode switch):', err);
        alert('Pose model failed to initialize. See console for details.');
      });
    }
  }, [cameraActive, initAdapter, mode, peopleCount, qualityMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: { ideal: 30 } }
      });
      streamRef.current = stream;
      if (videoEl.current) {
        videoEl.current.srcObject = stream;
        videoEl.current.onloadedmetadata = () => {
          videoEl.current?.play();
          // Start Loop
          void initAdapter(mode, peopleCount, qualityMode)
            .then(() => {
              appLoop.current.start();
              setCameraActive(true);
              setHasRecordingLoaded(false); // Clear playback mode
            })
            .catch((err) => {
              console.error('Adapter init failed (camera start):', err);
              alert('Pose model failed to initialize. See console for details.');
            });
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not start camera. See console.");
    }
  };

  const stopCamera = () => {
    appLoop.current.stop();
    if (isRecording) {
      stopRecording(); // unexpected stop
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoEl.current) {
      videoEl.current.srcObject = null;
    }

    // Clear canvas
    if (canvasEl.current) {
      const ctx = canvasEl.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasEl.current.width, canvasEl.current.height);
    }

    setCameraActive(false);
  };

  const startRecording = () => {
    appLoop.current.startRecording();
    setIsRecording(true);
  };

  const stopRecording = async () => {
    const frames = appLoop.current.stopRecording();
    setIsRecording(false);

    // Save locally (IndexedDB)
    if (frames.length === 0) return;

    // Create recording object
    const videoInfo = {
      width: videoEl.current?.videoWidth || 0,
      height: videoEl.current?.videoHeight || 0
    };

    const payload = {
      created_at_iso: new Date().toISOString(),
      fps: 24,
      video: videoInfo,
      mode,
      requested_people: peopleCount,
      frames
    };

    try {
      const id = await saveRecording(payload);
      console.log("Saved recording:", id);

      // Switch to playback logic immediately?
      // Requirement: "When user clicks “Stop Camera”, the app switches to playback mode"
      // But here we just stopped recording. Usually we stay in live mode until Stop Camera.
      // User flow says: Stop Camera -> switches to playback if recording exists.

      // Let's load this recording into playback controller so it's ready when we stop camera.
      playback.current.load(frames);
      setHasRecordingLoaded(true);
      setPlaybackDuration(frames[frames.length - 1].t_ms);
      setRefreshListTrigger(prev => prev + 1);

    } catch (e) {
      console.error("Save failed", e);
      alert("Failed to save recording locally");
    }
  };

  const loadRecording = async (id: string) => {
    // If camera active, stop it
    if (cameraActive) stopCamera();

    try {
      const data = await getRecording(id);
      if (!data) throw new Error("Recording not found");

      // data.frames need to be StandardPoseFrame
      // Ensure format matches
      playback.current.load(data.frames);
      setPlaybackDuration(data.frames.length > 0 ? data.frames[data.frames.length - 1].t_ms : 0);
      setHasRecordingLoaded(true);
      setIsPlaying(false);
      setPlaybackTime(0);

      // Also update mode/people count UI to reflect recording? 
      // Maybe or maybe not, just show it.

    } catch (e) {
      console.error(e);
      alert("Load error");
    }
  };

  const togglePlayback = () => {
    if (isPlaying) playback.current.pause();
    else playback.current.play();
    setIsPlaying(!isPlaying);
  };

  const seek = (t: number) => {
    playback.current.seek(t);
  };

  // Logic: "When user clicks “Stop Camera”, the app switches to playback mode if a recording exists."
  // handled in stopCamera? No, stopCamera clears everything.
  // We need a specific flow.
  // Actually, if we just recorded, we loaded it into playback.current.
  // So when camera stops, if hasRecordingLoaded is true, we render playback view?
  // Our VideoCanvas component renders video + canvas.
  // In playback mode, video is empty (black or hidden) and canvas draws skeleton.
  // This works fine.

  return (
    <div className="app-container">
      <header>
        <h1>Antigravity Pose</h1>
      </header>

      <main>
        <div className="main-content">
          <div className="video-area">
            <VideoCanvas
              ref={videoEl}
              onCanvasReady={(c) => canvasEl.current = c}
              onVideoReady={(v) => videoEl.current = v}
            />
            {isRecording && <div className="rec-overlay-border" />}
          </div>

          <Controls
            mode={mode}
            qualityMode={qualityMode}
            peopleCount={peopleCount}
            isRecording={isRecording}
            isPlaying={isPlaying}
            playbackTime={playbackTime}
            playbackDuration={playbackDuration}
            onModeChange={setMode}
            onQualityModeChange={setQualityMode}
            onPeopleCountChange={setPeopleCount}
            onStartCamera={startCamera}
            onStopCamera={stopCamera}
            onToggleRecord={isRecording ? stopRecording : startRecording}
            onTogglePlay={togglePlayback}
            onSeek={seek}
            cameraActive={cameraActive}
            hasRecording={hasRecordingLoaded}
          />
        </div>

        <aside>
          <RecordingsList onLoad={loadRecording} refreshTrigger={refreshListTrigger} />
        </aside>
      </main>
    </div>
  );
};

export default App;
