import type { Settings } from '../settings/schema';
import type { OverlayHost } from './ui/overlay-host';

export interface FeatureContext {
  readonly settings: Settings;
  readonly overlay: OverlayHost;
  scheduleScan(delay?: number): void;
  schedulePosition(): void;
}

export interface ContentFeature {
  readonly id: string;
  start?(context: FeatureContext): void | Promise<void>;
  scan(context: FeatureContext, cards: readonly HTMLElement[]): void;
  position?(context: FeatureContext): void;
  navigationStart?(context: FeatureContext): void;
  settingsChanged?(context: FeatureContext, previous: Settings): void;
  destroy?(context: FeatureContext): void;
}
