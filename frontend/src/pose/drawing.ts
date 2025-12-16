import type { StandardPoseFrame, Keypoint } from './types';
import * as mpHolistic from '@mediapipe/holistic';
import * as poseDetection from '@tensorflow-models/pose-detection';

// MoveNet connections (COCO 17 keypoints)
// We can borrow from pose-detection or define manually.
// COCO Keypoints: 0:nose, 1:left_eye, 2:right_eye, 3:left_ear, 4:right_ear, 5:left_shoulder, 6:right_shoulder, 7:left_elbow, 8:right_elbow, 9:left_wrist, 10:right_wrist, 11:left_hip, 12:right_hip, 13:left_knee, 14:right_knee, 15:left_ankle, 16:right_ankle
const MOVENET_CONNECTIONS = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);

export function drawFrame(ctx: CanvasRenderingContext2D, frame: StandardPoseFrame, width: number, height: number) {
    ctx.clearRect(0, 0, width, height);

    // Choose connections based on mode
    // Note: Holistic adapter might return different sets of keypoints flattened or structured?
    // In my HolisticAdapter I flattened them into one big list with names like 'pose_0', 'face_1', etc.
    // This makes drawing connections tricky if we don't have the original structure or a map.

    // Refactor thought: maybe StandardPoseFrame should keep them separated? 
    // The requirements said: "Standardize skeleton format so both modes plug in."
    // And "Recorded frame schema... people: [ { keypoints: ... } ]"

    // If I flattened them, I need to know which index is which.
    // For Holistic, my adapter adds them in order: pose, face, left_hand, right_hand.
    // But the counts are variable? No, holistic output is fixed count usually.

    // To keep it simple and robust:
    // Let's just draw points for now, or try to infer.
    // Actually, for "Max detail", drawing the mesh is nice.

    // Let's rely on the 'name' field I added?
    // Parsing 'pose_5' -> 'pose_6' connection.

    // Alternative: Just draw points.
    // Requirement: "Draw an overlay skeleton".

    // Let's implement a simple drawer that draws points and, if it's MoveNet, draws known connections.
    // For Holistic, drawing 468 face points + hands + pose is a lot of lines.
    // I will implement a "smart" drawer.

    frame.people.forEach(person => {
        // 1. Draw Points

        // Sort Keypoints by body part?
        // We can iterate keypoints.

        const keypointsByName = new Map<string, Keypoint>();
        person.keypoints.forEach(kp => {
            if (kp.name) keypointsByName.set(kp.name, kp);
        });

        // Draw Intepolated lines?
        // If mode is MoveNet, use MOVENET_CONNECTIONS (which uses indices 0..16)
        if (frame.mode === 'movenet') {
            // MoveNet keypoints usually have names like 'nose', 'left_eye' etc in TFJS, 
            // OR just indices. My Adapter preserved names from TFJS if available.
            // TFJS returns names like "left_shoulder".
            // But getAdjacentPairs returns indices.
            // We need to map indices to points.
            // In MoveNetAdapter, I pushed them in order 0..16.

            MOVENET_CONNECTIONS.forEach(([i, j]) => {
                const kp1 = person.keypoints[i];
                const kp2 = person.keypoints[j];
                if (kp1 && kp2 && (kp1.score || 0) > 0.3 && (kp2.score || 0) > 0.3) {
                    drawLine(ctx, kp1, kp2, width, height, 'cyan');
                }
            });

            person.keypoints.forEach(kp => {
                if ((kp.score || 0) > 0.3) drawPoint(ctx, kp, width, height, 'red');
            });
        } else {
            // Holistic
            // We stored them with prefixes: pose_I, face_I, left_hand_I, right_hand_I

            // Draw Pose Connections
            // POSE_CONNECTIONS is array of [i, j]. 
            // We need to map 'pose_i' and 'pose_j'.
            drawConnections(ctx, person.keypoints, mpHolistic.POSE_CONNECTIONS, 'pose', width, height, 'white');
            drawConnections(ctx, person.keypoints, mpHolistic.HAND_CONNECTIONS, 'left_hand', width, height, 'orange');
            drawConnections(ctx, person.keypoints, mpHolistic.HAND_CONNECTIONS, 'right_hand', width, height, 'orange');
            // Face is too detailed to draw all connections usually, just draw points or contour?
            // FACEMESH_TESSELATION is huge.
            // Let's just draw face points small.
            person.keypoints.filter(k => k.name?.startsWith('face')).forEach(kp => {
                drawPoint(ctx, kp, width, height, 'rgba(200,200,200,0.5)', 0.5);
            });
        }
    });
}

function drawConnections(
    ctx: CanvasRenderingContext2D,
    keypoints: Keypoint[],
    connections: any[],
    prefix: string,
    w: number,
    h: number,
    color: string
) {
    // Build a map for fast lookup? Or just find?
    // Optimization: Keypoints are a list.
    // We need to find "prefix_i".
    // This is O(N*M). N=33, M=connections. Fast enough.

    // Better: Filter keypoints by prefix first, maintain index?
    // In HolisticAdapter, I pushed them in order.
    // pose keypoints are indices 0..32 in the "pose" group.

    // Let's create a lookup by name.
    const kpMap = new Map<string, Keypoint>();
    keypoints.forEach(kp => {
        if (kp.name) kpMap.set(kp.name, kp);
    });

    connections.forEach(([i, j]) => {
        const kp1 = kpMap.get(`${prefix}_${i}`);
        const kp2 = kpMap.get(`${prefix}_${j}`);
        if (kp1 && kp2 && (kp1.score ?? 1) > 0.5 && (kp2.score ?? 1) > 0.5) {
            drawLine(ctx, kp1, kp2, w, h, color);
        }
    });
}

function drawLine(ctx: CanvasRenderingContext2D, kp1: Keypoint, kp2: Keypoint, w: number, h: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(kp1.x * w, kp1.y * h);
    ctx.lineTo(kp2.x * w, kp2.y * h);
    ctx.stroke();
}

function drawPoint(ctx: CanvasRenderingContext2D, kp: Keypoint, w: number, h: number, color: string, r = 2) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(kp.x * w, kp.y * h, r, 0, 2 * Math.PI);
    ctx.fill();
}
