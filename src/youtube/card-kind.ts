const PLAYLIST_RENDERER_SELECTOR = [
  'ytd-playlist-renderer',
  'ytd-grid-playlist-renderer',
  'ytd-radio-renderer',
].join(',');

const PLAYLIST_LINK_SELECTOR = [
  'a[href^="/playlist?list="]',
  'a[href*="youtube.com/playlist?list="]',
].join(',');

const PLAYLIST_OVERLAY_SELECTOR = [
  'ytd-thumbnail-overlay-side-panel-renderer',
  'yt-thumbnail-overlay-side-panel-renderer',
  '.ytThumbnailOverlaySidePanelRendererHost',
].join(',');

export function isPlaylistCard(card: Element): boolean {
  if (card.matches(PLAYLIST_RENDERER_SELECTOR)) return true;
  if (card.querySelector(PLAYLIST_RENDERER_SELECTOR)) return true;
  if (card.querySelector(PLAYLIST_LINK_SELECTOR)) return true;
  return Boolean(card.querySelector(PLAYLIST_OVERLAY_SELECTOR));
}
