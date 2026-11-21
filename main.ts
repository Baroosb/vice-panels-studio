// Vice Panels — hand-in program for make.fun's gta6-cover-art-01.
//
// The entry is the offline cover-art studio under app/. This program
// hands it in: it copies app/ and screenshots/ from beside itself
// into the output directory and writes dossier.json there, built by
// the vendored make.fun library the scorer runs byte for byte.
//
// Before copying, it checks the bundle against the gate's caps with
// its own eyes — at most 4 screenshots of at most 256 KiB each, at
// most 993 files and 48 MiB under app/ — so a bundle the gate would
// refuse fails here first, with a message that says what to fix.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
} as const;

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Every regular file under dir, as paths relative to dir. */
function listFiles(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...listFiles(join(dir, entry.name), rel));
    else if (entry.isFile()) found.push(rel);
  }
  return found;
}

function totalBytes(dir: string, files: string[]): number {
  return files.reduce((sum, rel) => sum + statSync(join(dir, rel)).size, 0);
}

function checkScreenshots(dir: string): string[] {
  if (!existsSync(dir)) throw new Error('screenshots/ is missing: the entry needs its 3 or 4 screenshots');
  const shots = listFiles(dir);
  if (shots.length > CAPS.screenshots.max) {
    throw new Error(`too many screenshots: ${shots.length} files, the gate allows ${CAPS.screenshots.max}`);
  }
  for (const rel of shots) {
    const size = statSync(join(dir, rel)).size;
    if (size > CAPS.screenshots.max_bytes) {
      throw new Error(`screenshot ${rel} is ${size} bytes, over the ${CAPS.screenshots.max_bytes}-byte cap`);
    }
  }
  return shots;
}

function checkApp(dir: string): string[] {
  if (!existsSync(dir)) throw new Error('app/ is missing: the studio lives there');
  const files = listFiles(dir);
  if (files.length > CAPS.app_max_files) {
    throw new Error(`app/ holds ${files.length} files, the gate allows ${CAPS.app_max_files}`);
  }
  const bytes = totalBytes(dir, files);
  if (bytes > CAPS.app_max_bytes) {
    throw new Error(`app/ totals ${bytes} bytes, over the ${CAPS.app_max_bytes}-byte cap`);
  }
  return files;
}

function main(): void {
  const appDir = join(repoDir, 'app');
  const shotsDir = join(repoDir, 'screenshots');
  const appFiles = checkApp(appDir);
  const shots = checkScreenshots(shotsDir);

  cpSync(appDir, join(outDir, 'app'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  console.log(`Vice Panels handed in: ${appFiles.length} app files (${totalBytes(appDir, appFiles)} bytes), ${shots.length} screenshots, dossier.json ${dossier.length} bytes -> ${outDir}`);
}

main();
