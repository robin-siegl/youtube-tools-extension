const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isValidVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID_PATTERN.test(value);
}

export function getVideoIdFromUrl(value: string, base = 'https://www.youtube.com'): string | null {
  try {
    const url = new URL(value, base);

    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return isValidVideoId(id) ? id : null;
    }

    const shortsMatch = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})(?:\/|$)/);
    return shortsMatch && isValidVideoId(shortsMatch[1]) ? shortsMatch[1] : null;
  } catch {
    return null;
  }
}

export function isShortsUrl(value: string, base = 'https://www.youtube.com'): boolean {
  try {
    return new URL(value, base).pathname.startsWith('/shorts/');
  } catch {
    return false;
  }
}
