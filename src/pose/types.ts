export interface Keypoint {
    x: number;
    y: number;
    z?: number;
    score?: number;
    name?: string;
}

export interface WorldKeypoint {
    x: number;
    y: number;
    z: number;
    score?: number;
    name?: string;
}

export interface Person {
    id: string; // "p1", "p2", etc.
    keypoints: Keypoint[];
    worldKeypoints?: WorldKeypoint[];
    score?: number;
}

export type PoseMode = 'holistic' | 'movenet';

/**
 * Quality mode affects the accuracy vs speed trade-off for pose estimation.
 * - 'fast': Lower latency, suitable for real-time applications
 * - 'quality': Higher accuracy, but slower processing (uses more complex models)
 */
export type QualityMode = 'fast' | 'quality';

export interface StandardPoseFrame {
    t_ms: number;
    mode: PoseMode;
    people: Person[];
}

export interface PoseAdapter {
    name: string;
    mode: PoseMode;
    supportsMultiplePeople: boolean;
    maxPeople: number;

    /**
     * Initialize the pose detection model.
     * @param quality - 'fast' for speed-optimized or 'quality' for accuracy-optimized models
     */
    init(quality: QualityMode): Promise<void>;
    estimate(video: HTMLVideoElement, nowMs: number): Promise<StandardPoseFrame>;
    dispose(): void;
}
