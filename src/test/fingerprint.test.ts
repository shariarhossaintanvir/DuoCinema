import { describe, it, expect } from 'vitest';
import { formatDuration, formatBytes, computeFileFingerprint } from '@/lib/fingerprint';

describe('Fingerprint & Formatting Utilities', () => {
  it('formats duration in seconds to standard MM:SS or HH:MM:SS', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(45)).toBe('00:45');
    expect(formatDuration(75)).toBe('01:15');
    expect(formatDuration(3665)).toBe('01:01:05');
    expect(formatDuration(7325)).toBe('02:02:05');
    expect(formatDuration(-5)).toBe('00:00');
    expect(formatDuration(NaN)).toBe('00:00');
  });

  it('formats byte sizes into readable units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 * 1024 * 15)).toBe('15.00 MB');
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.50 GB');
  });

  it('computes a consistent 64-character SHA-256 fingerprint for a File', async () => {
    const content = new Uint8Array(1024 * 100); // 100 KB
    content.fill(42);
    const file = new File([content], 'movie.mp4', { type: 'video/mp4' });

    const fp1 = await computeFileFingerprint(file, 120.5);
    const fp2 = await computeFileFingerprint(file, 120.5);

    expect(fp1).toHaveLength(64);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);
    expect(fp1).toBe(fp2); // Deterministic
  });

  it('produces different fingerprints when duration or content differs', async () => {
    const contentA = new Uint8Array([1, 2, 3, 4, 5]);
    const contentB = new Uint8Array([1, 2, 3, 4, 6]);

    const fileA = new File([contentA], 'movie.mp4', { type: 'video/mp4' });
    const fileB = new File([contentB], 'movie.mp4', { type: 'video/mp4' });

    const fpA = await computeFileFingerprint(fileA, 100);
    const fpB = await computeFileFingerprint(fileB, 100);
    const fpADifferentDur = await computeFileFingerprint(fileA, 105);

    expect(fpA).not.toBe(fpB);
    expect(fpA).not.toBe(fpADifferentDur);
  });
});
