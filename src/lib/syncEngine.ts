// Server-Authoritative Playback Synchronization Engine

import { RoomPlaybackState } from '@/types/database';
import { ClockCalibration, DriftReport, SyncStatus } from '@/types/player';

export const DRIFT_IGNORE_THRESHOLD = 0.25; // 250ms: considered in sync
export const DRIFT_SEEK_THRESHOLD = 1.0;   // 1.0s: trigger hard seek
export const GENTLE_SPEED_FAST = 1.05;      // catch up
export const GENTLE_SPEED_SLOW = 0.95;      // slow down
export const NORMAL_SPEED = 1.0;

export class ClockCalibrator {
  private offsetMs = 0;
  private samples: number[] = [];
  private readonly maxSamples = 5;

  /**
   * Updates clock skew estimate using NTP-like round trip calculation.
   * clientSendTime: Date.now() right before network call
   * serverTimeStr: ISO string returned from server
   * clientRecvTime: Date.now() when response arrived
   */
  public recordSample(clientSendTime: number, serverTimeStr: string, clientRecvTime: number): void {
    const serverTimeMs = new Date(serverTimeStr).getTime();
    if (isNaN(serverTimeMs)) return;

    const rtt = Math.max(1, clientRecvTime - clientSendTime);
    // Estimated server time at clientRecvTime: serverTimeMs + (rtt / 2)
    const estimatedServerAtRecv = serverTimeMs + rtt / 2;
    const sampleOffset = estimatedServerAtRecv - clientRecvTime;

    this.samples.push(sampleOffset);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    // Median filter for jitter rejection
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    this.offsetMs = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  /**
   * Returns current estimated server epoch timestamp in ms.
   */
  public nowServerTime(): number {
    return Date.now() + this.offsetMs;
  }

  public getCalibration(): ClockCalibration {
    return {
      serverOffsetMs: Math.round(this.offsetMs),
      roundTripTimeMs: this.samples.length > 0 ? this.samples[this.samples.length - 1] : 0,
      lastCalibratedAt: Date.now(),
    };
  }
}

/**
 * Derives the exact authoritative position in seconds.
 * While playing: position_seconds + (nowServer - server_updated_at)
 * While paused: position_seconds
 */
export function computeExpectedPosition(
  playbackState: RoomPlaybackState,
  durationSeconds: number,
  calibrator: ClockCalibrator
): number {
  if (durationSeconds <= 0) return 0;

  if (!playbackState.is_playing) {
    return Math.min(durationSeconds, Math.max(0, playbackState.position_seconds));
  }

  const serverUpdatedMs = new Date(playbackState.server_updated_at).getTime();
  const currentServerMs = calibrator.nowServerTime();
  const elapsedSeconds = Math.max(0, (currentServerMs - serverUpdatedMs) / 1000);

  const calculated = playbackState.position_seconds + elapsedSeconds;
  return Math.min(durationSeconds, Math.max(0, calculated));
}

/**
 * Evaluates local video drift against server authoritative timeline.
 */
export function evaluateDrift(
  localCurrentTime: number,
  expectedServerTime: number,
  isBuffering = false
): DriftReport {
  if (isBuffering) {
    return {
      localSeconds: localCurrentTime,
      expectedServerSeconds: expectedServerTime,
      diffSeconds: 0,
      syncStatus: 'buffering',
    };
  }

  const diff = localCurrentTime - expectedServerTime;
  const absDiff = Math.abs(diff);

  let syncStatus: SyncStatus = 'synced';
  if (absDiff > DRIFT_SEEK_THRESHOLD) {
    syncStatus = 'seeking';
  } else if (absDiff > DRIFT_IGNORE_THRESHOLD) {
    syncStatus = 'adjusting';
  }

  return {
    localSeconds: localCurrentTime,
    expectedServerSeconds: expectedServerTime,
    diffSeconds: diff,
    syncStatus,
  };
}
