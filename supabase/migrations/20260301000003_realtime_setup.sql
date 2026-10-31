-- DuoCinema Schema Migration: 20260301000003_realtime_setup.sql
-- Description: Add tables to Supabase Realtime publication so clients receive updates under RLS.

DO $$
BEGIN
    -- Check if supabase_realtime publication exists
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        -- Add relevant tables to the publication
        ALTER PUBLICATION supabase_realtime ADD TABLE public.room_playback_state;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.room_member_readiness;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.room_media;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Already added to publication
        NULL;
END;
$$;
