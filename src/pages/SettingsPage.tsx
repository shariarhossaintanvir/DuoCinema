import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Film, Subtitles, HelpCircle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '820px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Link to="/" className="btn btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem' }}>
          <ArrowLeft size={15} />
          <span>Dashboard</span>
        </Link>
        <h1 className="text-h1" style={{ fontSize: '1.5rem' }}>
          Help & Local File Privacy
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Privacy Manifesto */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <ShieldCheck size={20} style={{ color: 'var(--success)' }} />
            <h2 className="text-h2" style={{ fontSize: '1.15rem' }}>
              Zero-Upload Architecture & Privacy Manifesto
            </h2>
          </div>
          <p className="text-sub" style={{ marginBottom: '1rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
            DuoCinema is built from the ground up to protect your privacy and bandwidth.
            Traditional watch parties upload video files to cloud storage or transcode streams through expensive servers.
            DuoCinema does <strong>neither</strong>.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                ✓ Never Leaves Your Machine
              </div>
              <ul style={{ paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <li>Movie video frames and audio streams.</li>
                <li>Local file system paths or folder names.</li>
                <li>Subtitle file contents (.srt, .vtt).</li>
                <li>Personal files or media bytes.</li>
              </ul>
            </div>

            <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                Synced Room Metadata Only
              </div>
              <ul style={{ paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <li>Room code and room title.</li>
                <li>Approved user display names.</li>
                <li>Movie filename, duration, and cryptographic SHA-256 fingerprint.</li>
                <li>Play, pause, seek timestamps, and chat messages.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Video Codecs & Compatibility */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <Film size={20} style={{ color: 'var(--accent)' }} />
            <h2 className="text-h2" style={{ fontSize: '1.15rem' }}>
              Recommended Video Formats & Codecs
            </h2>
          </div>
          <p className="text-sub" style={{ marginBottom: '0.75rem', color: 'var(--text-main)' }}>
            Because playback happens directly in your web browser via standard HTML5 video, your browser determines which video/audio codecs can decode smoothly.
          </p>

          <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
              Gold Standard: MP4 (H.264 + AAC)
            </div>
            <p className="text-sub" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
              Guaranteed universal hardware decoding across Windows, macOS, Linux, Chrome, Edge, and Firefox.
            </p>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-main)' }}>Note on MKV / AC3 Audio:</strong> If you select an .mkv file and observe smooth video but silent audio, the file likely contains an AC-3 or DTS audio stream that desktop browsers cannot decode natively. You can quickly remux or convert audio to AAC using tools like HandBrake or ffmpeg:
            <pre
              className="mono"
              style={{
                background: '#090b0e',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                color: 'var(--text-main)',
                margin: '0.5rem 0',
                overflowX: 'auto',
              }}
            >
ffmpeg -i movie.mkv -c:v copy -c:a aac movie.mp4
            </pre>
          </div>
        </div>

        {/* Subtitles & Bangla Support */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <Subtitles size={20} style={{ color: 'var(--accent)' }} />
            <h2 className="text-h2" style={{ fontSize: '1.15rem' }}>
              Subtitles & Bengali Unicode Support (বাংলা সাবটাইটেল)
            </h2>
          </div>
          <p className="text-sub" style={{ marginBottom: '0.75rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
            DuoCinema includes an integrated local subtitle engine supporting both <code className="mono">.srt</code> and <code className="mono">.vtt</code> formats.
          </p>
          <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <li><strong>Local Preference:</strong> Each viewer selects their own subtitle file locally. Your friend can watch with subtitles while you watch without them, or vice versa.</li>
            <li><strong>Unicode / Bangla:</strong> Full UTF-8 rendering supports Bengali typography and complex scripts without mojibake (encoding errors).</li>
            <li><strong>Safe Execution:</strong> All subtitle lines are sanitized to remove dangerous HTML markup or executable scripts.</li>
          </ul>
        </div>

        {/* Troubleshooting */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <HelpCircle size={20} style={{ color: 'var(--accent)' }} />
            <h2 className="text-h2" style={{ fontSize: '1.15rem' }}>
              Troubleshooting FAQ
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                Q: Why does it say "File Mismatch / Fingerprint does not match"?
              </div>
              <p>
                DuoCinema verifies that both viewers have the identical file cut before allowing synchronized playback. If one user has a theatrical cut and the other an extended edition, or if one file was re-encoded, timestamps and scenes will not align. Verify with your partner that both files originated from the same source.
              </p>
            </div>

            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                Q: Why do I have to select my file again after refreshing?
              </div>
              <p>
                For security reasons, web browsers do not allow websites to retain persistent filesystem access to your private files across browser sessions. When you refresh or rejoin a room, simply click "Select Local Movie" to pick the file again.
              </p>
            </div>

            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                Q: Autoplay was blocked by my browser. What should I do?
              </div>
              <p>
                Modern browsers restrict audio playback until you interact with the page. If autoplay is prevented, click the "Browser paused playback. Click here to resume" banner on the player.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
