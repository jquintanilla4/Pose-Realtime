import * as mpHolistic from '@mediapipe/holistic';
import type { PoseAdapter, StandardPoseFrame, Person } from './types';

export class HolisticAdapter implements PoseAdapter {
    name = "MediaPipe Holistic";
    mode: "holistic" = "holistic";
    supportsMultiplePeople = false;
    maxPeople = 1;

    private holistic: mpHolistic.Holistic | null = null;

    async init(): Promise<void> {
        // Locate files locally from public/mediapipe
        this.holistic = new mpHolistic.Holistic({
            locateFile: (file) => {
                return `/mediapipe/${file}`;
            }
        });

        this.holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            refineFaceLandmarks: true
        });

        await this.holistic.initialize();
    }

    async estimate(video: HTMLVideoElement, nowMs: number): Promise<StandardPoseFrame> {
        if (!this.holistic) throw new Error("Holistic not initialized");

        // Holistic.send() is async but void. usage: holistic.onResults(callback).
        // This is a bit tricky to adapt to a promise-based "estimate()".
        // We can wrap it.

        return new Promise<StandardPoseFrame>((resolve) => {
            if (!this.holistic) return;

            // We need to set the callback for THIS specific frame.
            // NOTE: setting onResults repeatedly might be slow or unstable. 
            // Better: set onResults ONCE, and use a queue or a pending promise.
            // But for simplicity/robustness match:

            const onResults = (results: mpHolistic.Results) => {
                const person: Person = {
                    id: "p1",
                    keypoints: []
                };

                // Helper to convert normalized landmarks to Keypoints
                const addLandmarks = (landmarks: any, prefix: string) => {
                    if (!landmarks) return;
                    landmarks.forEach((lm: any, index: number) => {
                        person.keypoints.push({
                            x: lm.x,
                            y: lm.y,
                            z: lm.z,
                            score: lm.visibility, // Holistic uses visibility
                            name: `${prefix}_${index}`
                        });
                    });
                };

                // Helper for world landmarks (meters)
                // Note: Holistic provides worldLandmarks for pose only? 
                // Docs say: poseWorldLandmarks.

                addLandmarks(results.poseLandmarks, 'pose');
                addLandmarks(results.faceLandmarks, 'face');
                addLandmarks(results.leftHandLandmarks, 'left_hand');
                addLandmarks(results.rightHandLandmarks, 'right_hand');

                // Extract world landmarks if available
                // @ts-ignore -- poseWorldLandmarks exists at runtime but might be missing in some type definitions
                if (results.poseWorldLandmarks) {
                    // @ts-ignore
                    person.worldKeypoints = results.poseWorldLandmarks.map((lm: any, index: number) => ({
                        x: lm.x,
                        y: lm.y,
                        z: lm.z,
                        score: lm.visibility,
                        name: `pose_${index}`
                    }));
                }

                const frame: StandardPoseFrame = {
                    t_ms: nowMs,
                    mode: 'holistic',
                    people: [person] // Always 1 person or empty? If no detection, results lists might be empty/null.
                };

                // If nothing detected, keypoints will be empty.
                // We still resolve.
                resolve(frame);
            };

            // Set the callback
            this.holistic.onResults(onResults);

            // Process
            this.holistic.send({ image: video });
        });
    }

    dispose(): void {
        if (this.holistic) {
            this.holistic.close();
            this.holistic = null;
        }
    }
}
