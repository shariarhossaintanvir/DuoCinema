import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Subtitles,
  WifiOff,
} from 'lucide-react';
import { useRoom } from '@/context/RoomContext';
import {
  computeExpectedPosition,
  evaluateDrift,
  GENTLE_SPEED_FAST,
  GENTLE_SPEED_SLOW,
  NORMAL_SPEED,
} from '@/lib/syncEngine';
import { createSubtitleTrackFromFile, revokeSubtitleTrack } from '@/lib/subtitles';
import { SubtitleTrack, DriftReport } from '@/types/player';
import { formatDuration } from '@/lib/fingerprint';

export const VideoPlayer: React.FC = () => {
  const {
    media,
    playback,
    updatePlayback,
    localMedia,
    isFingerprintMatch,
    calibrator,
    isReconnecting,
    members,
    readiness,
  } = useRoom();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekbarRef = useRef<HTMLDivElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);

  // Local playback controls & preferences (persisted locally)
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('duocinema_volume');
    return saved !== null ? parseFloat(saved) : 1.0;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleTrack | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);

  // UI state
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [driftReport, setDriftReport] = useState<DriftReport | null>(null);

  // Anti-loop controller flags
  const isProgrammaticUpdateRef = useRef<boolean>(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserActionRef = useRef<number>(0);

  // Check if both users are ready
  const allReady = members.length >= 2 && members.every(m => {
    const r = readiness.find(rd => rd.user_id === m.user_id);
    return r?.is_ready === true;
  });

  // Handle local volume change
  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    if (clamped > 0 && isMuted) setIsMuted(false);
    localStorage.setItem('duocinema_volume', clamped.toString());
    if (videoRef.current) {
      videoRef.current.volume = clamped;
      videoRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (videoRef.current) {
      videoRef.current.muted = next;
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Subtitle selection
  const handleSubtitleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (activeSubtitle) {
        revokeSubtitleTrack(activeSubtitle);
      }
      const track = await createSubtitleTrackFromFile(file);
      setActiveSubtitle(track);
      setSubtitlesEnabled(true);
    } catch (err) {
      console.warn('Subtitle load error:', err);
    }
    if (subtitleInputRef.current) subtitleInputRef.current.value = '';
  };

  // Sync server-authoritative state to local player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback || !media || !localMedia || !isFingerprintMatch) return;

    const expectedPos = computeExpectedPosition(playback, media.duration_seconds, calibrator);
    const report = evaluateDrift(video.currentTime, expectedPos, isBuffering);
    setDriftReport(report);

    // 1. Synchronize Play/Pause
    if (playback.is_playing) {
      if (video.paused) {
        isProgrammaticUpdateRef.current = true;
        // Hard seek to expected position on play start
        if (Math.abs(video.currentTime - expectedPos) > 0.3) {
          video.currentTime = expectedPos;
        }

        video
          .play()
          .then(() => {
            setAutoplayBlocked(false);
          })
          .catch(err => {
            console.warn('Autoplay prevented by browser:', err);
            setAutoplayBlocked(true);
          })
          .finally(() => {
            setTimeout(() => {
              isProgrammaticUpdateRef.current = false;
            }, 100);
          });
      }
    } else {
      if (!video.paused) {
        isProgrammaticUpdateRef.current = true;
        video.pause();
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 100);
      }
      // On pause, align exact position if drifted
      if (Math.abs(video.currentTime - playback.position_seconds) > 0.4) {
        isProgrammaticUpdateRef.current = true;
        video.currentTime = playback.position_seconds;
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 100);
      }
    }

    // 2. Drift Correction while playing
    if (playback.is_playing && !video.paused) {
      if (report.syncStatus === 'seeking') {
        // Hard seek if drift > 1.0s
        isProgrammaticUpdateRef.current = true;
        video.currentTime = expectedPos;
        video.playbackRate = NORMAL_SPEED;
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 150);
      } else if (report.syncStatus === 'adjusting') {
        // Gentle rate adjustment if drift is between 0.25s and 1.0s
        video.playbackRate = report.diffSeconds > 0 ? GENTLE_SPEED_SLOW : GENTLE_SPEED_FAST;
      } else {
        // Synced
        if (video.playbackRate !== NORMAL_SPEED) {
          video.playbackRate = NORMAL_SPEED;
        }
      }
    }
  }, [playback, media, localMedia, isFingerprintMatch, calibrator, isBuffering]);

  // Periodic drift heartbeat check while video is playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback || !media || !playback.is_playing) return;

    const interval = setInterval(() => {
      const expectedPos = computeExpectedPosition(playback, media.duration_seconds, calibrator);
      const report = evaluateDrift(video.currentTime, expectedPos, isBuffering);
      setDriftReport(report);

      if (report.syncStatus === 'seeking') {
        isProgrammaticUpdateRef.current = true;
        video.currentTime = expectedPos;
        video.playbackRate = NORMAL_SPEED;
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 100);
      } else if (report.syncStatus === 'adjusting') {
        video.playbackRate = report.diffSeconds > 0 ? GENTLE_SPEED_SLOW : GENTLE_SPEED_FAST;
      } else {
        if (video.playbackRate !== NORMAL_SPEED) {
          video.playbackRate = NORMAL_SPEED;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [playback, media, calibrator, isBuffering]);

  // Clean up subtitle on unmount
  useEffect(() => {
    return () => {
      if (activeSubtitle) {
        revokeSubtitleTrack(activeSubtitle);
      }
    };
  }, [activeSubtitle]);

  // Player UI events
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  // User Actions: Play / Pause / Seek / Skip
  const handleUserPlayPause = () => {
    if (!allReady && !playback?.is_playing) {
      return; // Cannot play until both ready
    }
    const now = Date.now();
    if (now - lastUserActionRef.current < 200) return; // Throttle clicks
    lastUserActionRef.current = now;

    if (playback?.is_playing) {
      updatePlayback('pause', currentTime);
    } else {
      updatePlayback('play', currentTime);
    }
  };

  const handleUserSkip = (deltaSeconds: number) => {
    const now = Date.now();
    if (now - lastUserActionRef.current < 200) return;
    lastUserActionRef.current = now;

    updatePlayback('skip', deltaSeconds);
  };

  const handleSeekbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekbarRef.current || !duration) return;
    const rect = seekbarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * duration;

    const now = Date.now();
    if (now - lastUserActionRef.current < 200) return;
    lastUserActionRef.current = now;

    updatePlayback('seek', targetTime);
  };

  // Keyboard navigation when not typing in text input
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Never intercept when typing in input or textarea
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleUserPlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleUserSkip(-10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleUserSkip(10);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      }
    },
    [handleUserPlayPause, handleUserSkip, isMuted]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Controls visibility timeout
  const handleMouseMove = () => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (playback?.is_playing) {
        setIsControlsVisible(false);
      }
    }, 3000);
  };

  // Autoplay blocked retry
  const handleAutoplayUnlock = () => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => {});
    }
  };

  if (!localMedia) {
    return (
      <div
        className="card"
        style={{
          height: '420px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080a0d',
          border: '1px dashed var(--border-subtle)',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>
          No local movie selected.
        </div>
        <p className="text-sub" style={{ maxWidth: '400px' }}>
          Select the movie file on your device using the file selector below.
          Your video is played locally and never uploaded to any server.
        </p>
      </div>
    );
  }

  const progressRatio = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="video-player-container"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => playback?.is_playing && setIsControlsVisible(false)}
      tabIndex={0}
      aria-label="Video Player"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={localMedia.objectUrl}
        className="video-element"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
            setDuration(videoRef.current.duration || 0);
          }
        }}
        onClick={handleUserPlayPause}
      >
        {activeSubtitle && subtitlesEnabled && (
          <track
            default
            kind="subtitles"
            src={activeSubtitle.objectUrl}
            srcLang="en"
            label={activeSubtitle.label}
          />
        )}
      </video>

      {/* Autoplay block notification banner */}
      {autoplayBlocked && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'var(--accent)',
            color: '#ffffff',
            padding: '0.6rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
          }}
          onClick={handleAutoplayUnlock}
        >
          <Play size={16} fill="#ffffff" />
          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            Browser paused playback. Click here to resume.
          </span>
        </div>
      )}

      {/* Disconnected / Reconnecting banner */}
      {isReconnecting && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 30,
            background: 'rgba(245, 158, 11, 0.9)',
            color: '#000000',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <WifiOff size={14} />
          <span>Reconnecting...</span>
        </div>
      )}

      {/* Controls Overlay */}
      <div className={`player-controls-overlay ${!isControlsVisible && playback?.is_playing ? 'idle' : ''}`}>
        {/* Seekbar */}
        <div
          ref={seekbarRef}
          className="seekbar-container"
          onClick={handleSeekbarClick}
          title="Click to seek"
          role="slider"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-label="Movie timeline"
        >
          <div className="seekbar-track">
            <div className="seekbar-progress" style={{ width: `${progressRatio}%` }} />
            <div className="seekbar-thumb" style={{ left: `${progressRatio}%` }} />
          </div>
        </div>

        {/* Buttons Bar */}
        <div className="player-controls-bar">
          <div className="controls-left">
            {/* Play/Pause */}
            <button
              onClick={handleUserPlayPause}
              className="btn btn-icon"
              title={playback?.is_playing ? 'Pause for both (Space)' : allReady ? 'Play for both (Space)' : 'Waiting for both users to be Ready'}
              aria-label={playback?.is_playing ? 'Pause' : 'Play'}
              disabled={!allReady && !playback?.is_playing}
              style={{ color: '#ffffff' }}
            >
              {playback?.is_playing ? <Pause size={22} /> : <Play size={22} />}
            </button>

            {/* Skip Backward 10s */}
            <button
              onClick={() => handleUserSkip(-10)}
              className="btn btn-icon"
              title="Skip backward 10s (Left Arrow)"
              aria-label="Skip backward 10 seconds"
              style={{ color: '#ffffff' }}
            >
              <RotateCcw size={18} />
            </button>

            {/* Skip Forward 10s */}
            <button
              onClick={() => handleUserSkip(10)}
              className="btn btn-icon"
              title="Skip forward 10s (Right Arrow)"
              aria-label="Skip forward 10 seconds"
              style={{ color: '#ffffff' }}
            >
              <RotateCw size={18} />
            </button>

            {/* Time Display */}
            <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>{formatDuration(currentTime)}</span>
              <span style={{ margin: '0 0.3rem' }}>/</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="controls-right">
            {/* Sync Drift Indicator */}
            {driftReport && (
              <div
                className="mono"
                style={{
                  fontSize: '0.7rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor:
                    driftReport.syncStatus === 'synced'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(245, 158, 11, 0.2)',
                  color: driftReport.syncStatus === 'synced' ? '#6ee7b7' : '#fcd34d',
                }}
                title={`Clock offset: ${calibrator.getCalibration().serverOffsetMs}ms`}
              >
                Sync: {driftReport.syncStatus}
              </div>
            )}

            {/* Subtitle File Picker & Toggle */}
            <input
              type="file"
              ref={subtitleInputRef}
              onChange={handleSubtitleFile}
              accept=".srt,.vtt"
              style={{ display: 'none' }}
              id="subtitle-file-input"
            />
            <button
              onClick={() => {
                if (activeSubtitle) {
                  setSubtitlesEnabled(!subtitlesEnabled);
                } else {
                  subtitleInputRef.current?.click();
                }
              }}
              className="btn btn-icon"
              title={activeSubtitle ? (subtitlesEnabled ? 'Subtitles On (Click to hide)' : 'Subtitles Off (Click to show)') : 'Select Subtitle (.srt/.vtt)'}
              aria-label="Subtitles"
              style={{ color: activeSubtitle && subtitlesEnabled ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <Subtitles size={18} />
            </button>

            {/* Volume Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={toggleMute}
                className="btn btn-icon"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                aria-label="Mute toggle"
                style={{ color: '#ffffff' }}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                style={{ width: '65px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                aria-label="Volume slider"
              />
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="btn btn-icon"
              title="Fullscreen (F)"
              aria-label="Toggle Fullscreen"
              style={{ color: '#ffffff' }}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
