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

    init(): Promise<void>;
    estimate(video: HTMLVideoElement, nowMs: number): Promise<StandardPoseFrame>;
    dispose(): void;
}
