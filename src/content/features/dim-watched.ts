import { getWatchProgressPercent } from '../../youtube/cards';
import { DIMMED_WATCHED_CLASS, WATCHED_PROGRESS_THRESHOLD } from '../constants';
import type { ContentFeature, FeatureContext } from '../feature';

export class DimWatchedFeature implements ContentFeature {
  readonly id = 'dim-watched';

  scan(context: FeatureContext, cards: readonly HTMLElement[]): void {
    if (!context.settings.dimWatched) {
      this.clear();
      return;
    }

    for (const card of cards) {
      const progress = getWatchProgressPercent(card);
      const watched = progress !== null && progress >= WATCHED_PROGRESS_THRESHOLD;
      card.classList.toggle(DIMMED_WATCHED_CLASS, watched);

      if (watched) {
        card.style.setProperty('--ytfc-watched-opacity', String(context.settings.watchedOpacity));
      } else {
        card.style.removeProperty('--ytfc-watched-opacity');
      }
    }
  }

  settingsChanged(context: FeatureContext): void {
    if (!context.settings.dimWatched) this.clear();
  }

  navigationStart(): void {
    this.clear();
  }

  destroy(): void {
    this.clear();
  }

  private clear(): void {
    document.querySelectorAll<HTMLElement>(`.${DIMMED_WATCHED_CLASS}`).forEach((element) => {
      element.classList.remove(DIMMED_WATCHED_CLASS);
      element.style.removeProperty('--ytfc-watched-opacity');
    });
  }
}
