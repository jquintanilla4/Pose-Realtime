import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import type { PoseAdapter, StandardPoseFrame, Person, Keypoint, QualityMode } from './types';

export class MoveNetAdapter implements PoseAdapter {
    name = "MoveNet MultiPose";
    mode = "movenet" as const;
    supportsMultiplePeople = true;
    maxPeople = 6;

    private detector: poseDetection.PoseDetector | null = null;

    async init(quality: QualityMode): Promise<void> {
        // Explicitly set backend as requested
        await tf.setBackend('webgl');
        await tf.ready();

        const model = poseDetection.SupportedModels.MoveNet;
        const detectorConfig = {
            // MoveNet MultiPose Lightning - optimized for detecting multiple people
            // Note: There's no MultiPose Thunder variant, only SinglePose Thunder exists
            modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
            enableSmoothing: true,
            // multiPoseMaxDimension controls the input resolution for pose detection
            // Higher values = more accurate detection but slower processing
            // Range: 128-512 (must be multiple of 32)
            // 'quality' mode: 512px for better accuracy with distant/small subjects
            // 'fast' mode: 256px (default) for real-time performance
            multiPoseMaxDimension: quality === 'quality' ? 512 : 256,
        };
        this.detector = await poseDetection.createDetector(model, detectorConfig);
    }

    async estimate(video: HTMLVideoElement, nowMs: number): Promise<StandardPoseFrame> {
        if (!this.detector) throw new Error("Detector not initialized");

        const poses = await this.detector.estimatePoses(video, {
            maxPoses: this.maxPeople,
            flipHorizontal: false
        });

        const people: Person[] = poses.map((pose, index) => {
            const keypoints: Keypoint[] = pose.keypoints.map(kp => ({
                x: kp.x / video.videoWidth, // MoveNet returns pixels, normalize to 0..1
                y: kp.y / video.videoHeight,
                score: kp.score,
                name: kp.name
            }));

            const worldKeypoints = pose.keypoints3D?.map((kp) => ({
                x: kp.x,
                y: kp.y,
                z: kp.z ?? 0,
                score: kp.score,
                name: kp.name
            }));

            return {
                id: (pose.id !== undefined) ? pose.id.toString() : `p${index}`,
                keypoints,
                worldKeypoints,
                score: pose.score
            };
        });

        return {
            t_ms: nowMs,
            mode: 'movenet',
            people
        };
    }

    dispose(): void {
        if (this.detector) {
            this.detector.dispose();
            this.detector = null;
        }
    }
}
