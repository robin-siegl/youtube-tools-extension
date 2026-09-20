import { readPath } from '../shared/dom';
import { CARD_SELECTOR, LOCKUP_SELECTOR, SHORTS_SHELF_SELECTOR } from './selectors';
import { getVideoIdFromUrl, isShortsUrl } from './video';

const THUMBNAIL_SELECTORS = [
  '.ytLockupViewModelContentImage',
  'a#thumbnail',
  'ytd-thumbnail',
  '#thumbnail',
  'yt-thumbnail-view-model',
];

const MENU_BUTTON_SELECTORS = [
  '.ytLockupMetadataViewModelMenuButton button',
  '.yt-lockup-metadata-view-model__menu-button button',
  'ytd-menu-renderer tp-yt-paper-icon-button#button',
  'ytd-menu-renderer yt-icon-button#button',
  '#menu tp-yt-paper-icon-button#button',
  '#menu yt-icon-button#button',
  '#menu button[aria-label="More actions"]',
  '#menu button[aria-label="Aktionen"]',
  'button[aria-label="More actions"]',
  'button[aria-label="Aktionen"]',
];

const VIDEO_LINK_SELECTOR = [
  'a[href*="/watch?v="]',
  'a[href^="/shorts/"]',
  'a[href*="youtube.com/shorts/"]',
].join(',');

export function getVideoCards(): HTMLElement[] {
  const cards = new Set<HTMLElement>();

  document.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((card) => cards.add(card));
  document.querySelectorAll<HTMLElement>(LOCKUP_SELECTOR).forEach((lockup) => {
    if (!lockup.closest(CARD_SELECTOR)) cards.add(lockup);
  });

  return [...cards];
}

export function findMenuButton(card: Element): HTMLElement | null {
  for (const selector of MENU_BUTTON_SELECTORS) {
    const element = card.querySelector<HTMLElement>(selector);
    if (element) return element;
  }
  return null;
}

export function findThumbnailTarget(card: HTMLElement): HTMLElement {
  for (const selector of THUMBNAIL_SELECTORS) {
    const element = card.querySelector<HTMLElement>(selector);
    if (!element) continue;

    const rect = element.getBoundingClientRect();
    if (rect.width > 40 && rect.height > 40) return element;
  }

  return card;
}

export function getVideoId(card: Element): string | null {
  const links = card.querySelectorAll<HTMLAnchorElement>(VIDEO_LINK_SELECTOR);
  for (const link of links) {
    const id = getVideoIdFromUrl(link.href, location.origin);
    if (id) return id;
  }
  return null;
}

export function isShortsCard(card: Element): boolean {
  const links = card.querySelectorAll<HTMLAnchorElement>('a[href]');
  return [...links].some((link) => isShortsUrl(link.href, location.origin));
}

export function getShortsShelves(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(SHORTS_SHELF_SELECTOR)];
}

export function looksLikeShortsShelf(shelf: Element): boolean {
  if (shelf.matches('ytd-reel-shelf-renderer')) return true;
  if (shelf.hasAttribute('is-shorts')) return true;

  const shortsLinks = [...shelf.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((link) =>
    isShortsUrl(link.href, location.origin),
  ).length;
  if (shortsLinks < 2) return false;

  return shelf.querySelectorAll('a[href*="/watch?v="]').length === 0;
}

function getProgressFromViewModel(card: HTMLElement): number | null {
  const candidates = [
    readPath(card, ['data']),
    readPath(card, ['data', 'lockupViewModel']),
    readPath(card, ['data', 'content', 'lockupViewModel']),
    readPath(card, ['__data', 'data']),
    readPath(card, ['__data', 'data', 'lockupViewModel']),
    readPath(card, ['__data', 'data', 'content', 'lockupViewModel']),
    readPath(card, ['__data', 'viewModel']),
  ].filter((value) => value !== undefined && value !== null);

  for (const candidate of candidates) {
    const viewModel = readPath(candidate, ['lockupViewModel']) ?? candidate;
    const overlays = readPath(viewModel, ['contentImage', 'thumbnailViewModel', 'overlays']);
    if (!Array.isArray(overlays)) continue;

    for (const overlay of overlays) {
      const percent = readPath(overlay, [
        'thumbnailBottomOverlayViewModel',
        'progressBar',
        'thumbnailOverlayProgressBarViewModel',
        'startPercent',
      ]);
      const numeric = Number(percent);
      if (Number.isFinite(numeric)) return Math.max(0, Math.min(100, numeric));
    }
  }

  return null;
}

function getProgressFromDom(card: HTMLElement): number | null {
  const progressSegment = card.querySelector<HTMLElement>(
    [
      'yt-thumbnail-overlay-progress-bar-view-model .ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
      'ytd-thumbnail-overlay-resume-playback-renderer #progress',
      'ytd-thumbnail-overlay-resume-playback-renderer [style*="width"]',
    ].join(','),
  );

  if (!progressSegment) return null;

  const inlineWidth = Number.parseFloat(progressSegment.style.width);
  if (Number.isFinite(inlineWidth)) return Math.max(0, Math.min(100, inlineWidth));

  const parentWidth = progressSegment.parentElement?.getBoundingClientRect().width ?? 0;
  const width = progressSegment.getBoundingClientRect().width;
  if (parentWidth <= 0 || width <= 0) return null;

  return Math.max(0, Math.min(100, (width / parentWidth) * 100));
}

export function getWatchProgressPercent(card: HTMLElement): number | null {
  return getProgressFromViewModel(card) ?? getProgressFromDom(card);
}
