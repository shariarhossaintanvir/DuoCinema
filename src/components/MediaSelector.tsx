import React, { useState, useRef } from 'react';
import { Film, CheckCircle, AlertCircle, RefreshCw, X, FileVideo } from 'lucide-react';
import { useRoom } from '@/context/RoomContext';
import { computeFileFingerprint, formatDuration, formatBytes } from '@/lib/fingerprint';
import { LocalMediaFile } from '@/types/player';

export const MediaSelector: React.FC = () => {
  const {
    media,
    localMedia,
    setLocalMediaFile,
    removeLocalMediaFile,
    proposeNewMedia,
    isFingerprintMatch,
    mediaMismatchReason,
    playback,
  } = useRoom();

  const [isHashing, setIsHashing] = useState<boolean>(false);
  const [hashProgress, setHashProgress] = useState<number>(0);
  const [codecWarning, setCodecWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setCodecWarning(null);
    setIsHashing(true);
    setHashProgress(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 1. Create temporary object URL to read metadata & check codec
      const tempUrl = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';

      // Check codec playability
      const mime = file.type || 'video/mp4';
      const playability = tempVideo.canPlayType(mime);
      if (playability === '') {
        setCodecWarning(`Your browser may not natively support the codec in '${file.name}'. If playback fails, convert to H.264/AAC MP4.`);
      }

      const duration = await new Promise<number>((resolve, reject) => {
        tempVideo.onloadedmetadata = () => {
          const dur = tempVideo.duration;
          if (isNaN(dur) || dur <= 0) {
            reject(new Error('Unable to read video duration. Ensure file is a valid video format.'));
          } else {
            resolve(dur);
          }
        };
        tempVideo.onerror = () => {
          reject(new Error('Browser failed to load video metadata. The format may be unsupported.'));
        };
        tempVideo.src = tempUrl;
      });

      // 2. Compute incremental chunked fingerprint
      const fingerprint = await computeFileFingerprint(
        file,
        duration,
        progress => setHashProgress(Math.round(progress * 100)),
        abortController.signal
      );

      const mediaFile: LocalMediaFile = {
        file,
        objectUrl: tempUrl,
        fingerprint,
        duration,
        size: file.size,
        name: file.name,
        type: mime,
      };

      setLocalMediaFile(mediaFile);
      setIsHashing(false);
    } catch (err: unknown) {
      if ((err as Error)?.message === 'Fingerprinting cancelled') {
        setError('File selection was cancelled.');
      } else {
        setError((err as Error)?.message || 'Failed to inspect selected video file.');
      }
      setIsHashing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCancelHashing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsHashing(false);
  };

  const handleProposeMovie = async () => {
    if (!localMedia) return;
    await proposeNewMedia(
      localMedia.name,
      localMedia.fingerprint,
      localMedia.duration,
      localMedia.size
    );
  };

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Film size={20} style={{ color: 'var(--accent)' }} />
          <h2 className="text-h2" style={{ fontSize: '1.1rem' }}>
            Local Movie File
          </h2>
        </div>

        {media && (
          <span className="badge badge-neutral mono" style={{ fontSize: '0.75rem' }}>
            Media v{media.media_version}
          </span>
        )}
      </div>

      {/* Target room movie requirements if already set */}
      {media && (
        <div
          style={{
            background: 'var(--bg-app)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Room Target Movie
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                {media.title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Duration: {formatDuration(media.duration_seconds)} • Size: {formatBytes(media.file_size_bytes)}
              </div>
            </div>

            <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'right' }}>
              FP: {media.fingerprint.slice(0, 12)}...
            </div>
          </div>
        </div>
      )}

      {/* Local file details or picker */}
      {!localMedia && !isHashing && (
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*,.mp4,.mkv,.webm,.m4v,.mov"
            style={{ display: 'none' }}
            id="local-movie-input"
          />
          <label
            htmlFor="local-movie-input"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', cursor: 'pointer' }}
          >
            <FileVideo size={18} />
            <span>Select Local Movie</span>
          </label>
          <p className="text-sub" style={{ fontSize: '0.75rem', marginTop: '0.5rem', textAlign: 'center' }}>
            Direct browser playback via object URL. Movie bytes are never uploaded.
          </p>
        </div>
      )}

      {/* Hashing progress state */}
      {isHashing && (
        <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
              Verifying file content fingerprint...
            </span>
            <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>
              {hashProgress}%
            </span>
          </div>

          <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: `${hashProgress}%`,
                height: '100%',
                backgroundColor: 'var(--accent)',
                transition: 'width 100ms linear',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleCancelHashing} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Selected Local File Summary */}
      {localMedia && !isHashing && (
        <div
          style={{
            background: 'var(--bg-app)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                {localMedia.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Duration: {formatDuration(localMedia.duration)} • Size: {formatBytes(localMedia.size)}
              </div>
              <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                Fingerprint: {localMedia.fingerprint.slice(0, 16)}...
              </div>
            </div>

            <button
              onClick={removeLocalMediaFile}
              className="btn-icon"
              title="Reselect Local File"
              aria-label="Remove and reselect file"
            >
              <X size={16} />
            </button>
          </div>

          {/* Match validation banner */}
          {media && (
            <div style={{ marginTop: '0.75rem' }}>
              {isFingerprintMatch ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', fontSize: '0.85rem' }}>
                  <CheckCircle size={16} />
                  <span>Fingerprint Matched. Ready for synchronized playback!</span>
                </div>
              ) : (
                <div className="alert alert-danger" style={{ margin: '0.5rem 0', padding: '0.5rem 0.75rem' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>File Mismatch</div>
                    <div style={{ fontSize: '0.8rem' }}>{mediaMismatchReason}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Propose movie button (if room has no movie or paused) */}
          {(!media || (!playback?.is_playing && !isFingerprintMatch)) && (
            <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <button
                onClick={handleProposeMovie}
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} />
                <span>Propose This File as Room Movie</span>
              </button>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.35rem', textAlign: 'center' }}>
                Resets playback and readiness for both participants.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Codec warning */}
      {codecWarning && (
        <div className="alert alert-warning" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{codecWarning}</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="alert alert-danger" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
