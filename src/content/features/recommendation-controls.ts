import { createSvgIcon } from '../../shared/dom';
import { findMenuButton, findThumbnailTarget } from '../../youtube/cards';
import {
  FeedbackActions,
  RECOMMENDATION_ACTIONS,
  type RecommendationActionKey,
} from '../../youtube/feedback';
import { EXTENSION_PREFIX, HIDDEN_SHORTS_CLASS } from '../constants';
import type { ContentFeature, FeatureContext } from '../feature';

export class RecommendationControlsFeature implements ContentFeature {
  readonly id = 'recommendation-controls';
  private readonly controlsByCard = new Map<HTMLElement, HTMLDivElement>();
  private readonly feedback = new FeedbackActions();
  private resizeObserver: ResizeObserver | null = null;

  start(context: FeatureContext): void {
    this.resizeObserver = new ResizeObserver(() => context.schedulePosition());
  }

  scan(context: FeatureContext, cards: readonly HTMLElement[]): void {
    this.cleanup();

    for (const card of cards) {
      const existing = this.controlsByCard.get(card);
      if (existing?.isConnected) continue;
      if (!findMenuButton(card)) continue;

      const controls = this.createActionGroup(context, card);
      context.overlay.append(controls);
      this.controlsByCard.set(card, controls);
      this.resizeObserver?.observe(card);
    }
  }

  position(): void {
    for (const [card, controls] of this.controlsByCard) {
      if (!card.isConnected || !controls.isConnected) continue;
      this.positionForCard(card, controls);
    }
  }

  navigationStart(): void {
    this.clear();
  }

  destroy(): void {
    this.clear();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private createActionGroup(context: FeatureContext, card: HTMLElement): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = `${EXTENSION_PREFIX}-actions`;
    wrapper.dataset.ytfcControls = 'true';
    wrapper.setAttribute('aria-label', 'Recommendation controls');

    wrapper.appendChild(this.createActionButton(context, card, 'notInterested'));
    wrapper.appendChild(this.createActionButton(context, card, 'dontRecommend'));
    return wrapper;
  }

  private createActionButton(
    context: FeatureContext,
    card: HTMLElement,
    actionKey: RecommendationActionKey,
  ): HTMLButtonElement {
    const action = RECOMMENDATION_ACTIONS[actionKey];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${EXTENSION_PREFIX}-action`;
    button.dataset.action = actionKey;
    button.setAttribute('aria-label', action.label);
    button.title = action.label;
    button.appendChild(createSvgIcon(action.iconPath, `${EXTENSION_PREFIX}-action__icon`));

    const stopCardInteraction = (event: Event): void => event.stopPropagation();
    button.addEventListener('pointerdown', stopCardInteraction);
    button.addEventListener('mousedown', stopCardInteraction);
    button.addEventListener('mouseup', stopCardInteraction);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.getAttribute('aria-busy') === 'true') return;

      button.setAttribute('aria-busy', 'true');
      button.disabled = true;

      void this.feedback
        .run(card, actionKey, (message) => context.overlay.showToast(message))
        .finally(() => {
          if (!button.isConnected) return;
          button.removeAttribute('aria-busy');
          button.disabled = false;
        });
    });

    return button;
  }

  private positionForCard(card: HTMLElement, controls: HTMLDivElement): void {
    if (card.classList.contains(HIDDEN_SHORTS_CLASS)) {
      controls.hidden = true;
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

    controls.hidden = outsideViewport;
    if (outsideViewport) return;

    controls.style.left = `${Math.round(rect.left + 8)}px`;
    controls.style.top = `${Math.round(rect.top + 8)}px`;
  }

  private cleanup(): void {
    for (const [card, controls] of this.controlsByCard) {
      if (card.isConnected && controls.isConnected) continue;
      this.resizeObserver?.unobserve(card);
      controls.remove();
      this.controlsByCard.delete(card);
    }
  }

  private clear(): void {
    for (const [card, controls] of this.controlsByCard) {
      this.resizeObserver?.unobserve(card);
      controls.remove();
    }
    this.controlsByCard.clear();
  }
}
