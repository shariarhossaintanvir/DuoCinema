// Safe SRT to WebVTT Subtitle Parser with UTF-8 / Bengali support and HTML sanitization

import { SubtitleTrack } from '@/types/player';

/**
 * Escapes characters that could be interpreted as dangerous HTML.
 * Preserves safe text and unicode.
 */
function sanitizeSubtitleLine(line: string): string {
  // Strip dangerous tag structures: scripts, iframes, img with onerror, etc.
  let cleaned = line
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Only allow standard closed inline tags: <b>, <i>, <u>, </b>, </i>, </u>
  // Replace other potential tags with escaped entities
  cleaned = cleaned.replace(/<(?!\/?([biu])>)[^>]*>/gi, '');

  return cleaned;
}

/**
 * Normalizes SRT timestamp string to WebVTT timestamp format: 00:00:00.000
 */
function normalizeTimestamp(timeStr: string): string {
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');

  if (parts.length === 2) {
    // mm:ss.ms -> 00:mm:ss.ms
    return `00:${parts[0].padStart(2, '0')}:${parts[1]}`;
  }

  if (parts.length === 3) {
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1].padStart(2, '0');
    const seconds = parts[2];
    return `${hours}:${minutes}:${seconds}`;
  }

  return clean;
}

/**
 * Converts raw SRT text to valid WebVTT string safely.
 */
export function parseSrtToVtt(srtText: string): string {
  // Normalize line endings to \n
  const normalized = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const vttLines: string[] = ['WEBVTT', ''];

  const timeRegex = /((?:\d{1,2}:)?\d{2}:\d{2}[,\.]\d{2,3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[,\.]\d{2,3})/;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');
    let timeLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (timeRegex.test(lines[i])) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) {
      // Not a valid subtitle block
      continue;
    }

    const match = lines[timeLineIndex].match(timeRegex);
    if (!match) continue;

    const startTime = normalizeTimestamp(match[1]);
    const endTime = normalizeTimestamp(match[2]);

    vttLines.push(`${startTime} --> ${endTime}`);

    // Remaining lines are subtitle text
    const textLines = lines.slice(timeLineIndex + 1);
    for (const textLine of textLines) {
      vttLines.push(sanitizeSubtitleLine(textLine));
    }

    vttLines.push('');
  }

  return vttLines.join('\n');
}

/**
 * Reads local subtitle file (.srt or .vtt), validates and converts it into a local WebVTT Blob URL.
 */
export async function createSubtitleTrackFromFile(file: File): Promise<SubtitleTrack> {
  const text = await file.text();
  const lowerName = file.name.toLowerCase();
  let vttContent = '';

  if (lowerName.endsWith('.srt')) {
    vttContent = parseSrtToVtt(text);
  } else if (lowerName.endsWith('.vtt')) {
    // If it's already a VTT file, ensure WEBVTT header and sanitize lines
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n').map(sanitizeSubtitleLine);
    if (!lines[0] || !lines[0].startsWith('WEBVTT')) {
      lines.unshift('WEBVTT', '');
    }
    vttContent = lines.join('\n');
  } else {
    throw new Error('Unsupported subtitle format. Please select an .srt or .vtt file.');
  }

  const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);

  // Label from filename
  const label = file.name.replace(/\.[^/.]+$/, '').slice(0, 30);

  return {
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    label: label || 'Subtitle',
    language: 'en',
    objectUrl,
    originalName: file.name,
  };
}

export function revokeSubtitleTrack(track: SubtitleTrack): void {
  if (track.objectUrl) {
    try {
      URL.revokeObjectURL(track.objectUrl);
    } catch {
      // Ignore
    }
  }
}
