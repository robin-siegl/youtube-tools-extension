# Changelog

## 1.3.0

### Added

- TypeScript + Vite + CRXJS project structure.
- Feature-based content architecture and centralized YouTube DOM adapter.
- Likes, estimated dislikes, and positive vote ratio on video thumbnails.
- Optional Shorts filtering.
- Optional watched-video dimming with configurable opacity.
- Typed settings and runtime message contracts.
- Rating request queue, de-duplication, persistent cache, timeout, and rate-limit handling.
- GitHub Actions CI with downloadable build artifacts.
- Tag-driven GitHub Release workflow and version validation.
- Unit tests for URL parsing, settings normalization, and rating normalization.

### Preserved

- Always-visible Not interested / Don't recommend channel controls.
- YouTube SPA navigation support.
- Body-level overlays that remain visible when inline preview starts.
