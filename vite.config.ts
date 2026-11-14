import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Files of the repository that the Help names; the build puts them on the site, at the same path (T220). */
const SITE_FOLDERS = ['examples', 'docs'];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : name === '.gitkeep' ? [] : [path];
  });
}

function siteFiles(): Plugin {
  return {
    name: 'site-files',
    apply: 'build',
    generateBundle() {
      for (const folder of SITE_FOLDERS) {
        for (const file of filesUnder(folder)) this.emitFile({ type: 'asset', fileName: file.split('\\').join('/'), source: readFileSync(file) });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), siteFiles()],
  define: {
    __TOOL_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/{unit,contract,integration}/**/*.test.{ts,tsx}'],
          exclude: ['tests/unit/ui/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['tests/unit/ui/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/setup-dom.ts'],
        },
      },
    ],
  },
});
