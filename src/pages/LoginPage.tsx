import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SetupRequiredBanner } from '@/components/SetupRequiredBanner';

export const LoginPage: React.FC = () => {
  const { login, authError, clearError, isLoading } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isLoading) return;

    clearError();
    const res = await login(email, password);
    if (res.success) {
      navigate('/');
    }
  };

  return (
    <div className="container" style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <SetupRequiredBanner />

      <div style={{ maxWidth: '420px', width: '100%', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '0.85rem',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              marginBottom: '1rem',
            }}
          >
            <Film size={36} />
          </div>
          <h1 className="text-h1" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
            DuoCinema
          </h1>
          <p className="text-sub">
            Private peer watch-together website with local file sync.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {authError && (
              <div className="alert alert-danger" style={{ margin: 0 }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-email" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Approved Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  required
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem' }}
            >
              <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            Access is restricted to pre-approved identities. Public registration is permanently disabled.
          </div>
        </div>
      </div>
    </div>
  );
};
