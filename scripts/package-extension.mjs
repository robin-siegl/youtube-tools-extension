import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import archiver from 'archiver';

const root = resolve(import.meta.dirname, '..');
const distDir = resolve(root, 'dist');
const releaseDir = resolve(root, 'release');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(distDir, 'manifest.json'), 'utf8'));

if (!existsSync(distDir)) {
  throw new Error('dist/ does not exist. Run npm run build first.');
}

if (manifest.version !== packageJson.version) {
  throw new Error(
    `Version mismatch: package.json=${packageJson.version}, dist/manifest.json=${manifest.version}`,
  );
}

mkdirSync(releaseDir, { recursive: true });
const outputPath = resolve(releaseDir, `youtube-tools-${packageJson.version}.zip`);
if (existsSync(outputPath)) rmSync(outputPath);

await new Promise((resolvePromise, rejectPromise) => {
  const output = createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', resolvePromise);
  output.on('error', rejectPromise);
  archive.on('warning', (error) => {
    if (error.code === 'ENOENT') console.warn(error.message);
    else rejectPromise(error);
  });
  archive.on('error', rejectPromise);

  archive.pipe(output);
  archive.directory(distDir, false);
  void archive.finalize();
});

console.log(`Created ${outputPath}`);
