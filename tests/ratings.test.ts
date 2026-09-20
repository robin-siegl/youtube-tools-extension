import { describe, expect, it } from 'vitest';
import { normalizeRydResponse } from '../src/background/ratings-service';

describe('normalizeRydResponse', () => {
  it('normalizes likes, dislikes and approval percentage', () => {
    const rating = normalizeRydResponse('dQw4w9WgXcQ', {
      likes: 900,
      dislikes: 100,
      viewCount: 5000,
      deleted: false,
    });

    expect(rating).toMatchObject({
      videoId: 'dQw4w9WgXcQ',
      likes: 900,
      dislikes: 100,
      viewCount: 5000,
      approvalPercent: 90,
      source: 'return-youtube-dislike',
    });
  });

  it('rejects invalid API data', () => {
    expect(normalizeRydResponse('dQw4w9WgXcQ', { likes: 'wat' })).toBeNull();
  });
});
