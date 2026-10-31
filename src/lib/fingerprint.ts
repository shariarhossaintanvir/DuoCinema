// Chunked Content Fingerprinting Engine
// Computes a deterministic 64-character SHA-256 fingerprint without loading multi-gigabyte files into RAM.

export interface FingerprintProgressCallback {
  (progress: number): void;
}

/**
 * Converts an ArrayBuffer to a 64-character lowercase hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const hexCodes: string[] = new Array(byteArray.length);
  for (let i = 0; i < byteArray.length; i++) {
    hexCodes[i] = byteArray[i].toString(16).padStart(2, '0');
  }
  return hexCodes.join('');
}

/**
 * Reads a sliced chunk of a File as ArrayBuffer using a Promise.
 */
function readSlice(file: File, start: number, end: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const slice = file.slice(start, end);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read slice as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsArrayBuffer(slice);
  });
}

/**
 * Computes a deterministic SHA-256 fingerprint for a local video file.
 * Uses bounded 2MB/1MB chunk samples across the file (head, 25%, 50%, 75%, tail)
 * combined with exact file size and duration.
 * Constant memory usage < 4MB RAM, runs efficiently on any file size (e.g. 500MB to 50GB).
 */
export async function computeFileFingerprint(
  file: File,
  durationSeconds: number,
  onProgress?: FingerprintProgressCallback,
  signal?: AbortSignal
): Promise<string> {
  const size = file.size;
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB
  const MID_CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB

  const intermediateHashes: string[] = [];

  if (size <= CHUNK_SIZE * 2) {
    // Small file: hash the whole file in two chunks
    if (signal?.aborted) throw new Error('Fingerprinting cancelled');
    onProgress?.(0.2);

    const fullBuffer = await readSlice(file, 0, size);
    if (signal?.aborted) throw new Error('Fingerprinting cancelled');

    const digest = await crypto.subtle.digest('SHA-256', fullBuffer);
    intermediateHashes.push(bufferToHex(digest));
    onProgress?.(0.8);
  } else {
    // Large file: Sample strategically
    const samplePoints: { start: number; end: number }[] = [
      // 1. Head chunk (0 to 2MB)
      { start: 0, end: Math.min(size, CHUNK_SIZE) },
      // 2. 25% mark (1MB)
      {
        start: Math.floor(size * 0.25),
        end: Math.min(size, Math.floor(size * 0.25) + MID_CHUNK_SIZE),
      },
      // 3. 50% mark (1MB)
      {
        start: Math.floor(size * 0.50),
        end: Math.min(size, Math.floor(size * 0.50) + MID_CHUNK_SIZE),
      },
      // 4. 75% mark (1MB)
      {
        start: Math.floor(size * 0.75),
        end: Math.min(size, Math.floor(size * 0.75) + MID_CHUNK_SIZE),
      },
      // 5. Tail chunk (last 2MB)
      { start: Math.max(0, size - CHUNK_SIZE), end: size },
    ];

    for (let i = 0; i < samplePoints.length; i++) {
      if (signal?.aborted) throw new Error('Fingerprinting cancelled');

      const pt = samplePoints[i];
      const buffer = await readSlice(file, pt.start, pt.end);
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      intermediateHashes.push(bufferToHex(digest));

      onProgress?.(Math.round(((i + 1) / samplePoints.length) * 85) / 100);
    }
  }

  // Combine intermediate chunk hashes with exact byte size and rounded duration
  const roundedDuration = Math.round(durationSeconds * 100) / 100;
  const manifestString = `${intermediateHashes.join(':')}::size=${size}::dur=${roundedDuration}`;
  const encoder = new TextEncoder();
  const finalDigest = await crypto.subtle.digest('SHA-256', encoder.encode(manifestString));

  onProgress?.(1.0);
  return bufferToHex(finalDigest);
}

/**
 * Formats seconds into HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats byte size into human readable string (MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(2);
  return `${val} ${units[i]}`;
}
