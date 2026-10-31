import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Film, Settings, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRoom } from '@/context/RoomContext';

export const Navbar: React.FC = () => {
  const { user, allowedUser, logout } = useAuth();
  const { room, leaveRoom } = useRoom();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (room) {
      await leaveRoom();
    }
    await logout();
    navigate('/login');
  };

  return (
    <header className="header-nav">
      <div className="header-brand">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Film className="header-logo-icon" size={22} />
          <span>DuoCinema</span>
        </Link>
        {room && (
          <span className="badge badge-neutral mono" style={{ marginLeft: '0.5rem' }}>
            Room: {room.code}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && allowedUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Shield size={14} style={{ color: 'var(--success)' }} />
            <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
              {allowedUser.display_name}
            </span>
          </div>
        )}

        <Link to="/settings" className="btn-icon" title="Settings & Local File Help" aria-label="Settings">
          <Settings size={18} />
        </Link>

        {user && (
          <button
            onClick={handleLogout}
            className="btn-icon"
            title="Log Out"
            aria-label="Log Out"
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
};
