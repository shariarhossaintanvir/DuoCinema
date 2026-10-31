# DuoCinema — Private Peer Watch-Together Website

DuoCinema is a free, private watch-together website designed for two friends to enjoy movies simultaneously in perfect synchronization.

Unlike conventional watch parties that upload video files to cloud storage or transcode streams through expensive servers, DuoCinema utilizes a **Zero-Upload Local File Sync** architecture.

---

## Key Highlights

- **Zero Video Uploads**: Video and subtitle files are loaded locally directly in the browser via `URL.createObjectURL`. Movie bytes **never** leave your computer, never touch any backend server, and are strictly excluded from version control.
- **Accidental Mismatch Detection**: Before playback starts, an incremental chunked cryptographic SHA-256 fingerprint (sampled across file segments with constant `< 4MB` RAM usage) verifies that both viewers have the identical movie cut.
- **Strict Two-User Allowlist**: Access is restricted exclusively to two administrator-approved user identities enforced via Supabase Row-Level Security (RLS). Public registration is disabled.
- **Transactional Server-Authoritative Playback**: All playback transitions (play, pause, seek, skip) are executed via atomic PostgreSQL functions with row locks (`SELECT ... FOR UPDATE`), revision monotonicity, and round-trip clock skew compensation.
- **Anti-Feedback Loop Engine**: Distinguishes remote state updates from deliberate local user commands, preventing infinite rebroadcast loops.
- **Safe Subtitles with Bengali Support**: Client-side SRT to WebVTT parser with strict HTML sanitization (XSS defense) and full Unicode UTF-8 support for Bengali typography (`বাংলা সাবটাইটেল`).
- **Free-Plan Friendly**: Operates completely within free tiers (Supabase Free and Vercel Hobby) without requiring always-on servers or metered video APIs.

---

## Architecture Overview

```
 [User A Browser]                           [User B Browser]
  ┌──────────────┐                           ┌──────────────┐
  │ Local Movie  │                           │ Local Movie  │
  │ File (e.g.   │                           │ File (e.g.   │
  │ Inception)   │                           │ Inception)   │
  └──────┬───────┘                           └──────┬───────┘
         │ (Direct Blob URL)                        │ (Direct Blob URL)
         ▼                                          ▼
   <video> Player                             <video> Player
         │                                          │
         │ (SHA-256 fingerprint + room commands)   │ (SHA-256 fingerprint + room commands)
         └─────────────────┬────────────────────────┘
                           │
                           ▼
                  Supabase Free Tier
        ┌─────────────────────────────────────┐
        │ 1. Auth: 2 Approved Users Only      │
        │ 2. PostgreSQL + Row Locks (FOR UPD) │
        │ 3. Strict Row Level Security (RLS)  │
        │ 4. Realtime: Playback, Chat, State  │
        └─────────────────────────────────────┘
```

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router v6
- **Styling**: Vanilla CSS Design System (charcoal cinema aesthetic with warm bronze accent)
- **Backend / Database**: Supabase (PostgreSQL 15, RLS, Security Definer RPCs, Realtime channels)
- **Deployment**: Vercel Hobby (SPA rewrites via `vercel.json`)
- **Testing**: Vitest, React Testing Library, Playwright E2E

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v20 or v24 LTS
- **npm**: v10 or v11
- A free Supabase account ([supabase.com](https://supabase.com))

### 2. Installation
```bash
git clone <repository-url>
cd "Private Cinema"
npm install
```

### 3. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env.local
```

Fill in your browser-safe Supabase configuration in `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...your-anon-publishable-key
```

> **Security Note**: Never add `service_role` or database admin passwords to `.env.local`. The frontend client requires only the public anon key. All database mutations and permissions are enforced by backend RLS policies and PostgreSQL functions.

### 4. Database Provisioning
Run the SQL migrations in order in your Supabase SQL Editor:
1. `supabase/migrations/20260301000001_initial_schema.sql`
2. `supabase/migrations/20260301000002_rpcs.sql`
3. `supabase/migrations/20260301000003_realtime_setup.sql`

Add your two approved user identities to the `allowed_users` table:
```sql
INSERT INTO public.allowed_users (user_id, display_name)
VALUES
  ('uuid-of-user-1', 'User 1 Name'),
  ('uuid-of-user-2', 'User 2 Name');
```

---

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite local development server on `http://localhost:5173` |
| `npm run build` | Compiles TypeScript and builds production distribution in `dist/` |
| `npm run preview` | Locally previews the production build |
| `npm test` | Executes Vitest unit & integration test suites |
| `npm run test:e2e` | Runs Playwright end-to-end browser tests |

---

## Recommended Media & Formats

- **Container**: MP4 (`.mp4`)
- **Video Codec**: H.264 (AVC)
- **Audio Codec**: AAC
- **Subtitles**: SubRip (`.srt`) or WebVTT (`.vtt`) in UTF-8 encoding

*Note: MKV containers and proprietary audio formats (AC-3, DTS) may not play audio in standard browsers without prior remuxing.*

---

## Secret Handling & Security Checklist

- [x] All `.env` and `.env.*.local` files are ignored in `.gitignore`.
- [x] All video (`.mp4`, `.mkv`, `.webm`, `.avi`) and subtitle files (`.srt`, `.vtt`) are strictly ignored in `.gitignore`.
- [x] No `service_role` key or database secret is used in frontend code.
- [x] RLS is enabled on all tables; direct mutations without RPC are blocked.
- [x] User identities are derived strictly from server-side `auth.uid()`.
- [x] Subtitles are parsed with strict HTML entity sanitization.
