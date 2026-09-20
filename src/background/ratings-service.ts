import type { VideoRating } from '../shared/messages';
import { isValidVideoId } from '../youtube/video';

const RYD_BASE_URL = 'https://returnyoutubedislikeapi.com';
const CACHE_KEY = 'ytToolsRydCacheV1';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 750;
const MIN_REQUEST_GAP_MS = 700;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

interface CacheEntry {
  timestamp: number;
  data: VideoRating;
}

interface QueuedRequest {
  videoId: string;
  resolve: (value: VideoRating | null) => void;
  reject: (reason?: unknown) => void;
}

export class RatingService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<VideoRating | null>>();
  private readonly queue: QueuedRequest[] = [];
  private cacheLoaded = false;
  private cacheLoadPromise: Promise<void> | null = null;
  private queueRunning = false;
  private lastRequestAt = 0;
  private cooldownUntil = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  async get(videoId: string): Promise<VideoRating | null> {
    if (!isValidVideoId(videoId)) return null;

    await this.ensureCacheLoaded();
    const cached = this.getCached(videoId);
    if (cached) return cached;

    const existing = this.inFlight.get(videoId);
    if (existing) return existing;

    // Do not swallow network/rate-limit errors here. The background message
    // handler turns them into an explicit RatingResponse so the content script
    // can retry instead of permanently treating a failed request as "no data".
    const pending = this.enqueue(videoId).finally(() => this.inFlight.delete(videoId));

    this.inFlight.set(videoId, pending);
    return pending;
  }

  private async ensureCacheLoaded(): Promise<void> {
    if (this.cacheLoaded) return;
    if (this.cacheLoadPromise) return this.cacheLoadPromise;

    this.cacheLoadPromise = (async () => {
      try {
        const stored = await chrome.storage.local.get(CACHE_KEY);
        const records = stored[CACHE_KEY];
        if (!records || typeof records !== 'object') return;

        const now = Date.now();
        for (const [videoId, rawEntry] of Object.entries(records as Record<string, unknown>)) {
          if (!isValidVideoId(videoId) || !rawEntry || typeof rawEntry !== 'object') continue;

          const entry = rawEntry as Partial<CacheEntry>;
          if (
            typeof entry.timestamp === 'number' &&
            now - entry.timestamp < CACHE_TTL_MS &&
            entry.data
          ) {
            this.cache.set(videoId, entry as CacheEntry);
          }
        }
      } catch (error) {
        console.warn('[YouTube Tools] Could not restore rating cache.', error);
      } finally {
        this.cacheLoaded = true;
        this.cacheLoadPromise = null;
      }
    })();

    return this.cacheLoadPromise;
  }

  private getCached(videoId: string): VideoRating | null {
    const entry = this.cache.get(videoId);
    if (!entry) return null;

    if (Date.now() - entry.timestamp >= CACHE_TTL_MS) {
      this.cache.delete(videoId);
      this.schedulePersist();
      return null;
    }

    return entry.data;
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistCache();
    }, 750);
  }

  private async persistCache(): Promise<void> {
    const ordered = [...this.cache.entries()]
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, MAX_CACHE_ENTRIES);

    this.cache.clear();
    ordered.forEach(([key, value]) => this.cache.set(key, value));

    try {
      await chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(ordered) });
    } catch (error) {
      console.warn('[YouTube Tools] Could not persist rating cache.', error);
    }
  }

  private enqueue(videoId: string): Promise<VideoRating | null> {
    const promise = new Promise<VideoRating | null>((resolve, reject) => {
      this.queue.push({ videoId, resolve, reject });
    });
    void this.processQueue();
    return promise;
  }

  private async processQueue(): Promise<void> {
    if (this.queueRunning) return;
    this.queueRunning = true;

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        if (!task) continue;

        try {
          const data = await this.fetchRating(task.videoId);
          if (data) {
            this.cache.set(task.videoId, { timestamp: Date.now(), data });
            this.schedulePersist();
          }
          task.resolve(data);
        } catch (error) {
          task.reject(error);
        }
      }
    } finally {
      this.queueRunning = false;
    }
  }

  private async fetchRating(videoId: string): Promise<VideoRating | null> {
    const now = Date.now();
    const delay = Math.max(
      0,
      MIN_REQUEST_GAP_MS - (now - this.lastRequestAt),
      this.cooldownUntil - now,
    );
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    this.lastRequestAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${RYD_BASE_URL}/votes?videoId=${encodeURIComponent(videoId)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfterSeconds = Number(response.headers.get('Retry-After'));
        const cooldown = Number.isFinite(retryAfterSeconds)
          ? Math.max(RATE_LIMIT_COOLDOWN_MS, retryAfterSeconds * 1000)
          : RATE_LIMIT_COOLDOWN_MS;
        this.cooldownUntil = Date.now() + cooldown;
        throw new Error('RATE_LIMITED');
      }

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`RYD_HTTP_${response.status}`);

      const data = normalizeRydResponse(videoId, await response.json());
      if (!data) throw new Error('RYD_INVALID_RESPONSE');
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('RYD_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function normalizeRydResponse(videoId: string, payload: unknown): VideoRating | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const likes = Number(record.likes);
  const dislikes = Number(record.dislikes);
  const viewCount = Number(record.viewCount);

  if (!Number.isFinite(likes) || !Number.isFinite(dislikes)) return null;

  const totalVotes = likes + dislikes;
  const approvalPercent = totalVotes > 0 ? (likes / totalVotes) * 100 : null;

  return {
    videoId,
    likes: Math.max(0, Math.round(likes)),
    dislikes: Math.max(0, Math.round(dislikes)),
    viewCount: Number.isFinite(viewCount) ? Math.max(0, Math.round(viewCount)) : null,
    approvalPercent:
      approvalPercent === null ? null : Math.max(0, Math.min(100, approvalPercent)),
    deleted: Boolean(record.deleted),
    source: 'return-youtube-dislike',
  };
}
