// VERDE BAY — the program that hands this game in for gta6-01.
// Node 22, standard library only. It copies the game's files and its
// screenshots into /output (or MAKEFUN_OUTPUT_DIR outside the grader)
// and writes /output/dossier.json with the kit's vendored library, which
// is what the judge reads. No network, no build step, no secrets.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
}

// The scorer's own caps (from the kit's gate): the text cap shapes the
// bytes; the rest refuse an entry the scorer would refuse — more than
// four screenshots, one over 256 KiB, more than 993 game files or 48 MiB
// of them, or a game path over 1000 bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
