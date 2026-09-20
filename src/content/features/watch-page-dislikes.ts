import type { RatingRequest, RatingResponse, VideoRating } from '../../shared/messages';
import { getVideoIdFromUrl } from '../../youtube/video';
import type { ContentFeature, FeatureContext } from '../feature';

const DISLIKE_BUTTON_SELECTOR = [
  'ytd-watch-metadata segmented-like-dislike-button-view-model dislike-button-view-model button',
  'segmented-like-dislike-button-view-model dislike-button-view-model button',
].join(',');

const ICON_BUTTON_CLASS = 'ytSpecButtonShapeNextIconButton';
const ICON_LEADING_CLASS = 'ytSpecButtonShapeNextIconLeading';
const COUNT_CLASS = 'ytfc-watch-dislike-count';
const RETRY_DELAY_MS = 15_000;

interface OriginalButtonClasses {
  hadIconButton: boolean;
  hadIconLeading: boolean;
}

export class WatchPageDislikesFeature implements ContentFeature {
  readonly id = 'watch-page-dislikes';

  private readonly ratingsByVideoId = new Map<string, VideoRating>();
  private readonly noRatingVideoIds = new Set<string>();
  private readonly retryAfterByVideoId = new Map<string, number>();
  private readonly touchedButtons = new Map<HTMLButtonElement, OriginalButtonClasses>();
  private pendingVideoId: string | null = null;
  private currentVideoId: string | null = null;

  scan(context: FeatureContext, _cards: readonly HTMLElement[]): void {
    if (!context.settings.showRatings) {
      this.restoreButtons();
      return;
    }

    const videoId = getVideoIdFromUrl(location.href, location.origin);
    if (!videoId) {
      this.currentVideoId = null;
      this.restoreButtons();
      return;
    }

    if (this.currentVideoId !== videoId) {
      this.currentVideoId = videoId;
      this.restoreButtons();
    }

    const button = this.findDislikeButton();
    if (!button) return;

    const cached = this.ratingsByVideoId.get(videoId);
    if (cached) {
      this.renderCount(button, cached.dislikes);
      return;
    }

    if (this.noRatingVideoIds.has(videoId)) return;
    if (this.pendingVideoId === videoId) return;

    const retryAfter = this.retryAfterByVideoId.get(videoId) ?? 0;
    if (retryAfter > Date.now()) return;

    this.pendingVideoId = videoId;
    void this.loadRating(context, videoId);
  }

  settingsChanged(context: FeatureContext): void {
    if (!context.settings.showRatings) this.restoreButtons();
  }

  navigationStart(): void {
    this.currentVideoId = null;
    this.pendingVideoId = null;
    this.restoreButtons();
  }

  destroy(): void {
    this.restoreButtons();
    this.pendingVideoId = null;
    this.currentVideoId = null;
  }

  private async loadRating(context: FeatureContext, videoId: string): Promise<void> {
    const request: RatingRequest = { type: 'YTTOOLS_GET_RATING', videoId };

    try {
      const response = (await chrome.runtime.sendMessage(request)) as RatingResponse | undefined;

      if (!response) throw new Error('NO_RESPONSE');
      if (!response.ok) throw new Error(response.error);

      if (!response.data) {
        this.noRatingVideoIds.add(videoId);
        return;
      }

      this.retryAfterByVideoId.delete(videoId);
      this.ratingsByVideoId.set(videoId, response.data);

      if (this.currentVideoId !== videoId || !context.settings.showRatings) return;

      const button = this.findDislikeButton();
      if (button) this.renderCount(button, response.data.dislikes);
      else context.scheduleScan(0);
    } catch (error) {
      console.warn('[YouTube Tools] Watch-page dislike lookup failed.', videoId, error);
      this.retryAfterByVideoId.set(videoId, Date.now() + RETRY_DELAY_MS);
    } finally {
      if (this.pendingVideoId === videoId) this.pendingVideoId = null;
    }
  }

  private findDislikeButton(): HTMLButtonElement | null {
    const buttons = document.querySelectorAll<HTMLButtonElement>(DISLIKE_BUTTON_SELECTOR);

    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      return button;
    }

    return null;
  }

  private renderCount(button: HTMLButtonElement, dislikes: number): void {
    if (!this.touchedButtons.has(button)) {
      this.touchedButtons.set(button, {
        hadIconButton: button.classList.contains(ICON_BUTTON_CLASS),
        hadIconLeading: button.classList.contains(ICON_LEADING_CLASS),
      });
    }

    button.classList.remove(ICON_BUTTON_CLASS);
    button.classList.add(ICON_LEADING_CLASS);

    let count = button.querySelector<HTMLDivElement>(`.${COUNT_CLASS}`);
    if (!count) {
      count = document.createElement('div');
      count.className = `ytSpecButtonShapeNextButtonTextContent ytSpecButtonShapeNextElevatedContent ${COUNT_CLASS}`;
      count.dataset.ytfcWatchDislikeCount = 'true';
      count.title = 'Estimated dislikes from Return YouTube Dislike';

      const touchFeedback = button.querySelector('yt-touch-feedback-shape');
      if (touchFeedback) button.insertBefore(count, touchFeedback);
      else button.appendChild(count);
    }

    count.textContent = this.compactNumber(dislikes);
  }

  private restoreButtons(): void {
    for (const [button, original] of this.touchedButtons) {
      button.querySelector(`.${COUNT_CLASS}`)?.remove();

      if (button.isConnected) {
        button.classList.toggle(ICON_BUTTON_CLASS, original.hadIconButton);
        button.classList.toggle(ICON_LEADING_CLASS, original.hadIconLeading);
      }
    }

    this.touchedButtons.clear();
  }

  private compactNumber(value: number): string {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);
    } catch {
      return String(value);
    }
  }
}
