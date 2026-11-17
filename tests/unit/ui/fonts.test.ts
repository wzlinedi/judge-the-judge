// T427 (FR-091, SC-048; research.md, section 35.3): the four Editorial fonts ship with the site as WOFF2 files, each family with its
// SIL Open Font License, and the Content Security Policy that keeps every font on the site itself does not change.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FOLDER = 'public/fonts';

const FONT_FILES = [
  'inter-latin-400-normal.woff2',
  'inter-latin-ext-400-normal.woff2',
  'inter-latin-600-normal.woff2',
  'inter-latin-ext-600-normal.woff2',
  'instrument-serif-latin-400-normal.woff2',
  'instrument-serif-latin-ext-400-normal.woff2',
  'newsreader-latin-400-normal.woff2',
  'newsreader-latin-ext-400-normal.woff2',
  'jetbrains-mono-latin-400-normal.woff2',
  'jetbrains-mono-latin-ext-400-normal.woff2',
];

/** The license file of each family and the copyright line it must carry (research.md, 35.3). */
const LICENSES: Record<string, string> = {
  'OFL-Inter.txt': 'Copyright 2016 The Inter Project Authors',
  'OFL-InstrumentSerif.txt': 'Copyright 2022 The Instrument Serif Project Authors',
  'OFL-Newsreader.txt': 'Copyright 2020 The Newsreader Project Authors',
  'OFL-JetBrainsMono.txt': 'Copyright 2020 The JetBrains Mono Project Authors',
};

const CSP =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\'; font-src \'self\'; connect-src \'none\'; object-src \'none\'; base-uri \'none\'">';

const listFolder = (): string[] => {
  try {
    return readdirSync(FOLDER).sort();
  } catch {
    return [];
  }
};

describe('the Editorial fonts ship with the site (SC-048)', () => {
  it('public/fonts holds the ten WOFF2 files and the four licenses, and nothing else', () => {
    expect(listFolder()).toEqual([...FONT_FILES, ...Object.keys(LICENSES)].sort());
  });

  it('each font file is a WOFF2 file', () => {
    for (const file of FONT_FILES) {
      const head = readFileSync(`${FOLDER}/${file}`).subarray(0, 4).toString('latin1');
      expect(head, file).toBe('wOF2');
    }
  });

  it('each family ships with its SIL Open Font License and its copyright line', () => {
    for (const [file, copyright] of Object.entries(LICENSES)) {
      const text = readFileSync(`${FOLDER}/${file}`, 'utf8');
      expect(text, file).toContain('SIL Open Font License, Version 1.1');
      expect(text, file).toContain(copyright);
    }
  });

  it('the Content Security Policy of index.html is unchanged: fonts come only from the site', () => {
    const lines = readFileSync('index.html', 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('Content-Security-Policy'));
    expect(lines).toEqual([CSP]);
  });
});
