import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { clsx } from "clsx";

interface VideoPreviewProps {
  path: string;
  name: string;
}

function getMediaUrl(filePath: string): string {
  const encoded = encodeURIComponent(filePath);
  return `media://localhost/${encoded}`;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPreview({ path, name }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("explorer-video-volume");
    return saved ? parseFloat(saved) : 0.7;
  });
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const src = getMediaUrl(path);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);
  }, [path]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
    localStorage.setItem("explorer-video-volume", String(volume));
  }, [volume]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    const bar = progressRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
  }, [duration]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 2500);
  }, [playing]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (videoRef.current) videoRef.current.muted = !m;
      return !m;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      v.requestFullscreen();
    }
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="h-full flex flex-col overflow-hidden bg-black/40"
      onMouseMove={scheduleHide}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
    >
      {/* Video area */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          key={path}
          preload="metadata"
          className="max-w-full max-h-full"
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            setLoading(false);
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setShowControls(true); }}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
        >
          <source src={src} />
        </video>

        {/* Loading spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Play/pause overlay */}
        {!loading && showControls && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={clsx(
              "w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center transition-opacity",
              playing ? "opacity-0" : "opacity-100"
            )}>
              <Play size={24} className="text-white ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className={clsx(
        "shrink-0 transition-opacity duration-200",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="h-1 bg-white/20 cursor-pointer group hover:h-1.5 transition-all"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-accent transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-sm">
          <button onClick={togglePlay} className="text-white hover:text-accent transition-colors">
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <span className="text-[var(--font-xs)] text-white/70 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
              {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
              className="w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors">
            <Maximize size={14} />
          </button>
        </div>
      </div>

      {/* File name */}
      <div className="shrink-0 px-4 py-1.5 bg-bg-secondary border-t border-border">
        <p className="text-[var(--font-sm)] text-text-muted truncate">{name}</p>
      </div>
    </div>
  );
}
