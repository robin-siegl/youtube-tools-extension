import { readSettings, writeSettings } from '../settings/storage';
import type { Settings } from '../settings/schema';

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element #${id}`);
  return element as T;
}

const showRatings = requiredElement<HTMLInputElement>('showRatings');
const hideShorts = requiredElement<HTMLInputElement>('hideShorts');
const dimWatched = requiredElement<HTMLInputElement>('dimWatched');
const watchedOpacity = requiredElement<HTMLInputElement>('watchedOpacity');
const opacityValue = requiredElement<HTMLOutputElement>('opacityValue');
const opacityControl = requiredElement<HTMLDivElement>('opacityControl');
const version = requiredElement<HTMLSpanElement>('version');

function render(settings: Settings): void {
  showRatings.checked = settings.showRatings;
  hideShorts.checked = settings.hideShorts;
  dimWatched.checked = settings.dimWatched;

  const percent = Math.round(settings.watchedOpacity * 100);
  watchedOpacity.value = String(percent);
  watchedOpacity.disabled = !settings.dimWatched;
  opacityValue.value = `${percent}%`;
  opacityControl.hidden = !settings.dimWatched;
}

async function save(patch: Partial<Settings>): Promise<void> {
  try {
    render(await writeSettings(patch));
  } catch (error) {
    console.error('[YouTube Tools] Could not save settings.', error);
  }
}

showRatings.addEventListener('change', () => void save({ showRatings: showRatings.checked }));
hideShorts.addEventListener('change', () => void save({ hideShorts: hideShorts.checked }));
dimWatched.addEventListener('change', () => void save({ dimWatched: dimWatched.checked }));

watchedOpacity.addEventListener('input', () => {
  opacityValue.value = `${watchedOpacity.value}%`;
});
watchedOpacity.addEventListener('change', () => {
  void save({ watchedOpacity: Number(watchedOpacity.value) / 100 });
});

version.textContent = `v${chrome.runtime.getManifest().version}`;
void readSettings().then(render);
