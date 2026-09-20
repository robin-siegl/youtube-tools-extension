import { readFileSync } from 'node:fs';
import { defineManifest } from '@crxjs/vite-plugin';

interface PackageJson {
  version: string;
}

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as PackageJson;

export default defineManifest({
  manifest_version: 3,
  name: 'YouTube Tools',
  version: packageJson.version,
  description:
    'Feed controls, recommendation shortcuts, ratings, Shorts filtering, and watched-video dimming for YouTube.',
  permissions: ['storage'],
  host_permissions: ['https://returnyoutubedislikeapi.com/*'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  action: {
    default_title: 'YouTube Tools',
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  icons: {
    '16': 'icons/icon16.png',
    '32': 'icons/icon32.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
});
