import { describe, expect, it } from 'vitest';
import { getVideoIdFromUrl, isShortsUrl, isValidVideoId } from '../src/youtube/video';

describe('video URL helpers', () => {
  it('extracts a watch video id', () => {
    expect(getVideoIdFromUrl('/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts a Shorts video id', () => {
    expect(getVideoIdFromUrl('/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('rejects malformed ids', () => {
    expect(getVideoIdFromUrl('/watch?v=too-short')).toBeNull();
    expect(isValidVideoId('too-short')).toBe(false);
  });

  it('detects Shorts by URL structure instead of translated labels', () => {
    expect(isShortsUrl('/shorts/dQw4w9WgXcQ')).toBe(true);
    expect(isShortsUrl('/watch?v=dQw4w9WgXcQ')).toBe(false);
  });
});
