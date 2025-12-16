import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

interface VideoCanvasProps {
    onVideoReady?: (video: HTMLVideoElement) => void;
    onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export const VideoCanvas = forwardRef<HTMLVideoElement, VideoCanvasProps>(({ onVideoReady, onCanvasReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

    useEffect(() => {
        if (videoRef.current && onVideoReady) {
            onVideoReady(videoRef.current);
        }
    }, [onVideoReady]);

    useEffect(() => {
        if (canvasRef.current && onCanvasReady) {
            onCanvasReady(canvasRef.current);
        }
    }, [onCanvasReady]);

    // Handle resizing
    useEffect(() => {
        const resize = () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas) {
                // Match canvas size to video display size
                const rect = video.getBoundingClientRect();
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;
                // Match internal resolution to video source resolution (for high quality drawing)
                // OR match to storage resolution?
                // Let's match typical display or video source?
                // Best: Match source resolution for 1:1 overlay, let CSS handle scaling.
                if (video.videoWidth) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }
            }
        };

        window.addEventListener('resize', resize);
        const video = videoRef.current;
        if (video) {
            video.addEventListener('loadedmetadata', resize);
        }

        return () => {
            window.removeEventListener('resize', resize);
            if (video) video.removeEventListener('loadedmetadata', resize);
        };
    }, []);

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: '1280px', margin: '0 auto', aspectRatio: '16/9', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
            <video
                ref={videoRef}
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                muted
            />
            <canvas
                ref={canvasRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            />
        </div>
    );
});
