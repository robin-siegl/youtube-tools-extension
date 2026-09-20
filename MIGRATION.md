# Migration from the current repository

The current `development` branch is the pre-TypeScript extension. This tree replaces the root-level JavaScript files with the TypeScript/CRXJS project.

Recommended first migration commit:

```bash
git checkout development
git pull

# Copy the contents of this migrated project over the repository root.
# Remove the old root-level content.js/content.css/manifest.json files if they remain.

npm install
npm run check
npm run package

git add -A
git commit -m "refactor: migrate extension to TypeScript build"
git push origin development
```

After validating the extension from `dist/`, create the stable branch once:

```bash
git checkout -b main
git push -u origin main
```

Future feature work should merge into `development`, then into `main`. Create release tags only from `main`.
