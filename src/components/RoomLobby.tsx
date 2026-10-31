import React, { useState } from 'react';
import { Copy, Check, Users, Wifi, WifiOff, CheckCircle2, Clock } from 'lucide-react';
import { useRoom } from '@/context/RoomContext';
import { useAuth } from '@/context/AuthContext';

export const RoomLobby: React.FC = () => {
  const {
    room,
    members,
    media,
    readiness,
    localMedia,
    isFingerprintMatch,
    setReadiness,
    isReconnecting,
  } = useRoom();
  const { user } = useAuth();
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyLink = () => {
    if (!room) return;
    const url = `${window.location.origin}/room/${room.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUserOnline = (lastSeenAt: string) => {
    const diffMs = Date.now() - new Date(lastSeenAt).getTime();
    return diffMs < 45000; // active in last 45s
  };

  const currentMemberReadiness = readiness.find(r => r.user_id === user?.id)?.is_ready || false;
  const allReady = members.length >= 2 && members.every(m => {
    const r = readiness.find(rd => rd.user_id === m.user_id);
    return r?.is_ready === true;
  });

  const canToggleReady = !!(media && localMedia && isFingerprintMatch);

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Users size={20} style={{ color: 'var(--accent)' }} />
          <h2 className="text-h2" style={{ fontSize: '1.1rem' }}>
            Room Lobby ({members.length}/2)
          </h2>
        </div>

        {room && (
          <button
            onClick={handleCopyLink}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            title="Copy Invitation Link"
          >
            {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
            <span>{copied ? 'Link Copied' : `Invite Code: ${room.code}`}</span>
          </button>
        )}
      </div>

      {isReconnecting && (
        <div className="alert alert-warning" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
          <WifiOff size={16} />
          <span>Reconnecting to room Realtime channel...</span>
        </div>
      )}

      {/* Participants List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {members.map(member => {
          const isMe = member.user_id === user?.id;
          const isReady = readiness.find(r => r.user_id === member.user_id)?.is_ready || false;
          const online = isUserOnline(member.last_seen_at);

          return (
            <div
              key={member.user_id}
              style={{
                background: 'var(--bg-app)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: isMe ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  {member.display_name} {isMe && '(You)'}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                  {online ? (
                    <span title="Online"><Wifi size={13} style={{ color: 'var(--success)' }} /></span>
                  ) : (
                    <span title="Idle"><WifiOff size={13} style={{ color: 'var(--text-dim)' }} /></span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status:</span>
                {isReady ? (
                  <span className="badge badge-ready">
                    <CheckCircle2 size={12} />
                    <span>Ready</span>
                  </span>
                ) : (
                  <span className="badge badge-waiting">
                    <Clock size={12} />
                    <span>Not Ready</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {members.length < 2 && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed var(--border-subtle)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '80px',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Waiting for friend to join
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Share invitation code with your partner
            </span>
          </div>
        )}
      </div>

      {/* Ready Action Bar */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          {allReady ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 500 }}>
              ✓ Both participants ready. Shared playback unlocked.
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {!media
                ? 'Select and propose a local movie first.'
                : !localMedia
                ? 'Select your matching local movie file.'
                : !isFingerprintMatch
                ? 'Fingerprint must match room movie.'
                : 'Click Ready when you are set to watch.'}
            </div>
          )}
        </div>

        <button
          onClick={() => setReadiness(!currentMemberReadiness)}
          disabled={!canToggleReady}
          className={`btn ${currentMemberReadiness ? 'btn-secondary' : 'btn-primary'}`}
          style={{ minWidth: '130px' }}
        >
          {currentMemberReadiness ? 'Cancel Ready' : "I'm Ready"}
        </button>
      </div>
    </div>
  );
};
