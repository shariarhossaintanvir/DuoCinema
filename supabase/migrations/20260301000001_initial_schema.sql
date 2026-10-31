-- DuoCinema Schema Migration: 20260301000001_initial_schema.sql
-- Description: Core tables, constraints, indexes, and Row Level Security policies.

-- 1. Allowed Users (Strict backend allowlist for exactly two approved users)
CREATE TABLE IF NOT EXISTS public.allowed_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) > 0 AND char_length(display_name) <= 60),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;

-- 2. Rooms (Private watch rooms)
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL CHECK (char_length(code) = 8),
    name TEXT NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 100),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- 3. Room Members (Enforces maximum 2 distinct user members per room)
CREATE TABLE IF NOT EXISTS public.room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) > 0 AND char_length(display_name) <= 60),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_room_member UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_room ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members(user_id);
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- 4. Room Media (Metadata & fingerprint of the currently proposed movie)
CREATE TABLE IF NOT EXISTS public.room_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    media_version INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 255),
    fingerprint TEXT NOT NULL CHECK (char_length(fingerprint) = 64),
    duration_seconds DOUBLE PRECISION NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 86400),
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    proposed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_room_media_version UNIQUE (room_id, media_version)
);

CREATE INDEX IF NOT EXISTS idx_room_media_room ON public.room_media(room_id);
ALTER TABLE public.room_media ENABLE ROW LEVEL SECURITY;

-- 5. Room Member Readiness (Tracks explicit Ready status per user and media version)
CREATE TABLE IF NOT EXISTS public.room_member_readiness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_version INTEGER NOT NULL DEFAULT 1,
    is_ready BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_member_readiness UNIQUE (room_id, user_id, media_version)
);

CREATE INDEX IF NOT EXISTS idx_readiness_room_version ON public.room_member_readiness(room_id, media_version);
ALTER TABLE public.room_member_readiness ENABLE ROW LEVEL SECURITY;

-- 6. Room Playback State (Server-authoritative timeline state)
CREATE TABLE IF NOT EXISTS public.room_playback_state (
    room_id UUID PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
    media_version INTEGER NOT NULL DEFAULT 1,
    is_playing BOOLEAN NOT NULL DEFAULT false,
    position_seconds DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
    server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revision BIGINT NOT NULL DEFAULT 1 CHECK (revision >= 1),
    last_action_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_action_type TEXT NOT NULL DEFAULT 'init' CHECK (last_action_type IN ('init', 'play', 'pause', 'seek', 'skip', 'media_change'))
);

ALTER TABLE public.room_playback_state ENABLE ROW LEVEL SECURITY;

-- 7. Room Messages (Encrypted/isolated text chat)
CREATE TABLE IF NOT EXISTS public.room_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL CHECK (char_length(trim(sender_name)) > 0 AND char_length(sender_name) <= 60),
    content TEXT NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_messages_room_created ON public.room_messages(room_id, created_at DESC);
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- HELPER FUNCTIONS FOR RLS (Security Definer with isolated search_path)
--------------------------------------------------------------------------------

-- Helper: Check if user is in the allowlist
CREATE OR REPLACE FUNCTION public.is_user_allowed(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.allowed_users
        WHERE user_id = check_user_id AND is_active = true
    );
$$;

-- Helper: Check if current auth.uid() is an active member of room
CREATE OR REPLACE FUNCTION public.is_room_member(check_room_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = check_room_id AND user_id = check_user_id
    );
$$;

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES
--------------------------------------------------------------------------------

-- allowed_users: An allowed user can view their own profile and other active approved users
CREATE POLICY allowed_users_select ON public.allowed_users
    FOR SELECT TO authenticated
    USING (public.is_user_allowed(auth.uid()));

-- rooms: Only allowed members of the room can select it
CREATE POLICY rooms_select ON public.rooms
    FOR SELECT TO authenticated
    USING (public.is_user_allowed(auth.uid()) AND public.is_room_member(id, auth.uid()));

-- room_members: Members can view participants of their room
CREATE POLICY room_members_select ON public.room_members
    FOR SELECT TO authenticated
    USING (public.is_user_allowed(auth.uid()) AND public.is_room_member(room_id, auth.uid()));

-- room_media: Members can view current & historical media in their room
CREATE POLICY room_media_select ON public.room_media
    FOR SELECT TO authenticated
    USING (public.is_user_allowed(auth.uid()) AND public.is_room_member(room_id, auth.uid()));

-- room_member_readiness: Members can view readiness in their room
CREATE POLICY room_member_readiness_select ON public.room_member_readiness
    FOR SELECT TO authenticated
    USING (public.is_user_allowed(auth.uid()) AND public.is_room_member(room_id, auth.uid()));

-- room_playback_state: Members can view playback state of their room
CREATE POLICY room_playback_state_select ON public.room_playback_state
    FOR SELECT TO authenticated
    USING (public.is_user_allowed(auth.uid()) AND public.is_room_member(room_id, auth.uid()));

-- room_messages: Members can view messages of their room
CREATE POLICY room_messages_select ON public.room_messages
    FOR SELECT TO authenticated
    USING (public.is_user_allowed(auth.uid()) AND public.is_room_member(room_id, auth.uid()));
