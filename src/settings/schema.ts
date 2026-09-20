export interface Settings {
  showRatings: boolean;
  hideShorts: boolean;
  dimWatched: boolean;
  watchedOpacity: number;
}

export const MIN_WATCHED_OPACITY = 0.15;
export const MAX_WATCHED_OPACITY = 0.8;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  showRatings: true,
  hideShorts: true,
  dimWatched: true,
  watchedOpacity: 0.35,
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeSettings(value: Partial<Settings> = {}): Settings {
  const opacity = Number(value.watchedOpacity);

  return {
    showRatings:
      typeof value.showRatings === 'boolean' ? value.showRatings : DEFAULT_SETTINGS.showRatings,
    hideShorts:
      typeof value.hideShorts === 'boolean' ? value.hideShorts : DEFAULT_SETTINGS.hideShorts,
    dimWatched:
      typeof value.dimWatched === 'boolean' ? value.dimWatched : DEFAULT_SETTINGS.dimWatched,
    watchedOpacity: Number.isFinite(opacity)
      ? clamp(opacity, MIN_WATCHED_OPACITY, MAX_WATCHED_OPACITY)
      : DEFAULT_SETTINGS.watchedOpacity,
  };
}
