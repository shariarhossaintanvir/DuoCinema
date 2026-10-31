import React from 'react';
import { AlertTriangle, Key, Database, ExternalLink } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

export const SetupRequiredBanner: React.FC = () => {
  if (isSupabaseConfigured()) return null;

  return (
    <div
      className="card"
      style={{
        margin: '1.5rem 0',
        borderColor: 'var(--warning)',
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <AlertTriangle style={{ color: 'var(--warning)' }} size={24} />
        <h2 className="text-h2" style={{ color: 'var(--warning)', fontSize: '1.15rem' }}>
          Supabase Configuration Required
        </h2>
      </div>

      <p className="text-sub" style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>
        DuoCinema requires a free Supabase project for authenticated user allowlists, transactional room locks,
        and real-time playback synchronization.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            <Key size={16} style={{ color: 'var(--accent)' }} />
            <span>1. Set Environment Variables</span>
          </div>
          <p className="text-sub" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Copy <code className="mono">.env.example</code> to <code className="mono">.env.local</code> and provide your browser-safe project URL and anon key:
          </p>
          <pre
            className="mono"
            style={{
              background: '#090b0e',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              overflowX: 'auto',
            }}
          >
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
          </pre>
        </div>

        <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            <Database size={16} style={{ color: 'var(--accent)' }} />
            <span>2. Apply SQL Migrations</span>
          </div>
          <p className="text-sub" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Run the 3 migrations in <code className="mono">supabase/migrations/</code> in your Supabase SQL Editor to provision allowlist tables and RPCs.
          </p>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            See <code className="mono">SETUP_BN.md</code> and <code className="mono">README.md</code> for full step-by-step instructions.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem' }}>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          <span>Open Supabase Dashboard</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
};
