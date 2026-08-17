import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

// How often (ms) to report playback progress while the video is playing.
const PROGRESS_REPORT_INTERVAL_MS = 5000;

// Small forward tolerance (seconds) so normal playback isn't mistaken for a skip attempt.
const SEEK_TOLERANCE_SECONDS = 0.5;

interface VideoPlayerProps {
  src: string;
  title?: string;
  className?: string;
  /** Seconds to resume from (also treated as the furthest point already watched). */
  initialTime?: number;
  /** Called periodically while playing, on pause, and when the component unmounts. Reports the furthest position reached, never a rewound one. */
  onProgress?: (seconds: number) => void;
  /** Called once the video has played through to the end. */
  onComplete?: () => void;
}

// A deliberately restricted player: no visible seek bar, no playback-speed control,
// and forward seeking beyond the furthest-watched point is blocked. This exists for
// e-learning content where actual watch time must be genuine (subsidy/grant reporting).
export function VideoPlayer({ src, title, className, initialTime, onProgress, onComplete }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const hasSeekedRef = useRef(false);
  const maxTimeRef = useRef(0);
  const lastReportRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    hasSeekedRef.current = false;
    maxTimeRef.current = initialTime ?? 0;
    setProgressPct(0);
  }, [src, initialTime]);

  // Fullscreen can also be exited via Esc or a browser-native control, so the
  // button's icon/label is kept in sync by listening rather than only setting
  // state from our own toggle handler.
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video && onProgressRef.current && maxTimeRef.current > 0) {
        onProgressRef.current(maxTimeRef.current);
      }
    };
  }, [src]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = 1;
    if (!hasSeekedRef.current && initialTime && initialTime > 0 && initialTime < video.duration) {
      video.currentTime = initialTime;
    }
    hasSeekedRef.current = true;
  };

  // Blocks skipping ahead: snaps back to the furthest point already reached.
  const handleSeeking = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime > maxTimeRef.current + SEEK_TOLERANCE_SECONDS) {
      video.currentTime = maxTimeRef.current;
    }
  };

  // Belt-and-suspenders: forces the rate back to 1x if changed via keyboard shortcuts
  // or the browser's right-click menu (which is also disabled below).
  const handleRateChange = () => {
    const video = videoRef.current;
    if (video && video.playbackRate !== 1) {
      video.playbackRate = 1;
    }
  };

  const reportProgress = (force: boolean) => {
    const now = Date.now();
    if (!force && now - lastReportRef.current < PROGRESS_REPORT_INTERVAL_MS) return;
    lastReportRef.current = now;
    onProgressRef.current?.(maxTimeRef.current);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime > maxTimeRef.current) {
      maxTimeRef.current = video.currentTime;
    }
    if (video.duration) {
      setProgressPct((maxTimeRef.current / video.duration) * 100);
    }
    reportProgress(false);
  };

  const handleEnded = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      maxTimeRef.current = Math.max(maxTimeRef.current, video.duration);
      setProgressPct(100);
    }
    setIsPlaying(false);
    reportProgress(true);
    onCompleteRef.current?.();
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  // Fullscreen is requested on the container (not the <video> itself) so our
  // custom control bar keeps overlaying the video instead of being replaced
  // by the browser's native fullscreen video UI.
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      const request = container.requestFullscreen || (container as any).webkitRequestFullscreen;
      request?.call(container);
    } else {
      const exit = document.exitFullscreen || (document as any).webkitExitFullscreen;
      exit?.call(document);
    }
  };

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className={`relative bg-black overflow-hidden ${isFullscreen ? "w-screen h-screen" : "aspect-video rounded-lg"}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <video
          ref={videoRef}
          src={src}
          className={isFullscreen ? "w-full h-full object-contain" : "w-full h-full"}
          title={title}
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate noremoteplayback"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onSeeking={handleSeeking}
          onRateChange={handleRateChange}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            reportProgress(true);
          }}
          onEnded={handleEnded}
          onClick={togglePlay}
          data-testid="video-player-element"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-8 pb-2 flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="text-white hover:opacity-80 transition-opacity"
            aria-label={isPlaying ? "一時停止" : "再生"}
            data-testid="button-video-play-pause"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden pointer-events-none">
            <div className="h-full bg-white/90" style={{ width: `${progressPct}%` }} />
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="text-white hover:opacity-80 transition-opacity"
            aria-label={isMuted ? "ミュート解除" : "ミュート"}
            data-testid="button-video-mute"
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="text-white hover:opacity-80 transition-opacity"
            aria-label={isFullscreen ? "全画面を終了" : "全画面表示"}
            data-testid="button-video-fullscreen"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
