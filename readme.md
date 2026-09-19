# YouTube Feed Control – Chrome Extension

A small Chrome extension that adds quick recommendation controls directly to YouTube video cards.

## Features

### Per-video quick controls

Hover a supported YouTube video card to reveal two compact controls:

- **Not interested**
- **Don't recommend channel**

The controls use YouTube's own menu actions rather than calling private APIs directly.

### Current YouTube DOM support

The extension supports YouTube's newer `yt-lockup-view-model` / `ytLockup...` markup as well as older renderer fallbacks.

Recommendation menu actions are matched using YouTube view-model metadata when available, with English and German menu-label fallbacks.

## Permissions & Privacy

- Runs only on `www.youtube.com`
- No extension permissions are requested beyond the declared YouTube content-script match
- Does not store or transmit user data
- No tracking or analytics

## Installation

1. Download or clone the extension folder.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this extension folder.

When updating an already loaded unpacked copy, replace the old files and click **Reload** on the extension card in `chrome://extensions`.
