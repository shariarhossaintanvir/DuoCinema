import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Film, AlertTriangle } from 'lucide-react';
import { useRoom } from '@/context/RoomContext';
import { useAuth } from '@/context/AuthContext';
import { VideoPlayer } from '@/components/VideoPlayer';
import { MediaSelector } from '@/components/MediaSelector';
import { RoomLobby } from '@/components/RoomLobby';
import { ChatBox } from '@/components/ChatBox';

export const WatchRoomPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const { room, joinRoom, leaveRoom, error, isLoading } = useRoom();
  const { allowedUser } = useAuth();
  const navigate = useNavigate();

  const [hasAttemptedJoin, setHasAttemptedJoin] = useState<boolean>(false);

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    const upperCode = code.toUpperCase();
    if (room?.code !== upperCode && !hasAttemptedJoin) {
      setHasAttemptedJoin(true);
      joinRoom(upperCode, allowedUser?.display_name || 'Guest').then(res => {
        if (!res.success) {
          // Handled via context error state
        }
      });
    }
  }, [code, room?.code, hasAttemptedJoin, joinRoom, allowedUser, navigate]);

  const handleLeave = async () => {
    await leaveRoom();
    navigate('/');
  };

  if (isLoading && !room) {
    return (
      <div className="container" style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Film size={32} className="header-logo-icon" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
          <p className="text-sub">Connecting to private watch room...</p>
        </div>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="container" style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        <div className="card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <AlertTriangle size={36} style={{ color: 'var(--danger)', margin: '0 auto 1rem auto' }} />
          <h2 className="text-h2" style={{ marginBottom: '0.5rem' }}>
            Unable to Join Room
          </h2>
          <p className="text-sub" style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>
            {error}
          </p>
          <button onClick={() => navigate('/')} className="btn btn-primary" style={{ margin: '0 auto' }}>
            <ArrowLeft size={16} />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '1rem 1.5rem' }}>
      {/* Room Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleLeave}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem' }}
            title="Leave Room"
            aria-label="Leave Room"
          >
            <ArrowLeft size={15} />
            <span>Dashboard</span>
          </button>

          <div>
            <h1 className="text-h2" style={{ fontSize: '1.25rem' }}>
              {room?.name || 'Private Watch Room'}
            </h1>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Room Code: <span className="mono" style={{ color: 'var(--accent)' }}>{room?.code}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Theater Grid */}
      <div className="theater-grid">
        {/* Left Column: Player & Media Selector */}
        <div>
          <VideoPlayer />
          <div style={{ marginTop: '1.25rem' }}>
            <MediaSelector />
          </div>
        </div>

        {/* Right Column: Lobby & Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <RoomLobby />
          <ChatBox />
        </div>
      </div>
    </div>
  );
};
