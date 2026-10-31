import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured, getErrorMessage } from '@/lib/supabase';
import { Room, RoomMember, RoomMedia, RoomReadiness, RoomPlaybackState, RoomMessage, RoomBundle, PlaybackAction } from '@/types/database';
import { LocalMediaFile } from '@/types/player';
import { ClockCalibrator } from '@/lib/syncEngine';
import { useAuth } from './AuthContext';
import { saveRecentSession } from '@/lib/recentSessions';

interface RoomContextType {
  room: Room | null;
  members: RoomMember[];
  media: RoomMedia | null;
  readiness: RoomReadiness[];
  playback: RoomPlaybackState | null;
  messages: RoomMessage[];
  isLoading: boolean;
  error: string | null;
  isReconnecting: boolean;
  localMedia: LocalMediaFile | null;
  isFingerprintMatch: boolean;
  mediaMismatchReason: string | null;
  calibrator: ClockCalibrator;
  createRoom: (roomName: string, displayName: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  joinRoom: (roomCode: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => Promise<void>;
  setLocalMediaFile: (media: LocalMediaFile) => void;
  removeLocalMediaFile: () => void;
  proposeNewMedia: (title: string, fingerprint: string, duration: number, size: number) => Promise<boolean>;
  setReadiness: (isReady: boolean) => Promise<void>;
  updatePlayback: (action: PlaybackAction, position?: number) => Promise<void>;
  sendChatMessage: (content: string) => Promise<boolean>;
  refreshBundle: () => Promise<void>;
  clearError: () => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, allowedUser } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [media, setMedia] = useState<RoomMedia | null>(null);
  const [readiness, setReadinessState] = useState<RoomReadiness[]>([]);
  const [playback, setPlayback] = useState<RoomPlaybackState | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [localMedia, setLocalMedia] = useState<LocalMediaFile | null>(null);

  // Single clock calibrator instance across room session
  const calibratorRef = useRef<ClockCalibrator>(new ClockCalibrator());
  const activeRoomIdRef = useRef<string | null>(null);
  activeRoomIdRef.current = room?.id || null;

  // Cleanup object URL when localMedia changes or on unmount
  useEffect(() => {
    return () => {
      if (localMedia?.objectUrl) {
        try {
          URL.revokeObjectURL(localMedia.objectUrl);
        } catch {
          // Ignore
        }
      }
    };
  }, [localMedia]);

  // Compute fingerprint & duration match against room's proposed media
  let isFingerprintMatch = false;
  let mediaMismatchReason: string | null = null;

  if (media && localMedia) {
    if (media.fingerprint !== localMedia.fingerprint) {
      isFingerprintMatch = false;
      mediaMismatchReason = 'File content fingerprint does not match the room movie. Ensure both users have the exact same file.';
    } else if (Math.abs(media.duration_seconds - localMedia.duration) > 2.0) {
      isFingerprintMatch = false;
      mediaMismatchReason = `Duration mismatch (${localMedia.duration.toFixed(1)}s vs ${media.duration_seconds.toFixed(1)}s). Different edit or cut detected.`;
    } else {
      isFingerprintMatch = true;
      mediaMismatchReason = null;
    }
  }

  // Fetch full room bundle snapshot
  const refreshBundle = useCallback(async () => {
    if (!activeRoomIdRef.current || !isSupabaseConfigured()) return;
    const t0 = Date.now();

    try {
      const { data, error: rpcErr } = await supabase.rpc('rpc_get_room_bundle', {
        p_room_id: activeRoomIdRef.current,
      });

      if (rpcErr) {
        console.warn('Failed to refresh room bundle:', rpcErr.message);
        return;
      }

      const bundle = data as RoomBundle;
      const t1 = Date.now();
      if (bundle.server_time) {
        calibratorRef.current.recordSample(t0, bundle.server_time, t1);
      }

      setRoom(bundle.room);
      setMembers(bundle.members || []);
      setMedia(bundle.media || null);
      setReadinessState(bundle.readiness || []);
      setPlayback(prev => {
        if (!prev || (bundle.playback && bundle.playback.revision >= prev.revision)) {
          return bundle.playback;
        }
        return prev;
      });
      setMessages(bundle.messages || []);
      setIsReconnecting(false);
    } catch (err) {
      console.warn('Refresh bundle error:', err);
    }
  }, []);

  // Setup Realtime Channels when active room changes
  useEffect(() => {
    if (!room?.id || !isSupabaseConfigured()) return;

    const roomId = room.id;
    let isSubscribed = true;

    // Supabase Channel for room updates
    const channel = supabase.channel(`room_${roomId}`, {
      config: {
        broadcast: { ack: true },
        presence: { key: user?.id || 'anon' },
      },
    });

    // Listen to database changes for playback state
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_playback_state',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          if (!isSubscribed) return;
          const updated = payload.new as RoomPlaybackState;
          if (updated && updated.room_id === roomId) {
            setPlayback(prev => {
              if (!prev || updated.revision >= prev.revision) {
                return updated;
              }
              return prev;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_member_readiness',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          if (!isSubscribed) return;
          const updated = payload.new as RoomReadiness;
          if (updated) {
            setReadinessState(prev => {
              const filtered = prev.filter(r => r.user_id !== updated.user_id);
              return [...filtered, updated];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_media',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          if (!isSubscribed) return;
          const newMedia = payload.new as RoomMedia;
          if (newMedia) {
            setMedia(newMedia);
            // Media changed: clear local ready state
            setReadinessState([]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          if (!isSubscribed) return;
          refreshBundle();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          if (!isSubscribed) return;
          const newMsg = payload.new as RoomMessage;
          if (newMsg) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [newMsg, ...prev].slice(0, 100);
            });
          }
        }
      );

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        setIsReconnecting(false);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsReconnecting(true);
      }
    });

    // Low-frequency heartbeat & presence ping (every 15s)
    const presenceTimer = setInterval(() => {
      if (isSubscribed && activeRoomIdRef.current) {
        supabase.rpc('rpc_ping_presence', { p_room_id: roomId }).then(() => {}, () => {});
      }
    }, 15000);

    // Fallback sync recovery interval (every 25s) to guarantee consistency without high traffic
    const syncRecoveryTimer = setInterval(() => {
      if (isSubscribed && activeRoomIdRef.current) {
        refreshBundle();
      }
    }, 25000);

    return () => {
      isSubscribed = false;
      clearInterval(presenceTimer);
      clearInterval(syncRecoveryTimer);
      channel.unsubscribe();
    };
  }, [room?.id, refreshBundle, user?.id]);

  // Actions
  const createRoom = async (roomName: string, displayName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('rpc_create_room', {
        p_room_name: roomName,
        p_display_name: displayName || allowedUser?.display_name || 'User',
      });

      if (err) throw err;

      const res = data as { room_id: string; code: string; name: string };
      saveRecentSession({ roomCode: res.code, roomName: res.name });

      // Join room context
      activeRoomIdRef.current = res.room_id;
      await refreshBundle();
      setIsLoading(false);
      return { success: true, code: res.code };
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }
  };

  const joinRoom = async (roomCode: string, displayName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('rpc_join_room', {
        p_code: roomCode,
        p_display_name: displayName || allowedUser?.display_name || 'User',
      });

      if (err) throw err;

      const res = data as { room_id: string; code: string; name: string };
      saveRecentSession({ roomCode: res.code, roomName: res.name });

      activeRoomIdRef.current = res.room_id;
      await refreshBundle();
      setIsLoading(false);
      return { success: true };
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }
  };

  const leaveRoom = async () => {
    if (room?.id) {
      try {
        await supabase.rpc('rpc_leave_room', { p_room_id: room.id });
      } catch {
        // Ignore
      }
    }
    setRoom(null);
    setMembers([]);
    setMedia(null);
    setReadinessState([]);
    setPlayback(null);
    setMessages([]);
    activeRoomIdRef.current = null;
  };

  const setLocalMediaFile = (newMedia: LocalMediaFile) => {
    setLocalMedia(prev => {
      if (prev?.objectUrl) {
        try {
          URL.revokeObjectURL(prev.objectUrl);
        } catch {
          // Ignore
        }
      }
      return newMedia;
    });
  };

  const removeLocalMediaFile = () => {
    setLocalMedia(prev => {
      if (prev?.objectUrl) {
        try {
          URL.revokeObjectURL(prev.objectUrl);
        } catch {
          // Ignore
        }
      }
      return null;
    });
  };

  const proposeNewMedia = async (title: string, fingerprint: string, duration: number, size: number) => {
    if (!room?.id) return false;
    setError(null);
    try {
      const { error: err } = await supabase.rpc('rpc_propose_media', {
        p_room_id: room.id,
        p_title: title,
        p_fingerprint: fingerprint,
        p_duration: duration,
        p_size: size,
      });

      if (err) throw err;

      // Update recent session with media title
      saveRecentSession({ roomCode: room.code, roomName: room.name, mediaTitle: title });
      await refreshBundle();
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    }
  };

  const setReadiness = async (isReady: boolean) => {
    if (!room?.id || !media) return;
    setError(null);
    try {
      const { error: err } = await supabase.rpc('rpc_set_readiness', {
        p_room_id: room.id,
        p_media_version: media.media_version,
        p_is_ready: isReady,
      });

      if (err) throw err;
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const updatePlayback = async (action: PlaybackAction, position?: number) => {
    if (!room?.id || !media || !playback) return;
    setError(null);
    const t0 = Date.now();

    try {
      const { data, error: err } = await supabase.rpc('rpc_update_playback', {
        p_room_id: room.id,
        p_media_version: media.media_version,
        p_action: action,
        p_position: position ?? null,
        p_expected_revision: playback.revision,
      });

      if (err) throw err;

      const updated = data as RoomPlaybackState & { server_time?: string };
      const t1 = Date.now();
      if (updated.server_updated_at) {
        calibratorRef.current.recordSample(t0, updated.server_updated_at, t1);
      }

      setPlayback(updated);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      // On error, refresh bundle to bring client back to authoritative state
      refreshBundle();
    }
  };

  const sendChatMessage = async (content: string): Promise<boolean> => {
    if (!room?.id) return false;
    try {
      const { error: err } = await supabase.rpc('rpc_send_message', {
        p_room_id: room.id,
        p_content: content,
      });

      if (err) throw err;
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    }
  };

  const clearError = () => setError(null);

  const value: RoomContextType = {
    room,
    members,
    media,
    readiness,
    playback,
    messages,
    isLoading,
    error,
    isReconnecting,
    localMedia,
    isFingerprintMatch,
    mediaMismatchReason,
    calibrator: calibratorRef.current,
    createRoom,
    joinRoom,
    leaveRoom,
    setLocalMediaFile,
    removeLocalMediaFile,
    proposeNewMedia,
    setReadiness,
    updatePlayback,
    sendChatMessage,
    refreshBundle,
    clearError,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};

export const useRoom = (): RoomContextType => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};
