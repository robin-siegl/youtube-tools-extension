export interface VideoRating {
  videoId: string;
  likes: number;
  dislikes: number;
  viewCount: number | null;
  approvalPercent: number | null;
  deleted: boolean;
  source: 'return-youtube-dislike';
}

export interface RatingRequest {
  type: 'YTTOOLS_GET_RATING';
  videoId: string;
}

export type RatingResponse =
  { ok: true; data: VideoRating | null } | { ok: false; data: null; error: string };

export function isRatingRequest(value: unknown): value is RatingRequest {
  if (!value || typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;
  return record.type === 'YTTOOLS_GET_RATING' && typeof record.videoId === 'string';
}
