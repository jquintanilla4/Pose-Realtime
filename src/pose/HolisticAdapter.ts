import * as mpHolistic from '@mediapipe/holistic';
import type { PoseAdapter, StandardPoseFrame, Person, QualityMode } from './types';

export class HolisticAdapter implements PoseAdapter {
    name = "MediaPipe Holistic";
    mode = "holistic" as const;
    supportsMultiplePeople = false;
    maxPeople = 1;

    private holistic: mpHolistic.Holistic | null = null;
    private pending: {
        nowMs: number;
        resolve: (frame: StandardPoseFrame) => void;
        reject: (err: unknown) => void;
    } | null = null;

    async init(quality: QualityMode): Promise<void> {
        // Locate files locally from public/mediapipe
        this.holistic = new mpHolistic.Holistic({
            locateFile: (file) => {
                return `/mediapipe/${file}`;
            }
        });

        this.holistic.setOptions({
            // Model complexity: 0 = lite (fastest), 1 = full (balanced), 2 = heavy (most accurate)
            // 'quality' mode uses complexity 2 for best accuracy at the cost of speed
            // 'fast' mode uses complexity 1 for a good balance of speed and accuracy
            modelComplexity: quality === 'quality' ? 2 : 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            // refineFaceLandmarks enables 478 face landmarks (including iris tracking)
            // instead of the base 468 landmarks - always enabled for maximum detail
            refineFaceLandmarks: true
        });

        // Set onResults once; each estimate() call awaits the next result.
        this.holistic.onResults((results: mpHolistic.Results) => {
            const pending = this.pending;
            if (!pending) return;
            this.pending = null;

            try {
                const person: Person = { id: "p1", keypoints: [] };

                const addLandmarks = (landmarks: mpHolistic.NormalizedLandmarkList | undefined, prefix: string) => {
                    if (!landmarks) return;
                    landmarks.forEach((lm, index) => {
                        person.keypoints.push({
                            x: lm.x,
                            y: lm.y,
                            z: lm.z,
                            score: lm.visibility ?? 1,
                            name: `${prefix}_${index}`
                        });
                    });
                };

                addLandmarks(results.poseLandmarks, 'pose');
                addLandmarks(results.faceLandmarks, 'face');
                addLandmarks(results.leftHandLandmarks, 'left_hand');
                addLandmarks(results.rightHandLandmarks, 'right_hand');

                // poseWorldLandmarks isn't part of the typed Results surface in older builds.
                const poseWorldLandmarks = (results as unknown as { poseWorldLandmarks?: mpHolistic.LandmarkList }).poseWorldLandmarks;
                if (poseWorldLandmarks) {
                    person.worldKeypoints = poseWorldLandmarks.map((lm, index) => ({
                        x: lm.x,
                        y: lm.y,
                        z: lm.z,
                        score: (lm as unknown as { visibility?: number }).visibility ?? 1,
                        name: `pose_${index}`
                    }));
                }

                pending.resolve({
                    t_ms: pending.nowMs,
                    mode: 'holistic',
                    people: person.keypoints.length > 0 ? [person] : []
                });
            } catch (err) {
                pending.reject(err);
            }
        });

        await this.holistic.initialize();
    }

    async estimate(video: HTMLVideoElement, nowMs: number): Promise<StandardPoseFrame> {
        if (!this.holistic) throw new Error("Holistic not initialized");

        // If a previous call never received a result, unblock it so the main loop can't deadlock.
        if (this.pending) {
            this.pending.resolve({ t_ms: this.pending.nowMs, mode: 'holistic', people: [] });
            this.pending = null;
        }

        return new Promise<StandardPoseFrame>((resolve, reject) => {
            if (!this.holistic) return reject(new Error("Holistic not initialized"));
            this.pending = { nowMs, resolve, reject };

            // Kick off processing for this frame; onResults resolves the pending promise.
            this.holistic.send({ image: video }).catch((err) => {
                if (this.pending?.resolve === resolve) this.pending = null;
                reject(err);
            });
        });
    }

    dispose(): void {
        if (this.holistic) {
            if (this.pending) {
                this.pending.resolve({ t_ms: this.pending.nowMs, mode: 'holistic', people: [] });
                this.pending = null;
            }
            this.holistic.close();
            this.holistic = null;
        }
    }
}
