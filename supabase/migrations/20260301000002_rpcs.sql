-- DuoCinema Schema Migration: 20260301000002_rpcs.sql
-- Description: Security Definer transactional RPCs for room lifecycle, member limits, media proposals, authoritative playback sync, and chat.

--------------------------------------------------------------------------------
-- 1. Create Room RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_create_room(
    p_room_name TEXT,
    p_display_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room_id UUID;
    v_code TEXT;
    v_clean_room_name TEXT := trim(p_room_name);
    v_clean_display_name TEXT := trim(p_display_name);
    v_exists BOOLEAN;
BEGIN
    IF v_user_id IS NULL OR NOT public.is_user_allowed(v_user_id) THEN
        RAISE EXCEPTION 'Access denied: User is not authorized.' USING ERRCODE = '42501';
    END IF;

    IF v_clean_room_name = '' OR char_length(v_clean_room_name) > 100 THEN
        RAISE EXCEPTION 'Invalid room name. Must be between 1 and 100 characters.' USING ERRCODE = '22023';
    END IF;

    IF v_clean_display_name = '' OR char_length(v_clean_display_name) > 60 THEN
        RAISE EXCEPTION 'Invalid display name. Must be between 1 and 60 characters.' USING ERRCODE = '22023';
    END IF;

    -- Generate a unique 8-character uppercase room code
    LOOP
        v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 8));
        SELECT EXISTS (SELECT 1 FROM public.rooms WHERE code = v_code) INTO v_exists;
        EXIT WHEN NOT v_exists;
    END LOOP;

    -- Insert Room
    INSERT INTO public.rooms (code, name, created_by)
    VALUES (v_code, v_clean_room_name, v_user_id)
    RETURNING id INTO v_room_id;

    -- Add Creator as First Member
    INSERT INTO public.room_members (room_id, user_id, display_name)
    VALUES (v_room_id, v_user_id, v_clean_display_name);

    -- Initialize Playback State
    INSERT INTO public.room_playback_state (
        room_id,
        media_version,
        is_playing,
        position_seconds,
        server_updated_at,
        revision,
        last_action_by,
        last_action_type
    ) VALUES (
        v_room_id,
        1,
        false,
        0.0,
        now(),
        1,
        v_user_id,
        'init'
    );

    RETURN jsonb_build_object(
        'room_id', v_room_id,
        'code', v_code,
        'name', v_clean_room_name
    );
END;
$$;

--------------------------------------------------------------------------------
-- 2. Join Room RPC (Strict Transactional 2-Member Cap)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_join_room(
    p_code TEXT,
    p_display_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_code TEXT := upper(trim(p_code));
    v_clean_display_name TEXT := trim(p_display_name);
    v_room_id UUID;
    v_room_name TEXT;
    v_member_count INTEGER;
    v_already_member BOOLEAN;
BEGIN
    IF v_user_id IS NULL OR NOT public.is_user_allowed(v_user_id) THEN
        RAISE EXCEPTION 'Access denied: User is not authorized.' USING ERRCODE = '42501';
    END IF;

    IF v_clean_display_name = '' OR char_length(v_clean_display_name) > 60 THEN
        RAISE EXCEPTION 'Invalid display name. Must be between 1 and 60 characters.' USING ERRCODE = '22023';
    END IF;

    -- Find Room
    SELECT id, name INTO v_room_id, v_room_name
    FROM public.rooms
    WHERE code = v_clean_code;

    IF v_room_id IS NULL THEN
        RAISE EXCEPTION 'Room not found with code: %', v_clean_code USING ERRCODE = 'P0002';
    END IF;

    -- Acquire an exclusive lock on room members for this room to prevent race conditions
    PERFORM 1 FROM public.rooms WHERE id = v_room_id FOR UPDATE;

    SELECT EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = v_room_id AND user_id = v_user_id
    ) INTO v_already_member;

    IF v_already_member THEN
        -- Existing member rejoining (e.g. refresh or multiple tabs)
        UPDATE public.room_members
        SET display_name = v_clean_display_name,
            last_seen_at = now()
        WHERE room_id = v_room_id AND user_id = v_user_id;
    ELSE
        -- Check current distinct members count
        SELECT COUNT(*) INTO v_member_count
        FROM public.room_members
        WHERE room_id = v_room_id;

        IF v_member_count >= 2 THEN
            RAISE EXCEPTION 'Room is full. DuoCinema rooms accommodate at most 2 participants.' USING ERRCODE = '23514';
        END IF;

        INSERT INTO public.room_members (room_id, user_id, display_name)
        VALUES (v_room_id, v_user_id, v_clean_display_name);
    END IF;

    RETURN jsonb_build_object(
        'room_id', v_room_id,
        'code', v_clean_code,
        'name', v_room_name
    );
END;
$$;

--------------------------------------------------------------------------------
-- 3. Leave Room RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_leave_room(p_room_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_remaining INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    DELETE FROM public.room_members
    WHERE room_id = p_room_id AND user_id = v_user_id;

    -- Check remaining members; if empty, automatically pause playback to avoid running unattended
    SELECT COUNT(*) INTO v_remaining FROM public.room_members WHERE room_id = p_room_id;
    IF v_remaining = 0 THEN
        UPDATE public.room_playback_state
        SET is_playing = false,
            server_updated_at = now()
        WHERE room_id = p_room_id;
    END IF;
END;
$$;

--------------------------------------------------------------------------------
-- 4. Propose Media RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_propose_media(
    p_room_id UUID,
    p_title TEXT,
    p_fingerprint TEXT,
    p_duration DOUBLE PRECISION,
    p_size BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_title TEXT := trim(p_title);
    v_clean_fp TEXT := lower(trim(p_fingerprint));
    v_new_version INTEGER;
    v_playback RECORD;
BEGIN
    IF v_user_id IS NULL OR NOT public.is_room_member(p_room_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: Must be a member of this room.' USING ERRCODE = '42501';
    END IF;

    IF v_clean_title = '' OR char_length(v_clean_title) > 255 THEN
        RAISE EXCEPTION 'Invalid media title.' USING ERRCODE = '22023';
    END IF;

    IF char_length(v_clean_fp) != 64 THEN
        RAISE EXCEPTION 'Invalid media fingerprint.' USING ERRCODE = '22023';
    END IF;

    IF p_duration <= 0 OR p_duration > 86400 THEN
        RAISE EXCEPTION 'Invalid media duration.' USING ERRCODE = '22023';
    END IF;

    IF p_size <= 0 THEN
        RAISE EXCEPTION 'Invalid media file size.' USING ERRCODE = '22023';
    END IF;

    -- Lock room playback state row
    SELECT * INTO v_playback
    FROM public.room_playback_state
    WHERE room_id = p_room_id
    FOR UPDATE;

    -- Compute next version
    SELECT COALESCE(MAX(media_version), 0) + 1 INTO v_new_version
    FROM public.room_media
    WHERE room_id = p_room_id;

    -- Record proposed media
    INSERT INTO public.room_media (
        room_id,
        media_version,
        title,
        fingerprint,
        duration_seconds,
        file_size_bytes,
        proposed_by
    ) VALUES (
        p_room_id,
        v_new_version,
        v_clean_title,
        v_clean_fp,
        p_duration,
        p_size,
        v_user_id
    );

    -- Reset both users readiness for this new media version
    INSERT INTO public.room_member_readiness (room_id, user_id, media_version, is_ready, updated_at)
    SELECT p_room_id, user_id, v_new_version, false, now()
    FROM public.room_members
    WHERE room_id = p_room_id
    ON CONFLICT (room_id, user_id, media_version)
    DO UPDATE SET is_ready = false, updated_at = now();

    -- Reset Playback Timeline to 0 and Paused
    UPDATE public.room_playback_state
    SET media_version = v_new_version,
        is_playing = false,
        position_seconds = 0.0,
        server_updated_at = now(),
        revision = v_playback.revision + 1,
        last_action_by = v_user_id,
        last_action_type = 'media_change'
    WHERE room_id = p_room_id;

    RETURN jsonb_build_object(
        'media_version', v_new_version,
        'title', v_clean_title,
        'fingerprint', v_clean_fp,
        'duration_seconds', p_duration,
        'file_size_bytes', p_size,
        'revision', v_playback.revision + 1
    );
END;
$$;

--------------------------------------------------------------------------------
-- 5. Set Member Readiness RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_set_readiness(
    p_room_id UUID,
    p_media_version INTEGER,
    p_is_ready BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL OR NOT public.is_room_member(p_room_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: Must be a member of this room.' USING ERRCODE = '42501';
    END IF;

    -- Insert or update readiness
    INSERT INTO public.room_member_readiness (
        room_id,
        user_id,
        media_version,
        is_ready,
        updated_at
    ) VALUES (
        p_room_id,
        v_user_id,
        p_media_version,
        p_is_ready,
        now()
    )
    ON CONFLICT (room_id, user_id, media_version)
    DO UPDATE SET is_ready = p_is_ready, updated_at = now();

    RETURN jsonb_build_object(
        'room_id', p_room_id,
        'user_id', v_user_id,
        'media_version', p_media_version,
        'is_ready', p_is_ready
    );
END;
$$;

--------------------------------------------------------------------------------
-- 6. Authoritative Playback Update RPC (Play, Pause, Seek, Skip)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_update_playback(
    p_room_id UUID,
    p_media_version INTEGER,
    p_action TEXT,
    p_position DOUBLE PRECISION,
    p_expected_revision BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_playback RECORD;
    v_media RECORD;
    v_elapsed DOUBLE PRECISION;
    v_effective_pos DOUBLE PRECISION;
    v_new_pos DOUBLE PRECISION;
    v_new_playing BOOLEAN;
    v_all_ready BOOLEAN;
    v_unready_count INTEGER;
BEGIN
    IF v_user_id IS NULL OR NOT public.is_room_member(p_room_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: Must be a member of this room.' USING ERRCODE = '42501';
    END IF;

    IF p_action NOT IN ('play', 'pause', 'seek', 'skip') THEN
        RAISE EXCEPTION 'Invalid playback action: %', p_action USING ERRCODE = '22023';
    END IF;

    -- Row Lock on Authoritative State
    SELECT * INTO v_playback
    FROM public.room_playback_state
    WHERE room_id = p_room_id
    FOR UPDATE;

    IF v_playback IS NULL THEN
        RAISE EXCEPTION 'Playback state not found for room.' USING ERRCODE = 'P0002';
    END IF;

    -- Check Media Version
    IF v_playback.media_version != p_media_version THEN
        RAISE EXCEPTION 'Media version mismatch: expected %, got %', v_playback.media_version, p_media_version
            USING ERRCODE = '22000';
    END IF;

    -- Fetch media duration
    SELECT * INTO v_media
    FROM public.room_media
    WHERE room_id = p_room_id AND media_version = p_media_version;

    IF v_media IS NULL THEN
        RAISE EXCEPTION 'Room media not initialized.' USING ERRCODE = 'P0002';
    END IF;

    -- Server Throttling: If the same user attempts rapid commands within 100ms, ignore or raise
    IF v_playback.last_action_by = v_user_id AND (now() - v_playback.server_updated_at) < interval '100 milliseconds' THEN
        -- Return current state without duplicating revision
        RETURN jsonb_build_object(
            'room_id', v_playback.room_id,
            'media_version', v_playback.media_version,
            'is_playing', v_playback.is_playing,
            'position_seconds', v_playback.position_seconds,
            'server_updated_at', v_playback.server_updated_at,
            'revision', v_playback.revision,
            'throttled', true
        );
    END IF;

    -- Compute effective running position based on server time elapsed
    IF v_playback.is_playing THEN
        v_elapsed := EXTRACT(EPOCH FROM (now() - v_playback.server_updated_at));
        v_effective_pos := LEAST(v_media.duration_seconds, v_playback.position_seconds + GREATEST(0.0, v_elapsed));
    ELSE
        v_effective_pos := v_playback.position_seconds;
    END IF;

    -- Process Action
    IF p_action = 'play' THEN
        -- Check Readiness of ALL room members for this media version
        SELECT COUNT(*) INTO v_unready_count
        FROM public.room_members m
        LEFT JOIN public.room_member_readiness r
            ON r.room_id = m.room_id AND r.user_id = m.user_id AND r.media_version = p_media_version
        WHERE m.room_id = p_room_id AND (r.is_ready IS NULL OR r.is_ready = false);

        IF v_unready_count > 0 THEN
            RAISE EXCEPTION 'Cannot start playback until both participants are Ready.' USING ERRCODE = '23514';
        END IF;

        v_new_playing := true;
        -- If caller provided a valid seek position, use it if within bounds, otherwise continue from effective position
        IF p_position IS NOT NULL AND p_position >= 0 AND p_position <= v_media.duration_seconds THEN
            v_new_pos := p_position;
        ELSE
            v_new_pos := v_effective_pos;
        END IF;

    ELSIF p_action = 'pause' THEN
        v_new_playing := false;
        IF p_position IS NOT NULL AND p_position >= 0 AND p_position <= v_media.duration_seconds THEN
            -- If caller position is close to effective pos, accept it
            v_new_pos := p_position;
        ELSE
            v_new_pos := v_effective_pos;
        END IF;

    ELSIF p_action = 'seek' THEN
        v_new_playing := v_playback.is_playing;
        IF p_position IS NULL OR p_position < 0 OR p_position > v_media.duration_seconds THEN
            RAISE EXCEPTION 'Seek position out of bounds: %', p_position USING ERRCODE = '22023';
        END IF;
        v_new_pos := p_position;

    ELSIF p_action = 'skip' THEN
        -- p_position is the delta (e.g. +10 or -10)
        v_new_playing := v_playback.is_playing;
        v_new_pos := LEAST(v_media.duration_seconds, GREATEST(0.0, v_effective_pos + p_position));
    END IF;

    -- Stale State Check: if client sent an outdated revision and this was not an idempotent repeat
    IF p_expected_revision IS NOT NULL AND p_expected_revision < v_playback.revision THEN
        -- If already in requested state, return gracefully
        IF v_playback.is_playing = v_new_playing AND abs(v_effective_pos - v_new_pos) < 0.25 THEN
            RETURN jsonb_build_object(
                'room_id', v_playback.room_id,
                'media_version', v_playback.media_version,
                'is_playing', v_playback.is_playing,
                'position_seconds', v_playback.position_seconds,
                'server_updated_at', v_playback.server_updated_at,
                'revision', v_playback.revision,
                'stale_handled', true
            );
        END IF;
    END IF;

    -- Apply State with Monotonically Incremented Revision
    UPDATE public.room_playback_state
    SET is_playing = v_new_playing,
        position_seconds = v_new_pos,
        server_updated_at = now(),
        revision = v_playback.revision + 1,
        last_action_by = v_user_id,
        last_action_type = p_action
    WHERE room_id = p_room_id;

    RETURN jsonb_build_object(
        'room_id', p_room_id,
        'media_version', p_media_version,
        'is_playing', v_new_playing,
        'position_seconds', v_new_pos,
        'server_updated_at', now(),
        'revision', v_playback.revision + 1,
        'last_action_by', v_user_id,
        'last_action_type', p_action
    );
END;
$$;

--------------------------------------------------------------------------------
-- 7. Send Chat Message RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_send_message(
    p_room_id UUID,
    p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_sender_name TEXT;
    v_clean_content TEXT := trim(p_content);
    v_message_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL OR NOT public.is_room_member(p_room_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: Must be a member of this room.' USING ERRCODE = '42501';
    END IF;

    IF v_clean_content = '' OR char_length(v_clean_content) > 500 THEN
        RAISE EXCEPTION 'Message must be between 1 and 500 characters.' USING ERRCODE = '22023';
    END IF;

    -- Get sender display name
    SELECT display_name INTO v_sender_name
    FROM public.room_members
    WHERE room_id = p_room_id AND user_id = v_user_id;

    -- Server-side throttling: Max 1 message per 300 milliseconds
    IF EXISTS (
        SELECT 1 FROM public.room_messages
        WHERE room_id = p_room_id AND sender_id = v_user_id AND created_at > now() - interval '300 milliseconds'
    ) THEN
        RAISE EXCEPTION 'Message rate limit exceeded. Please wait a moment.' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.room_messages (
        room_id,
        sender_id,
        sender_name,
        content,
        created_at
    ) VALUES (
        p_room_id,
        v_user_id,
        COALESCE(v_sender_name, 'Guest'),
        v_clean_content,
        now()
    )
    RETURNING id, created_at INTO v_message_id, v_created_at;

    RETURN jsonb_build_object(
        'id', v_message_id,
        'room_id', p_room_id,
        'sender_id', v_user_id,
        'sender_name', COALESCE(v_sender_name, 'Guest'),
        'content', v_clean_content,
        'created_at', v_created_at
    );
END;
$$;

--------------------------------------------------------------------------------
-- 8. Get Room Bundle RPC (Snapshot with Server Time)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_room_bundle(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room JSONB;
    v_members JSONB;
    v_media JSONB;
    v_readiness JSONB;
    v_playback JSONB;
    v_messages JSONB;
BEGIN
    IF v_user_id IS NULL OR NOT public.is_room_member(p_room_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: Must be a member of this room.' USING ERRCODE = '42501';
    END IF;

    -- Update presence for caller
    UPDATE public.room_members
    SET last_seen_at = now()
    WHERE room_id = p_room_id AND user_id = v_user_id;

    -- Room details
    SELECT to_jsonb(r) INTO v_room
    FROM (SELECT id, code, name, created_by, created_at FROM public.rooms WHERE id = p_room_id) r;

    -- Members
    SELECT jsonb_agg(to_jsonb(m)) INTO v_members
    FROM (
        SELECT user_id, display_name, joined_at, last_seen_at
        FROM public.room_members
        WHERE room_id = p_room_id
        ORDER BY joined_at ASC
    ) m;

    -- Latest Media
    SELECT to_jsonb(med) INTO v_media
    FROM (
        SELECT id, media_version, title, fingerprint, duration_seconds, file_size_bytes, proposed_by, proposed_at
        FROM public.room_media
        WHERE room_id = p_room_id
        ORDER BY media_version DESC
        LIMIT 1
    ) med;

    -- Readiness for current media
    SELECT COALESCE(jsonb_agg(to_jsonb(rd)), '[]'::jsonb) INTO v_readiness
    FROM (
        SELECT user_id, media_version, is_ready, updated_at
        FROM public.room_member_readiness
        WHERE room_id = p_room_id AND media_version = COALESCE((v_media->>'media_version')::int, 1)
    ) rd;

    -- Playback State
    SELECT to_jsonb(pb) INTO v_playback
    FROM (
        SELECT room_id, media_version, is_playing, position_seconds, server_updated_at, revision, last_action_by, last_action_type
        FROM public.room_playback_state
        WHERE room_id = p_room_id
    ) pb;

    -- Recent Messages (Latest 100)
    SELECT COALESCE(jsonb_agg(to_jsonb(msg)), '[]'::jsonb) INTO v_messages
    FROM (
        SELECT id, sender_id, sender_name, content, created_at
        FROM public.room_messages
        WHERE room_id = p_room_id
        ORDER BY created_at DESC
        LIMIT 100
    ) msg;

    RETURN jsonb_build_object(
        'room', v_room,
        'members', COALESCE(v_members, '[]'::jsonb),
        'media', v_media,
        'readiness', v_readiness,
        'playback', v_playback,
        'messages', v_messages,
        'server_time', now()
    );
END;
$$;

--------------------------------------------------------------------------------
-- 9. Ping Presence RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_ping_presence(p_room_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NOT NULL AND public.is_room_member(p_room_id, v_user_id) THEN
        UPDATE public.room_members
        SET last_seen_at = now()
        WHERE room_id = p_room_id AND user_id = v_user_id;
    END IF;
    RETURN now();
END;
$$;
