import { defineConfig } from 'vite';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const stackerStaticFiles = [
  'chami-favicon.png',
  'game-data/stacker.json',
  'game-data/stacker.schema.json',
  'assets/title/sitry-chami-title-v1.png',
  'assets/backgrounds/chami-meadow-v1.png',
  'assets/characters/chami/chami-round.png',
  'assets/characters/chami/chami-wide.png',
  'assets/characters/chami/chami-tall-prototype.png',
  'assets/characters/chami/chami-wobble.png',
  'assets/characters/sitry/sitry-idle.png',
  'assets/characters/sitry/sitry-guide.png',
  'assets/characters/sitry/sitry-cheer.png',
];

const legacyDistPaths = [
  'assets/maps',
  'assets/monsters',
  'assets/portraits',
  'assets/characters/hero.svg',
  'assets/characters/kael.svg',
  'assets/characters/lina.svg',
  'assets/characters/mira.svg',
  'assets/characters/rowan.svg',
  'assets/characters/sitry/sitry-defeat-draft.png',
  'assets/characters/sitry/sitry-panic-draft.png',
  'assets/characters/sitry/sitry-smug-draft.png',
  'game-data/game.json',
  'game-data/game.schema.json',
];

export default defineConfig({
  base: './',
  plugins: [{
    name: 'prune-legacy-static-files',
    writeBundle() {
      for (const file of legacyDistPaths) rmSync(resolve('dist', file), { recursive: true, force: true });
      for (const file of stackerStaticFiles) {
        const target = resolve('dist', file);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(resolve('public', file), target);
      }
    },
  }],
  build: { outDir: 'dist' },
});
