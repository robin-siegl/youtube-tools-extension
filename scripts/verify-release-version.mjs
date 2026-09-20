import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const tag = process.env.GITHUB_REF_NAME ?? process.argv[2];

if (!tag) throw new Error('Missing release tag.');
if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error(`Release tag must look like v1.2.3. Received: ${tag}`);
}

const tagVersion = tag.slice(1);
if (tagVersion !== packageJson.version) {
  throw new Error(`Tag/package mismatch: tag=${tagVersion}, package.json=${packageJson.version}`);
}

console.log(`Release version verified: ${tag}`);
