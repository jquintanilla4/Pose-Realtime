import type { PoseAdapter, StandardPoseFrame } from '../pose/types';

export interface RecorderState {
    isRecording: boolean;
    startTime: number;
    frames: StandardPoseFrame[];
    fps: number;
}

export class AppLoop {
    private adapter: PoseAdapter | null = null;
    private video: HTMLVideoElement | null = null;
    // private canvas: HTMLCanvasElement | null = null;
    // private ctx: CanvasRenderingContext2D | null = null;

    private rafId: number = 0;
    // private lastInferenceTime: number = 0;
    private isRunning: boolean = false;

    // Recording
    private recording: boolean = false;
    private recordingStartTime: number = 0;
    private recordedFrames: StandardPoseFrame[] = [];
    private nextRecordTick: number = 0;
    private readonly RECORD_INTERVAL_MS = 1000 / 24;

    // Inference state
    private latestFrame: StandardPoseFrame | null = null;
    private isInferring: boolean = false;

    // Callbacks
    onFrame?: (frame: StandardPoseFrame) => void;
    onRecordingUpdate?: (duration: number, count: number) => void;

    constructor() { }

    setComponents(video: HTMLVideoElement) {
        this.video = video;
        // this.canvas = canvas;
        // this.ctx = canvas.getContext('2d');
    }

    setAdapter(adapter: PoseAdapter) {
        this.adapter = adapter;
        this.latestFrame = null;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.loop();
    }

    stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.rafId);
    }

    startRecording() {
        this.recording = true;
        this.recordedFrames = [];
        this.recordingStartTime = performance.now();
        this.nextRecordTick = 0; // Relative to start
    }

    stopRecording(): StandardPoseFrame[] {
        this.recording = false;
        const frames = [...this.recordedFrames];
        this.recordedFrames = [];
        return frames;
    }

    private loop = () => {
        if (!this.isRunning) return;

        const now = performance.now();

        // 1. Inference
        if (this.adapter && this.video && this.video.readyState >= 2 && !this.isInferring) {
            this.isInferring = true;
            // We pass 'now' but the real timestamp is when the frame was captured. 
            // For webcam, 'now' is close enough.
            this.adapter.estimate(this.video, now)
                .then(frame => {
                    this.latestFrame = frame;
                    this.isInferring = false;
                    // Notify for drawing
                    if (this.onFrame) this.onFrame(frame);
                })
                .catch(err => {
                    console.error("Inference error:", err);
                    this.isInferring = false;
                });
        }

        // 2. Recording (Fixed Tick)
        if (this.recording) {
            const elapsed = now - this.recordingStartTime;

            // Catch up ticks
            while (elapsed >= this.nextRecordTick) {
                // Record the LATEST available estimate (sample and hold)
                // If no estimate yet, we might record null or an empty frame. 
                // Better to record empty if null.
                const frameToStore = this.latestFrame ? { ...this.latestFrame, t_ms: this.nextRecordTick } : this.createEmptyFrame(this.nextRecordTick);

                // Ensure strictly increasing time in storage? 
                // We overwrite t_ms with the tick time to be perfectly regular.
                frameToStore.t_ms = this.nextRecordTick;

                this.recordedFrames.push(frameToStore);
                this.nextRecordTick += this.RECORD_INTERVAL_MS;
            }

            if (this.onRecordingUpdate) {
                this.onRecordingUpdate(elapsed, this.recordedFrames.length);
            }
        }

        this.rafId = requestAnimationFrame(this.loop);
    }

    private createEmptyFrame(t: number): StandardPoseFrame {
        return {
            t_ms: t,
            mode: this.adapter ? this.adapter.mode : 'holistic', // default
            people: []
        };
    }
}
