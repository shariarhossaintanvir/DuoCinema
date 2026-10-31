// Player and Synchronization Types

export interface LocalMediaFile {
  file: File;
  objectUrl: string;
  fingerprint: string;
  duration: number;
  size: number;
  name: string;
  type: string;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  objectUrl: string;
  originalName: string;
}

export type SyncStatus = 'synced' | 'adjusting' | 'seeking' | 'buffering' | 'desynced' | 'disconnected';

export interface ClockCalibration {
  serverOffsetMs: number;
  roundTripTimeMs: number;
  lastCalibratedAt: number;
}

export interface DriftReport {
  localSeconds: number;
  expectedServerSeconds: number;
  diffSeconds: number;
  syncStatus: SyncStatus;
}
