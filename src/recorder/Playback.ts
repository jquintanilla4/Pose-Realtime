import type { StandardPoseFrame } from '../pose/types';

export class PlaybackController {
    private frames: StandardPoseFrame[] = [];
    private currentTime: number = 0;
    private duration: number = 0;
    private isPlaying: boolean = false;
    private rafId: number = 0;
    private lastTick: number = 0;

    onFrame?: (frame: StandardPoseFrame | null, t: number) => void;
    onTimeUpdate?: (t: number) => void;
    onEnd?: () => void;

    load(frames: StandardPoseFrame[]) {
        this.frames = frames.sort((a, b) => a.t_ms - b.t_ms);
        this.duration = this.frames.length > 0 ? this.frames[this.frames.length - 1].t_ms : 0;
        this.currentTime = 0;
        this.seek(0);
    }

    play() {
        if (this.isPlaying) return;
        if (this.currentTime >= this.duration) {
            this.seek(0);
        }
        this.isPlaying = true;
        this.lastTick = performance.now();
        this.loop();
    }

    pause() {
        this.isPlaying = false;
        cancelAnimationFrame(this.rafId);
    }

    seek(t: number) {
        this.currentTime = Math.max(0, Math.min(t, this.duration));
        const frame = this.getFrameAt(this.currentTime);
        if (this.onFrame) this.onFrame(frame, this.currentTime);
        if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime);
    }

    private loop = () => {
        if (!this.isPlaying) return;

        const now = performance.now();
        const dt = now - this.lastTick;
        this.lastTick = now;

        this.currentTime += dt;

        if (this.currentTime >= this.duration) {
            this.currentTime = this.duration;
            this.pause();
            if (this.onEnd) this.onEnd();
        }

        const frame = this.getFrameAt(this.currentTime);
        if (this.onFrame) this.onFrame(frame, this.currentTime);
        if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime);

        if (this.isPlaying) {
            this.rafId = requestAnimationFrame(this.loop);
        }
    }

    private getFrameAt(t: number): StandardPoseFrame | null {
        // Binary search or simple find? 
        // Optimization: remember last index.
        // Since we play forward, simple scan from last index is fine. 
        // For random seek, binary search is better.
        // Let's do a simple find for now, arrays are small (<1000 frames usually).

        // Find buffer: find frame with closest t <= currentT
        // or just the last one passed.

        // Simple implementation:
        // frames are sorted.
        // find i where frames[i].t_ms <= t and frames[i+1].t_ms > t

        // Optimization: use findLastIndex if available or reverse loop?
        // t is monotonic usually.

        // Let's use binary search for correctness on seek.
        let low = 0;
        let high = this.frames.length - 1;
        let idx = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.frames[mid].t_ms <= t) {
                idx = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return idx >= 0 ? this.frames[idx] : null;
    }
}
