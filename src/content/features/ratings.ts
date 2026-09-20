import { createSvgIcon } from '../../shared/dom';
import type { RatingRequest, RatingResponse, VideoRating } from '../../shared/messages';
import { findThumbnailTarget, getVideoId } from '../../youtube/cards';
import { RECOMMENDATION_ACTIONS } from '../../youtube/feedback';
import { EXTENSION_PREFIX, HIDDEN_SHORTS_CLASS } from '../constants';
import type { ContentFeature, FeatureContext } from '../feature';

const THUMB_UP_PATH =
  'M2 21h4V9H2v12Zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 1 6.59 7.59C6.22 7.95 6 8.45 6 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2Z';
const THUMB_DOWN_PATH = RECOMMENDATION_ACTIONS.notInterested.iconPath;

export class RatingsFeature implements ContentFeature {
  readonly id = 'ratings';
  private readonly badgesByCard = new Map<HTMLElement, HTMLDivElement>();
  private requestedVideoByCard = new WeakMap<HTMLElement, string>();
  private observer: IntersectionObserver | null = null;
  private context: FeatureContext | null = null;

  start(context: FeatureContext): void {
    this.context = context;
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
          void this.loadRating(entry.target);
        }
      },
      { root: null, rootMargin: '500px 0px', threshold: 0.01 },
    );
  }

  scan(context: FeatureContext, cards: readonly HTMLElement[]): void {
    this.cleanup();

    if (!context.settings.showRatings) {
      this.clear();
      return;
    }

    for (const card of cards) this.observer?.observe(card);
  }

  position(context: FeatureContext): void {
    for (const [card, badge] of this.badgesByCard) {
      if (!card.isConnected || !badge.isConnected) continue;
      this.positionForCard(context, card, badge);
    }
  }

  settingsChanged(context: FeatureContext): void {
    if (!context.settings.showRatings) this.clear();
  }

  navigationStart(): void {
    this.clear();
  }

  destroy(): void {
    this.clear();
    this.observer?.disconnect();
    this.observer = null;
    this.context = null;
  }

  private async loadRating(card: HTMLElement): Promise<void> {
    const context = this.context;
    if (!context?.settings.showRatings || !card.isConnected) return;
    if (card.classList.contains(HIDDEN_SHORTS_CLASS)) return;

    const videoId = getVideoId(card);
    if (!videoId) return;
    if (this.requestedVideoByCard.get(card) === videoId) return;
    this.requestedVideoByCard.set(card, videoId);

    let badge = this.badgesByCard.get(card);
    if (!badge?.isConnected) {
      badge = this.createBadge();
      context.overlay.append(badge);
      this.badgesByCard.set(card, badge);
    }

    badge.hidden = true;
    const rating = await this.requestRating(videoId);

    if (!card.isConnected || !context.settings.showRatings) return;
    if (getVideoId(card) !== videoId) {
      this.requestedVideoByCard.delete(card);
      return;
    }

    if (rating) {
      this.renderBadge(badge, rating);
      context.schedulePosition();
    }
  }

  private createBadge(): HTMLDivElement {
    const badge = document.createElement('div');
    badge.className = `${EXTENSION_PREFIX}-rating`;
    badge.hidden = true;
    badge.dataset.ytfcRating = 'true';

    const ratio = document.createElement('span');
    ratio.className = `${EXTENSION_PREFIX}-rating__ratio`;
    badge.appendChild(ratio);

    const divider = document.createElement('span');
    divider.className = `${EXTENSION_PREFIX}-rating__divider`;
    divider.setAttribute('aria-hidden', 'true');
    badge.appendChild(divider);

    badge.appendChild(this.createMetric('likes', THUMB_UP_PATH));
    badge.appendChild(this.createMetric('dislikes', THUMB_DOWN_PATH));
    return badge;
  }

  private createMetric(kind: 'likes' | 'dislikes', pathData: string): HTMLSpanElement {
    const metric = document.createElement('span');
    metric.className = `${EXTENSION_PREFIX}-rating__metric`;
    metric.dataset.kind = kind;
    metric.appendChild(createSvgIcon(pathData, `${EXTENSION_PREFIX}-rating__icon`));

    const value = document.createElement('span');
    value.className = `${EXTENSION_PREFIX}-rating__value`;
    metric.appendChild(value);
    return metric;
  }

  private renderBadge(badge: HTMLDivElement, rating: VideoRating): void {
    const ratio = badge.querySelector<HTMLElement>(`.${EXTENSION_PREFIX}-rating__ratio`);
    const likeValue = badge.querySelector<HTMLElement>(
      `[data-kind="likes"] .${EXTENSION_PREFIX}-rating__value`,
    );
    const dislikeValue = badge.querySelector<HTMLElement>(
      `[data-kind="dislikes"] .${EXTENSION_PREFIX}-rating__value`,
    );
    if (!ratio || !likeValue || !dislikeValue) return;

    const approval = rating.approvalPercent;
    ratio.textContent = approval === null ? '—' : `${Math.round(approval)}%`;
    likeValue.textContent = this.compactNumber(rating.likes);
    dislikeValue.textContent = this.compactNumber(rating.dislikes);

    const detailedApproval = approval === null ? 'ratio unavailable' : `${approval.toFixed(1)}% positive`;
    badge.setAttribute(
      'aria-label',
      `${this.compactNumber(rating.likes)} likes, ${this.compactNumber(
        rating.dislikes,
      )} estimated dislikes, ${detailedApproval}`,
    );
    badge.title = `Return YouTube Dislike estimate · ${this.compactNumber(
      rating.likes,
    )} likes · ${this.compactNumber(rating.dislikes)} dislikes · ${detailedApproval}`;
    badge.hidden = false;
  }

  private async requestRating(videoId: string): Promise<VideoRating | null> {
    const request: RatingRequest = { type: 'YTTOOLS_GET_RATING', videoId };

    try {
      const response = (await chrome.runtime.sendMessage(request)) as RatingResponse | undefined;
      return response?.ok ? response.data : null;
    } catch {
      return null;
    }
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

  private positionForCard(
    context: FeatureContext,
    card: HTMLElement,
    badge: HTMLDivElement,
  ): void {
    if (!context.settings.showRatings || card.classList.contains(HIDDEN_SHORTS_CLASS)) {
      badge.hidden = true;
      return;
    }

    if (!badge.textContent?.trim()) {
      badge.hidden = true;
      return;
    }

    const rect = findThumbnailTarget(card).getBoundingClientRect();
    const outsideViewport =
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.bottom <= 0 ||
      rect.right <= 0 ||
      rect.top >= window.innerHeight ||
      rect.left >= window.innerWidth;

    badge.hidden = outsideViewport;
    if (outsideViewport) return;

    badge.style.left = `${Math.round(rect.left + 8)}px`;
    badge.style.top = `${Math.round(rect.bottom - badge.offsetHeight - 8)}px`;
  }

  private cleanup(): void {
    for (const [card, badge] of this.badgesByCard) {
      if (card.isConnected && badge.isConnected) continue;
      this.observer?.unobserve(card);
      badge.remove();
      this.badgesByCard.delete(card);
    }
  }

  private clear(): void {
    this.observer?.disconnect();
    for (const badge of this.badgesByCard.values()) badge.remove();
    this.badgesByCard.clear();
    this.requestedVideoByCard = new WeakMap();
  }
}
