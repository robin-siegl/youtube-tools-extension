import { getShortsShelves, isShortsCard, looksLikeShortsShelf } from '../../youtube/cards';
import { HIDDEN_SHORTS_CLASS } from '../constants';
import type { ContentFeature, FeatureContext } from '../feature';

export class HideShortsFeature implements ContentFeature {
  readonly id = 'hide-shorts';

  scan(context: FeatureContext, cards: readonly HTMLElement[]): void {
    if (!context.settings.hideShorts) {
      this.clear();
      return;
    }

    for (const card of cards) {
      card.classList.toggle(HIDDEN_SHORTS_CLASS, isShortsCard(card));
    }

    for (const shelf of getShortsShelves()) {
      shelf.classList.toggle(HIDDEN_SHORTS_CLASS, looksLikeShortsShelf(shelf));
    }
  }

  settingsChanged(context: FeatureContext): void {
    if (!context.settings.hideShorts) this.clear();
  }

  navigationStart(): void {
    this.clear();
  }

  destroy(): void {
    this.clear();
  }

  private clear(): void {
    document.querySelectorAll(`.${HIDDEN_SHORTS_CLASS}`).forEach((element) => {
      element.classList.remove(HIDDEN_SHORTS_CLASS);
    });
  }
}
