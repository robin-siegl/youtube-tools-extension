import { readSettings, observeSettings } from '../settings/storage';
import type { Settings } from '../settings/schema';
import { getVideoCards } from '../youtube/cards';
import type { ContentFeature, FeatureContext } from './feature';
import { OverlayHost } from './ui/overlay-host';

export class ContentRuntime {
  private settings!: Settings;
  private readonly overlay = new OverlayHost();
  private readonly features: ContentFeature[];
  private scanTimer: number | null = null;
  private positionFrame: number | null = null;
  private navigating = false;
  private mutationObserver: MutationObserver | null = null;
  private stopSettingsObserver: (() => void) | null = null;

  private readonly context: FeatureContext;

  constructor(features: ContentFeature[]) {
    this.features = features;
    const owner = this;
    this.context = {
      get settings() {
        return owner.settings;
      },
      get overlay() {
        return owner.overlay;
      },
      scheduleScan: (delay = 70) => owner.scheduleScan(delay),
      schedulePosition: () => owner.schedulePosition(),
    };
  }

  async start(): Promise<void> {
    this.settings = await readSettings();

    for (const feature of this.features) await feature.start?.(this.context);

    this.observePage();
    this.stopSettingsObserver = observeSettings((next) => this.onSettingsChanged(next));

    document.addEventListener('yt-navigate-start', this.onNavigationStart, true);
    document.addEventListener('yt-navigate-finish', this.onNavigationFinished, true);
    document.addEventListener('yt-page-data-updated', this.onNavigationFinished, true);
    document.addEventListener('yt-rendererstamper-finished', this.onRendererFinished, true);
    document.addEventListener('scroll', this.onScroll, true);
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('popstate', this.onHistoryChange, true);
    window.addEventListener('pageshow', this.onHistoryChange, true);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.scheduleScan(0);
  }

  destroy(): void {
    this.mutationObserver?.disconnect();
    this.stopSettingsObserver?.();

    document.removeEventListener('yt-navigate-start', this.onNavigationStart, true);
    document.removeEventListener('yt-navigate-finish', this.onNavigationFinished, true);
    document.removeEventListener('yt-page-data-updated', this.onNavigationFinished, true);
    document.removeEventListener('yt-rendererstamper-finished', this.onRendererFinished, true);
    document.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('popstate', this.onHistoryChange, true);
    window.removeEventListener('pageshow', this.onHistoryChange, true);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    for (const feature of this.features) feature.destroy?.(this.context);
    this.overlay.clear();
  }

  scheduleScan(delay = 70): void {
    if (this.navigating || this.scanTimer !== null) return;
    this.scanTimer = window.setTimeout(() => this.scan(), delay);
  }

  schedulePosition(): void {
    if (this.positionFrame !== null) return;
    this.positionFrame = requestAnimationFrame(() => this.position());
  }

  private scan(): void {
    this.scanTimer = null;
    if (this.navigating || !document.body) return;

    const cards = getVideoCards();
    for (const feature of this.features) feature.scan(this.context, cards);
    this.schedulePosition();
  }

  private position(): void {
    this.positionFrame = null;
    for (const feature of this.features) feature.position?.(this.context);
  }

  private observePage(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.navigating) return;

      if (
        mutations.some(
          (mutation) =>
            mutation.type === 'childList' &&
            (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0),
        )
      ) {
        this.scheduleScan(70);
      }

      this.schedulePosition();
    });

    this.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  private onSettingsChanged(next: Settings): void {
    const previous = this.settings;
    this.settings = next;
    for (const feature of this.features) feature.settingsChanged?.(this.context, previous);
    this.scheduleScan(0);
  }

  private readonly onNavigationStart = (): void => {
    this.navigating = true;

    if (this.scanTimer !== null) {
      window.clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }

    if (this.positionFrame !== null) {
      cancelAnimationFrame(this.positionFrame);
      this.positionFrame = null;
    }

    for (const feature of this.features) feature.navigationStart?.(this.context);
    this.overlay.clear();
  };

  private readonly onNavigationFinished = (): void => {
    this.navigating = false;
    this.scheduleScan(0);
    window.setTimeout(() => this.scheduleScan(0), 250);
    window.setTimeout(() => this.scheduleScan(0), 900);
  };

  private readonly onRendererFinished = (): void => this.scheduleScan(70);
  private readonly onScroll = (): void => this.schedulePosition();
  private readonly onResize = (): void => this.schedulePosition();
  private readonly onHistoryChange = (): void => this.scheduleScan(0);
  private readonly onVisibilityChange = (): void => {
    if (!document.hidden) this.scheduleScan(0);
  };
}

