import { describe, it, expect } from 'vitest';
import {
  ClockCalibrator,
  computeExpectedPosition,
  evaluateDrift,
  DRIFT_IGNORE_THRESHOLD,
  DRIFT_SEEK_THRESHOLD,
} from '@/lib/syncEngine';
import { RoomPlaybackState } from '@/types/database';

describe('Playback Synchronization Engine', () => {
  it('calibrates server clock offset with round-trip measurement', () => {
    const calibrator = new ClockCalibrator();

    const t0 = 1000;
    const serverTimestamp = '1970-01-01T00:00:01.050Z'; // 1050 ms
    const t1 = 1100; // RTT = 100ms. Estimated server at t1: 1050 + 50 = 1100. Offset = 0ms.

    calibrator.recordSample(t0, serverTimestamp, t1);
    expect(calibrator.getCalibration().serverOffsetMs).toBe(0);

    // Another sample where server clock is 500ms ahead
    const t2 = 2000;
    const serverAhead = '1970-01-01T00:00:02.530Z'; // 2530 ms
    const t3 = 2060; // RTT = 60ms. Estimated server at t3: 2530 + 30 = 2560. Offset = +500ms.

    calibrator.recordSample(t2, serverAhead, t3);
    const calibration = calibrator.getCalibration();
    expect(calibration.serverOffsetMs).toBeGreaterThanOrEqual(0);
  });

  it('computes exact position when paused', () => {
    const calibrator = new ClockCalibrator();
    const state: RoomPlaybackState = {
      room_id: 'room-1',
      media_version: 1,
      is_playing: false,
      position_seconds: 42.5,
      server_updated_at: new Date(Date.now() - 5000).toISOString(),
      revision: 3,
      last_action_by: 'user-1',
      last_action_type: 'pause',
    };

    const pos = computeExpectedPosition(state, 120, calibrator);
    expect(pos).toBe(42.5);
  });

  it('computes elapsed timeline position when playing', () => {
    const calibrator = new ClockCalibrator();
    const tenSecondsAgo = new Date(calibrator.nowServerTime() - 10000).toISOString();

    const state: RoomPlaybackState = {
      room_id: 'room-1',
      media_version: 1,
      is_playing: true,
      position_seconds: 20.0,
      server_updated_at: tenSecondsAgo,
      revision: 4,
      last_action_by: 'user-1',
      last_action_type: 'play',
    };

    const pos = computeExpectedPosition(state, 120, calibrator);
    // Should be approximately 20 + 10 = 30 seconds
    expect(pos).toBeGreaterThanOrEqual(29.8);
    expect(pos).toBeLessThanOrEqual(30.5);
  });

  it('clamps running position to duration', () => {
    const calibrator = new ClockCalibrator();
    const oneHourAgo = new Date(calibrator.nowServerTime() - 3600000).toISOString();

    const state: RoomPlaybackState = {
      room_id: 'room-1',
      media_version: 1,
      is_playing: true,
      position_seconds: 50.0,
      server_updated_at: oneHourAgo,
      revision: 5,
      last_action_by: 'user-1',
      last_action_type: 'play',
    };

    const pos = computeExpectedPosition(state, 100, calibrator);
    expect(pos).toBe(100);
  });

  it('evaluates drift correctly: synced vs gentle adjusting vs hard seek', () => {
    // 1. Within 0.25s: synced
    const inSync = evaluateDrift(10.1, 10.0);
    expect(inSync.syncStatus).toBe('synced');
    expect(inSync.diffSeconds).toBeCloseTo(0.1);

    // 2. Between 0.25s and 1.0s: adjusting
    const gentleFast = evaluateDrift(9.5, 10.0); // local behind by 0.5s
    expect(gentleFast.syncStatus).toBe('adjusting');
    expect(gentleFast.diffSeconds).toBeCloseTo(-0.5);

    const gentleSlow = evaluateDrift(10.6, 10.0); // local ahead by 0.6s
    expect(gentleSlow.syncStatus).toBe('adjusting');

    // 3. Greater than 1.0s: seeking
    const hardSeek = evaluateDrift(12.5, 10.0); // local ahead by 2.5s
    expect(hardSeek.syncStatus).toBe('seeking');

    // 4. Buffering state
    const buffering = evaluateDrift(10.0, 10.0, true);
    expect(buffering.syncStatus).toBe('buffering');
  });
});
