// T316, T430 (FR-007, FR-091, FR-094, SC-047; research.md, sections 33 and 35): the design tokens keep the colors of the Editorial redesign
// and every text pair reaches 4.5:1 (focus ring, strong edges and the reply line 3:1) in the light and the dark sets. The ratios are computed here
// from `tokens.css`, so the numbers of research.md cannot drift.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/ui/styles/tokens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

interface Block {
  selector: string;
  inMedia: boolean;
  tokens: Record<string, string>;
}

/** The rules of the file, with the custom properties of each; a rule inside an `@media` block is marked. */
function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  let depth = 0;
  let mediaDepth = -1;
  let start = 0;
  let selector = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') {
      const head = text.slice(start, i).trim();
      if (head.startsWith('@media')) mediaDepth = depth;
      else selector = head;
      depth += 1;
      start = i + 1;
      if (!head.startsWith('@media')) {
        const end = text.indexOf('}', i);
        const tokens: Record<string, string> = {};
        for (const m of text.slice(i + 1, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[m[1] as string] = (m[2] as string).trim();
        blocks.push({ selector, inMedia: mediaDepth >= 0 && depth > mediaDepth + 1, tokens });
        i = end;
        depth -= 1;
        start = i + 1;
      }
    } else if (ch === '}') {
      depth -= 1;
      if (depth === mediaDepth) mediaDepth = -1;
      start = i + 1;
    }
  }
  return blocks;
}

const blocks = blocksOf(css);
const find = (predicate: (b: Block) => boolean): Block => {
  const found = blocks.find(predicate);
  if (!found) throw new Error('a block of tokens.css is missing');
  return found;
};

const light = find((b) => b.selector === ':root' && !b.inMedia).tokens;
const darkMedia = find((b) => b.inMedia && b.selector.startsWith(':root:not([data-theme="light"])')).tokens;
const darkAttribute = find((b) => b.selector === ':root[data-theme="dark"]').tokens;
const dark = darkAttribute;

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
const hex = (set: Record<string, string>, name: string): string => {
  const value = set[name];
  if (value === undefined || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error(`${name} is not a six digit color: ${String(value)}`);
  return value;
};

const SURFACES = ['--bg', '--surface', '--surface-2'] as const;
const sets = { light, dark } as const;

describe('the colors of FR-007 and research.md, section 33', () => {
  it('the light set is Editorial Literary A', () => {
    const expected: Record<string, string> = { '--bg': '#FAF8F5', '--surface': '#FFFFFF', '--surface-2': '#F3EFEA', '--border': '#E6E4E1', '--border-strong': '#8A847D', '--text': '#1C1917', '--text-muted': '#6F6A64', '--accent': '#1C1917', '--accent-hover': '#3A3531', '--on-accent': '#FAF8F5', '--focus': '#1C1917' };
    for (const [name, value] of Object.entries(expected)) expect(light[name]?.toUpperCase(), name).toBe(value);
  });

  it('the dark set follows the system with the same values in the media query and in the data-theme block', () => {
    expect(darkMedia).toEqual(darkAttribute);
    const expected: Record<string, string> = { '--bg': '#1A1816', '--surface': '#2C2824', '--surface-2': '#24211E', '--text': '#EEE9E3', '--text-muted': '#A39C94', '--accent': '#EEE9E3', '--on-accent': '#1A1816' };
    for (const [name, value] of Object.entries(expected)) expect(dark[name]?.toUpperCase(), name).toBe(value);
  });

  it('defines the tokens of the redesign for the size, the width and the control', () => {
    expect(light['--text-2xl']).toBe('2rem');
    expect(light['--content-max']).toBe('97.5rem');
    expect(light['--prose-max']).toBe('72ch');
    expect(light['--control-height']).toBe('2.25rem');
    for (const name of ['--reply-bg', '--reply-line', '--reply-strong-bg', '--border-strong', '--shadow', '--radius', '--radius-lg']) {
      expect(light[name], name).toBeTruthy();
      expect(dark[name] ?? light[name], name).toBeTruthy();
    }
  });
});

// T431 (FR-007, FR-091; research.md, 35.1 to 35.4): new checks of the Editorial tokens; no assertion above changes.
describe('the Editorial tokens (research.md, 35.1 to 35.4)', () => {
  it('secondary text is 4.5:1 on the background, the surface and the quiet surface in both sets', () => {
    expect(light['--text-secondary']?.toUpperCase()).toBe('#57534E');
    expect(dark['--text-secondary']?.toUpperCase()).toBe('#C9C2BA');
    for (const [setName, set] of Object.entries(sets)) {
      for (const surface of SURFACES) expect(ratio(hex(set, '--text-secondary'), hex(set, surface)), `${setName}: --text-secondary on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the truth background is rgba(13, 148, 136, 0.11) on the canvas, #E0EDE9 (owner, 2026-11-17), and #24302C in the dark set', () => {
    expect(light['--success-bg']?.toUpperCase()).toBe('#E0EDE9');
    expect(dark['--success-bg']?.toUpperCase()).toBe('#24302C');
  });

  it('the lines under a marked passage are 3:1 on the background in both sets', () => {
    const expected = { light: ['#D97706', '#0D9488', '#E11D48'], dark: ['#E8A75A', '#5EC4B6', '#F38BA0'] };
    for (const [setName, set] of Object.entries(sets)) {
      const names = ['--mark-warning-line', '--mark-success-line', '--mark-error-line'];
      expect(names.map((name) => set[name]?.toUpperCase()), setName).toEqual(expected[setName as keyof typeof expected]);
      for (const name of names) expect(ratio(hex(set, name), hex(set, '--bg')), `${setName}: ${name}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('adds the sizes xs, body and 3xl, keeps --text-2xl at 2rem, and rounds the radii to 8 and 12 px', () => {
    expect(light['--text-xs']).toBe('0.6875rem');
    expect(light['--text-body']).toBe('1.125rem');
    expect(light['--text-3xl']).toBe('3rem');
    expect(light['--text-2xl']).toBe('2rem');
    expect(light['--radius']).toBe('8px');
    expect(light['--radius-lg']).toBe('12px');
  });

  it('names the four font stacks of research.md 35.3, each starting with its family', () => {
    expect(light['--font']).toBe('"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif');
    expect(light['--font-display']).toBe('"Instrument Serif", Georgia, serif');
    expect(light['--font-body']).toBe('"Newsreader", Georgia, serif');
    expect(light['--font-mono']).toBe('"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace');
  });

  it('has no data-palette block left (FR-007 removes navy)', () => {
    expect(blocks.filter((b) => b.selector.includes('data-palette')).map((b) => b.selector)).toEqual([]);
  });
});

// T428 (FR-091, SC-048; research.md, 35.3): the ten @font-face rules come first in tokens.css and name only files of public/fonts.
describe('the @font-face rules of the Editorial fonts (research.md, 35.3)', () => {
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
    const body = m[1] as string;
    const read = (property: string) => body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`))?.[1]?.trim();
    return { family: read('font-family'), style: read('font-style'), weight: read('font-weight'), display: read('font-display'), range: read('unicode-range'), src: read('src') };
  });
  const FAMILIES = ['"Inter"', '"Instrument Serif"', '"Newsreader"', '"JetBrains Mono"'];

  it('has ten rules, each for one of the four families, normal style, swap and a unicode-range', () => {
    expect(faces).toHaveLength(10);
    for (const face of faces) {
      expect(FAMILIES, JSON.stringify(face)).toContain(face.family);
      expect(face.style).toBe('normal');
      expect(face.display).toBe('swap');
      expect(face.range, JSON.stringify(face)).toMatch(/^U\+[0-9A-F]/);
    }
  });

  it('gives Inter the weights 400 and 600 and every other family only 400', () => {
    for (const face of faces) expect(face.family === '"Inter"' ? ['400', '600'] : ['400'], JSON.stringify(face)).toContain(face.weight);
    expect(faces.filter((f) => f.family === '"Inter"').map((f) => f.weight).sort()).toEqual(['400', '400', '600', '600']);
  });

  it('loads each file from /fonts/ as WOFF2, and each file exists in public/fonts', () => {
    const present = existsSync('public/fonts') ? readdirSync('public/fonts') : [];
    for (const face of faces) {
      const file = face.src?.match(/^url\("\/fonts\/([\w-]+\.woff2)"\) format\("woff2"\)$/)?.[1];
      expect(file, String(face.src)).toBeTruthy();
      expect(present, String(face.src)).toContain(file);
    }
  });

  it('still finds the light, the dark and the data-theme blocks when the @font-face rules come first', () => {
    expect(light['--bg']).toBeTruthy();
    expect(darkMedia['--bg']).toBeTruthy();
    expect(darkAttribute['--bg']).toBeTruthy();
  });
});

for (const [setName, set] of Object.entries(sets)) {
  describe(`contrast in the ${setName} set`, () => {
    it('text and secondary text are 4.5:1 on the background, the surface and the quiet surface', () => {
      for (const surface of SURFACES) {
        expect(ratio(hex(set, '--text'), hex(set, surface)), `--text on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(hex(set, '--text-muted'), hex(set, surface)), `--text-muted on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('the accent reads as text, and the text on the accent is 4.5:1 with and without hover', () => {
      for (const surface of ['--bg', '--surface']) expect(ratio(hex(set, '--accent'), hex(set, surface)), `--accent on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(hex(set, '--on-accent'), hex(set, '--accent'))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(hex(set, '--on-accent'), hex(set, '--accent-hover'))).toBeGreaterThanOrEqual(4.5);
    });

    it('success, warning and error are 4.5:1 on their own background and on the page', () => {
      for (const status of ['success', 'warning', 'error']) {
        expect(ratio(hex(set, `--${status}`), hex(set, `--${status}-bg`)), `--${status} on --${status}-bg`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(hex(set, `--${status}`), hex(set, '--bg')), `--${status} on --bg`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('text is 4.5:1 on every mark and on the marked reply, and the accent on the strong reply', () => {
      for (const mark of ['--mark-warning', '--mark-success', '--mark-error', '--reply-bg', '--reply-strong-bg']) {
        expect(ratio(hex(set, '--text'), hex(set, mark)), `--text on ${mark}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(ratio(hex(set, '--accent'), hex(set, '--reply-strong-bg'))).toBeGreaterThanOrEqual(4.5);
    });

    it('the focus ring, the edge of a control and the reply line are 3:1 on the background (FR-094)', () => {
      for (const name of ['--focus', '--border-strong', '--reply-line']) expect(ratio(hex(set, name), hex(set, '--bg')), name).toBeGreaterThanOrEqual(3);
      expect(ratio(hex(set, '--reply-line'), hex(set, '--reply-bg'))).toBeGreaterThanOrEqual(3);
    });
  });
}
