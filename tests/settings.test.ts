import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  MAX_WATCHED_OPACITY,
  MIN_WATCHED_OPACITY,
  normalizeSettings,
} from '../src/settings/schema';

describe('normalizeSettings', () => {
  it('uses defaults for missing values', () => {
    expect(normalizeSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('preserves boolean values', () => {
    expect(normalizeSettings({ hideShorts: false }).hideShorts).toBe(false);
  });

  it('clamps watched opacity', () => {
    expect(normalizeSettings({ watchedOpacity: 0 }).watchedOpacity).toBe(MIN_WATCHED_OPACITY);
    expect(normalizeSettings({ watchedOpacity: 1 }).watchedOpacity).toBe(MAX_WATCHED_OPACITY);
  });
});
