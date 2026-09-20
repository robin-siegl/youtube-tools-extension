import './styles.css';
import { DimWatchedFeature } from './features/dim-watched';
import { HideShortsFeature } from './features/hide-shorts';
import { RatingsFeature } from './features/ratings';
import { RecommendationControlsFeature } from './features/recommendation-controls';
import { ContentRuntime } from './runtime';

const runtime = new ContentRuntime([
  new HideShortsFeature(),
  new DimWatchedFeature(),
  new RecommendationControlsFeature(),
  new RatingsFeature(),
]);

function start(): void {
  void runtime.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
