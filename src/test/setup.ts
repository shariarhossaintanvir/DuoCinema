import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock URL.createObjectURL and revokeObjectURL
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => `blob:mock-url-${Math.random()}`);
  window.URL.revokeObjectURL = vi.fn();

  // Mock HTMLMediaElement prototype methods for jsdom
  window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.canPlayType = vi.fn().mockImplementation((type: string) => {
    if (type.includes('mp4') || type.includes('webm')) return 'probably';
    return '';
  });
}
