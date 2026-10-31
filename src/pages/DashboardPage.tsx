import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PlusCircle, LogIn, Sparkles, HelpCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRoom } from '@/context/RoomContext';
import { RecentSessionsList } from '@/components/RecentSessionsList';
import { SetupRequiredBanner } from '@/components/SetupRequiredBanner';

export const DashboardPage: React.FC = () => {
  const { allowedUser } = useAuth();
  const { createRoom, joinRoom, error, clearError, isLoading } = useRoom();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [roomName, setRoomName] = useState<string>('Duo Cinema Night');
  const [roomCode, setRoomCode] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>(allowedUser?.display_name || '');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || isLoading) return;

    clearError();
    const res = await createRoom(roomName, displayName || allowedUser?.display_name || 'Host');
    if (res.success && res.code) {
      navigate(`/room/${res.code}`);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code || isLoading) return;

    clearError();
    const res = await joinRoom(code, displayName || allowedUser?.display_name || 'Guest');
    if (res.success) {
      navigate(`/room/${code}`);
    }
  };

  const handleSelectRecent = (code: string) => {
    setRoomCode(code);
    setActiveTab('join');
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '800px' }}>
      <SetupRequiredBanner />

      <div style={{ marginBottom: '2rem' }}>
        <h1 className="text-h1" style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>
          Welcome, {allowedUser?.display_name || 'Viewer'}
        </h1>
        <p className="text-sub">
          Create or join a private watch room. Both users select their local copy of the movie.
        </p>
      </div>

      <div className="card">
        {/* Tab selection */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setActiveTab('create')}
            className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
          >
            <PlusCircle size={16} />
            <span>Create Room</span>
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`btn ${activeTab === 'join' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
          >
            <LogIn size={16} />
            <span>Join with Code</span>
          </button>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
            <span>{error}</span>
          </div>
        )}

        {/* Create Room Form */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label htmlFor="room-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Room Title
              </label>
              <input
                id="room-name"
                type="text"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                placeholder="e.g. Inception Rewatch"
                maxLength={100}
                required
                className="input-field"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="display-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Your Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Display Name"
                maxLength={60}
                required
                className="input-field"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !roomName.trim()}
              className="btn btn-primary"
              style={{ padding: '0.75rem' }}
            >
              <Sparkles size={16} />
              <span>{isLoading ? 'Creating Room...' : 'Create Private Watch Room'}</span>
            </button>
          </form>
        )}

        {/* Join Room Form */}
        {activeTab === 'join' && (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label htmlFor="join-code" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                8-Character Room Code
              </label>
              <input
                id="join-code"
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7F8B2C9A"
                maxLength={8}
                required
                className="input-field mono"
                style={{ letterSpacing: '0.1em' }}
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="join-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Your Display Name
              </label>
              <input
                id="join-name"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Display Name"
                maxLength={60}
                required
                className="input-field"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || roomCode.trim().length !== 8}
              className="btn btn-primary"
              style={{ padding: '0.75rem' }}
            >
              <LogIn size={16} />
              <span>{isLoading ? 'Joining Room...' : 'Join Room'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Recent Sessions */}
      <RecentSessionsList onSelectRoom={handleSelectRecent} />

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link
          to="/settings"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}
        >
          <HelpCircle size={15} />
          <span>Need help with local files or supported codecs?</span>
        </Link>
      </div>
    </div>
  );
};
