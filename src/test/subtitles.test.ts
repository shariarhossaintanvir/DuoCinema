import { describe, it, expect } from 'vitest';
import { parseSrtToVtt } from '@/lib/subtitles';

describe('Subtitle Parser (parseSrtToVtt)', () => {
  it('converts basic SRT blocks into valid WebVTT format', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,500
Hello, Welcome to DuoCinema!

2
00:00:05,200 --> 00:00:08,800
Enjoy the movie together.`;

    const vtt = parseSrtToVtt(srt);
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:01.000 --> 00:00:04.500');
    expect(vtt).toContain('Hello, Welcome to DuoCinema!');
    expect(vtt).toContain('00:00:05.200 --> 00:00:08.800');
    expect(vtt).toContain('Enjoy the movie together.');
  });

  it('normalizes 2-part timestamps mm:ss,ms to 00:mm:ss.ms', () => {
    const srt = `1
01:30,250 --> 01:35,500
Scene change`;

    const vtt = parseSrtToVtt(srt);
    expect(vtt).toContain('00:01:30.250 --> 00:01:35.500');
  });

  it('preserves Unicode and Bengali script without corruption', () => {
    const srt = `1
00:00:10,000 --> 00:00:14,000
বাংলা সাবটাইটেল - স্বাগতম ডুওসিনেমায়!`;

    const vtt = parseSrtToVtt(srt);
    expect(vtt).toContain('বাংলা সাবটাইটেল - স্বাগতম ডুওসিনেমায়!');
  });

  it('sanitizes dangerous script and event handler tags', () => {
    const srt = `1
00:00:15,000 --> 00:00:20,000
<script>alert("hack")</script>Safe text <img src="x" onerror="evil()" /><b>Bold text</b>`;

    const vtt = parseSrtToVtt(srt);
    expect(vtt).not.toContain('<script>');
    expect(vtt).not.toContain('alert("hack")');
    expect(vtt).not.toContain('onerror');
    expect(vtt).toContain('Safe text');
    expect(vtt).toContain('<b>Bold text</b>');
  });

  it('handles CRLF and CR line endings gracefully', () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:02,000\r\nLine 1\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nLine 2";
    const vtt = parseSrtToVtt(srt);
    expect(vtt).toContain('Line 1');
    expect(vtt).toContain('Line 2');
  });
});
