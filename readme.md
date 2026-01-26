# YouTube Feed Control – Chrome Extension

This Chrome extension enhances the YouTube homepage by adding quick-action controls that make it easier to manage recommendations.

## Features

### Inline quick buttons on thumbnails

Adds two small buttons directly on each video in the YouTube home feed:

- 👎 Not interested
- 🚫 Don’t recommend channel

These buttons trigger YouTube’s existing menu actions automatically.

### Global action buttons

Adds fixed-position buttons to the page that apply actions to all visible videos:

- 👎 Mark all videos as Not interested
- 🚫 Mark all channels as Don’t recommend

Actions are triggered sequentially with delays to avoid UI issues.

## How It Works (High Level)

1. Detects video tiles (ytd-rich-item-renderer)
2. Injects custom buttons into each thumbnail
3. Simulates clicks on YouTube’s context menu options
4. Observes DOM changes to handle dynamically loaded content

## Permissions & Privacy

- Runs only on YouTube pages
- Does not store or transmit user data
- No tracking or analytics
## Installation
Pre Condition: Remove ad block related modal with ad blocker element filter.

1. Clone or download this repository
2. Open Chrome and go to chrome://extensions
3. Enable Developer mode
4. Click Load unpacked
5. Select the project folder

That’s it.
