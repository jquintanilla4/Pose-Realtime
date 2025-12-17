import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

interface VideoCanvasProps {
    onVideoReady?: (video: HTMLVideoElement) => void;
    onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export const VideoCanvas = forwardRef<HTMLVideoElement, VideoCanvasProps>(({ onVideoReady, onCanvasReady }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
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
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!video || !canvas || !container) return;

        const resize = () => {
            // Prefer the actual video source resolution when available.
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
                if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
                return;
            }

            // Fallback: size canvas to the rendered container so it's never 0x0.
            const rect = container.getBoundingClientRect();
            const w = Math.max(1, Math.floor(rect.width));
            const h = Math.max(1, Math.floor(rect.height));
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
        };

        const scheduleResize = () => {
            requestAnimationFrame(resize);
        };

        // Keep canvas dimensions in sync with layout changes.
        // ResizeObserver is widely supported, but guard just in case.
        const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(scheduleResize) : null;
        ro?.observe(container);
        if (!ro) window.addEventListener('resize', scheduleResize);

        video.addEventListener('loadedmetadata', scheduleResize);
        video.addEventListener('playing', scheduleResize);

        scheduleResize();

        return () => {
            ro?.disconnect();
            if (!ro) window.removeEventListener('resize', scheduleResize);
            video.removeEventListener('loadedmetadata', scheduleResize);
            video.removeEventListener('playing', scheduleResize);
        };
    }, []);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: '1280px', margin: '0 auto', aspectRatio: '16/9', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
            <video
                ref={videoRef}
                playsInline
                autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                muted
            />
            <canvas
                ref={canvasRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
            />
        </div>
    );
});
