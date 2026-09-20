# YouTube Tools

A small Manifest V3 Chrome extension that adds practical feed controls to YouTube while keeping the implementation resilient to YouTube's client-side navigation and frequently changing DOM.

## Features

- Always-visible **Not interested** and **Don't recommend channel** quick actions on video thumbnails.
- Works across full page loads and YouTube SPA/client-side navigation.
- Quick controls are rendered in a body-level overlay so YouTube's inline hover preview cannot replace or cover them.
- Optional **likes / estimated dislikes / positive ratio** on thumbnails.
- Optional **Hide Shorts** for Shorts cards and Shorts shelves.
- Optional **Dim watched videos** for videos that are at least 90% watched, with configurable opacity.
- Light/dark settings popup using YouTube/Google-like styling.
- Settings sync through `chrome.storage.sync`.
- Rating cache and request queue in the MV3 background service worker.

Dislike estimates are provided by [Return YouTube Dislike](https://returnyoutubedislike.com/). They are estimates, not YouTube's private official dislike count.

## Stack

- TypeScript
- Vite 8
- CRXJS Vite plugin (Manifest V3)
- Vitest
- ESLint + typescript-eslint
- Prettier
- GitHub Actions

## Project structure

```text
src/
  background/             # Return YouTube Dislike API/cache/service worker
  content/
    features/             # Isolated extension features
    ui/                   # Body-level overlay host/toast
    runtime.ts            # Single YouTube lifecycle + MutationObserver
  popup/                  # Settings popup
  settings/               # Typed settings schema/storage
  shared/                 # Shared DOM/message helpers
  youtube/                # YouTube DOM adapter + feedback menu adapter
public/icons/              # Chrome extension icons
scripts/                   # Release packaging/version checks
.github/workflows/         # CI and tagged releases
```

The important architectural rule is that feature code should use the helpers in `src/youtube/` instead of spreading YouTube selectors throughout the project. When YouTube changes markup, most fixes should be isolated to that adapter layer.

## Development

Requirements: Node.js 22.13+.

```bash
npm install
# Commit the generated package-lock.json so CI can use npm ci.
npm run dev
```

CRXJS/Vite writes the development extension to `dist/`. In Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist/` directory.

For normal development, keep `npm run dev` running and reload the extension when Chrome requires it.

## Validation

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Or run all checks with:

```bash
npm run check
```

## Production package

```bash
npm run package
```

This creates:

```text
release/youtube-tools-<version>.zip
```

`package.json` is the source of truth for the version. `manifest.config.ts` reads that version during the build, and the packaging script refuses to package a mismatched manifest.

## Branches and releases

Recommended flow:

```text
feature/* -> development -> main -> vX.Y.Z tag -> GitHub Release
```

`development` is the integration branch. `main` is the stable/release branch.

The CI workflow runs format, lint, typecheck, tests, build, and packaging on pushes/PRs to `development` and `main`. It also uploads the extension ZIP as a short-lived Actions artifact.

The release workflow runs for `vX.Y.Z` tags. It verifies that:

- the tag version matches `package.json`;
- the tagged commit is reachable from `main`;
- all checks pass;
- the extension builds and packages successfully.

It then creates a GitHub Release and attaches `youtube-tools-X.Y.Z.zip`.

### Create a release

From an up-to-date `main` branch:

```bash
npm run release:minor
# equivalent to: npm version minor

git push origin main --follow-tags
```

For a bug fix use `npm run release:patch`; for a breaking major release use `npm run release:major`.

> The repository currently started with only a `development` branch. Create `main` from the first stable migrated commit before publishing the first tag, because the release workflow intentionally refuses tags that are not on `main`.

## Rating implementation

Rating requests are intentionally centralized in the background service worker. The implementation includes:

- intersection-based lazy loading near the viewport;
- request de-duplication;
- sequential rate-limited requests;
- 12-hour local cache;
- cache pruning;
- handling for HTTP 429 / `Retry-After`;
- a network timeout;
- no requests while the feature is disabled.

## Privacy

YouTube Tools does not include analytics or tracking. Extension preferences are stored using Chrome sync storage. Rating lookups send the public YouTube video ID to the Return YouTube Dislike API when the ratings feature is enabled.
