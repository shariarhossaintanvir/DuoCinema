import React from 'react';
import { Link } from 'react-router-dom';
import { Film, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div
      className="container"
      style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem 1.5rem',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-surface-elevated)',
          color: 'var(--accent)',
          marginBottom: '1.25rem',
        }}
      >
        <Film size={40} />
      </div>

      <h1 className="text-h1" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
        404
      </h1>
      <h2 className="text-h2" style={{ marginBottom: '0.75rem', color: 'var(--text-main)' }}>
        Screenplay Not Found
      </h2>
      <p className="text-sub" style={{ maxWidth: '420px', marginBottom: '1.75rem' }}>
        The theater room or page you are looking for does not exist or has been closed.
      </p>

      <Link to="/" className="btn btn-primary">
        <Home size={16} />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
};
