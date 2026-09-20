import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from './schema';

export async function readSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return normalizeSettings(stored as Partial<Settings>);
  } catch (error) {
    console.warn('[YouTube Tools] Could not read settings.', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await readSettings();
  const next = normalizeSettings({ ...current, ...patch });
  await chrome.storage.sync.set(next);
  return next;
}

export function observeSettings(listener: (settings: Settings) => void): () => void {
  const onChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'sync') return;

    void readSettings().then(listener);
  };

  chrome.storage.onChanged.addListener(onChanged);
  return () => chrome.storage.onChanged.removeListener(onChanged);
}
