import React, { useState, useEffect } from 'react';
import { History, ArrowRight, Trash2, Info } from 'lucide-react';
import { getRecentSessions, removeRecentSession } from '@/lib/recentSessions';
import { RecentSession } from '@/types/database';

interface RecentSessionsListProps {
  onSelectRoom: (code: string) => void;
}

export const RecentSessionsList: React.FC<RecentSessionsListProps> = ({ onSelectRoom }) => {
  const [sessions, setSessions] = useState<RecentSession[]>([]);

  const refreshList = () => {
    setSessions(getRecentSessions());
  };

  useEffect(() => {
    refreshList();
  }, []);

  const handleRemove = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSession(code);
    refreshList();
  };

  if (sessions.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <History size={18} style={{ color: 'var(--accent)' }} />
        <h2 className="text-h2" style={{ fontSize: '1.05rem' }}>
          Recent Sessions
        </h2>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          marginBottom: '1rem',
          background: 'var(--bg-app)',
          padding: '0.5rem 0.75rem',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span>Movie files remain on your device. You will select your local file again upon entering.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sessions.map(s => (
          <div
            key={s.roomCode}
            onClick={() => onSelectRoom(s.roomCode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 0.85rem',
              background: 'var(--bg-app)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'border-color var(--transition-fast)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                {s.roomName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                Code: <span className="mono" style={{ color: 'var(--accent)' }}>{s.roomCode}</span>
                {s.mediaTitle && ` • Movie: ${s.mediaTitle}`}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={e => handleRemove(s.roomCode, e)}
                className="btn-icon"
                title="Remove from history"
                aria-label={`Remove room ${s.roomCode}`}
              >
                <Trash2 size={15} />
              </button>
              <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
