// DuoCinema Database & Application Types

export interface AllowedUser {
  user_id: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface RoomMember {
  id?: string;
  room_id?: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  last_seen_at: string;
}

export interface RoomMedia {
  id?: string;
  room_id?: string;
  media_version: number;
  title: string;
  fingerprint: string;
  duration_seconds: number;
  file_size_bytes: number;
  proposed_by: string;
  proposed_at: string;
}

export interface RoomReadiness {
  user_id: string;
  media_version: number;
  is_ready: boolean;
  updated_at: string;
}

export type PlaybackAction = 'init' | 'play' | 'pause' | 'seek' | 'skip' | 'media_change';

export interface RoomPlaybackState {
  room_id: string;
  media_version: number;
  is_playing: boolean;
  position_seconds: number;
  server_updated_at: string;
  revision: number;
  last_action_by: string | null;
  last_action_type: PlaybackAction;
}

export interface RoomMessage {
  id: string;
  room_id?: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export interface RoomBundle {
  room: Room;
  members: RoomMember[];
  media: RoomMedia | null;
  readiness: RoomReadiness[];
  playback: RoomPlaybackState;
  messages: RoomMessage[];
  server_time: string;
}

export interface RecentSession {
  roomCode: string;
  roomName: string;
  lastVisited: string;
  mediaTitle?: string;
}
