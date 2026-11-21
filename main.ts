// Vice Panels — Cover Art Studio: the hand-in program for
// gta6-cover-art-01 (Node 22, standard library only).
//
// The app itself is the static site under app/ — plain files a browser
// opens offline. This program delivers it: it measures app/ and
// screenshots/ against the gate's caps, copies both into the output
// directory, and writes dossier.json there with the kit's vendored
// buildDossier, byte for byte as the scorer rebuilds it.
//
// Run it from the repository root:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// MAKEFUN_OUTPUT_DIR stands in for /output outside the grader.

import {
  cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, DOSSIER_SCHEMA } from './vendor/makefun-app.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const appDir = join(root, 'app');
const shotsDir = join(root, 'screenshots');

// measureTree walks a directory and totals its entries and bytes, so an
// over-cap app is refused here with a clear message instead of at the
// scorer.
function measureTree(dir: string): { entries: number; bytes: number } {
  let entries = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    entries += 1;
    if (st.isDirectory()) {
      const sub = measureTree(path);
      entries += sub.entries;
      bytes += sub.bytes;
    } else {
      bytes += st.size;
    }
  }
  return { entries, bytes };
}

function refuse(message: string): never {
  throw new Error(`vice-panels hand-in refused: ${message}`);
}

const appMeasure = measureTree(appDir);
if (appMeasure.entries > CAPS.app_max_files) {
  refuse(`app/ holds ${appMeasure.entries} entries, over the ${CAPS.app_max_files} cap`);
}
if (appMeasure.bytes > CAPS.app_max_bytes) {
  refuse(`app/ is ${appMeasure.bytes} bytes, over the ${CAPS.app_max_bytes} cap`);
}

const shotNames = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((n) => /\.(png|jpe?g)$/i.test(n)).sort()
  : [];
if (shotNames.length < 3 || shotNames.length > CAPS.screenshots.max) {
  refuse(`screenshots/ holds ${shotNames.length} images, needs 3 or 4`);
}
for (const name of shotNames) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > CAPS.screenshots.max_bytes) {
    refuse(`screenshots/${name} is ${size} bytes, over the ${CAPS.screenshots.max_bytes} cap`);
  }
}

mkdirSync(outDir, { recursive: true });
cpSync(appDir, join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`app/: ${appMeasure.entries} entries, ${appMeasure.bytes} bytes`);
console.log(`screenshots/: ${shotNames.join(', ')}`);
console.log(`dossier.json: ${Buffer.byteLength(dossier)} bytes, schema ${DOSSIER_SCHEMA}`);
console.log(`handed in to ${outDir}`);
