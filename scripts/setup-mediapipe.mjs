import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * Why this script exists:
 * - MediaPipe Holistic expects a bunch of runtime files (WASM, .tflite, .data, etc.)
 * - In this app we load them from `/mediapipe/<file>` (served from `public/mediapipe/`)
 * - Those assets are large, so we keep them out of git and regenerate them from `node_modules`
 *
 * When it runs:
 * - `postinstall`: ensures a fresh clone has the files after `npm install`
 * - `prebuild`: ensures CI/build environments have them before `vite build`
 */

// Node ESM doesn't have CommonJS `require` by default; `createRequire` lets us use
// `require.resolve()` to find installed package files reliably.
const require = createRequire(import.meta.url);

// Small helper: `fs.stat` throws if the path doesn't exist.
async function pathExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Locate the installed `@mediapipe/holistic` package on disk.
  // If this fails, the dependency isn't installed yet.
  let holisticPackageJsonPath;
  try {
    holisticPackageJsonPath = require.resolve('@mediapipe/holistic/package.json');
  } catch (error) {
    throw new Error(
      'Could not resolve @mediapipe/holistic. Run `npm install` first.',
      { cause: error },
    );
  }

  const holisticDir = path.dirname(holisticPackageJsonPath);

  // This script is run from the repo root (`npm run ...` sets CWD to the package root).
  const repoRoot = process.cwd();
  const destDir = path.join(repoRoot, 'public', 'mediapipe');

  // We write a small version file so we can skip copying on repeated runs.
  const holisticPackageJson = JSON.parse(await fs.readFile(holisticPackageJsonPath, 'utf8'));
  const versionFile = path.join(destDir, '.holistic.version');
  const expectedVersion = String(holisticPackageJson.version ?? '');

  // These are the files referenced by the Holistic JS runtime and our app.
  // Keeping this list explicit ensures we fail early if something important changes upstream.
  const requiredFiles = [
    'holistic.js',
    'holistic.binarypb',
    'holistic_solution_packed_assets_loader.js',
    'holistic_solution_packed_assets.data',
    'holistic_solution_simd_wasm_bin.js',
    'holistic_solution_simd_wasm_bin.wasm',
    'holistic_solution_simd_wasm_bin.data',
    'holistic_solution_wasm_bin.js',
    'holistic_solution_wasm_bin.wasm',
    'pose_landmark_lite.tflite',
    'pose_landmark_full.tflite',
    'pose_landmark_heavy.tflite',
    'index.d.ts',
    'package.json',
    'README.md',
  ];

  // Make sure the destination folder exists (`public/mediapipe/`).
  await fs.mkdir(destDir, { recursive: true });

  // Read the current generated version (if any).
  const currentVersion = (await pathExists(versionFile))
    ? String(await fs.readFile(versionFile, 'utf8')).trim()
    : '';

  // Check whether we already have everything we need.
  const allRequiredPresent = await Promise.all(
    requiredFiles.map(async (name) => pathExists(path.join(destDir, name))),
  ).then((results) => results.every(Boolean));

  // If the version matches AND the required files are present, we can exit quickly.
  // This keeps `npm install` fast after the first run.
  if (currentVersion === expectedVersion && allRequiredPresent) {
    return;
  }

  // List all files in the package so we can copy them.
  // We copy *all* files from the package (not only requiredFiles) to keep the directory consistent
  // with what the runtime expects, while `requiredFiles` remains our completeness check.
  const sourceEntries = await fs.readdir(holisticDir, { withFileTypes: true });
  const sourceFiles = sourceEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const sourceFileSet = new Set(sourceFiles);

  // Clean up stale files from previous versions:
  // - Keep `.gitkeep` (tracked placeholder) and `.holistic.version`
  // - Remove any other file that is not present in the installed package anymore
  const destEntries = await fs.readdir(destDir, { withFileTypes: true });
  await Promise.all(
    destEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name !== '.gitkeep' && name !== path.basename(versionFile))
      .filter((name) => !sourceFileSet.has(name))
      .map((name) => fs.rm(path.join(destDir, name), { force: true })),
  );

  // Copy the package files into `public/mediapipe/` so Vite can serve them.
  // `copyFile` replaces existing files atomically.
  await Promise.all(
    sourceFiles.map((name) =>
      fs.copyFile(path.join(holisticDir, name), path.join(destDir, name)),
    ),
  );

  // Record the version we just generated so future runs can skip work.
  await fs.writeFile(versionFile, expectedVersion);
}

await main();
