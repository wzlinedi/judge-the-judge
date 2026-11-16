// T316 (FR-007, FR-091, FR-094, SC-047; research.md, section 33): the design tokens keep the colors of the redesign and every text pair
// reaches 4.5:1 (focus ring, strong edges and the reply line 3:1) in the light, the dark and the navy sets. The ratios are computed here
// from `tokens.css`, so the numbers of research.md cannot drift.
import { readFileSync } from 'node:fs';
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
const navyOverrides = find((b) => b.selector === ':root[data-palette="navy"]').tokens;
const navy = { ...light, ...navyOverrides };
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
const sets = { light, dark, navy } as const;

describe('the colors of FR-007 and research.md, section 33', () => {
  it('the light set is Stone and forest green', () => {
    const expected: Record<string, string> = { '--bg': '#F2F3ED', '--surface': '#FBFCF8', '--surface-2': '#E7EAE0', '--border': '#D5DBD1', '--border-strong': '#7C8A7B', '--text': '#202720', '--text-muted': '#5F6A5E', '--accent': '#315D48', '--accent-hover': '#264A39', '--on-accent': '#FFFFFF', '--focus': '#315D48' };
    for (const [name, value] of Object.entries(expected)) expect(light[name]?.toUpperCase(), name).toBe(value);
  });

  it('the dark set follows the system with the same values in the media query and in the data-theme block', () => {
    expect(darkMedia).toEqual(darkAttribute);
    const expected: Record<string, string> = { '--bg': '#121713', '--surface': '#1A211C', '--surface-2': '#242C26', '--text': '#E6EBE3', '--text-muted': '#A3AEA2', '--accent': '#7DBE9C', '--on-accent': '#0E1A13' };
    for (const [name, value] of Object.entries(expected)) expect(dark[name]?.toUpperCase(), name).toBe(value);
  });

  it('the navy set is only a block of tokens that the tool never selects', () => {
    const expected: Record<string, string> = { '--bg': '#F2F5F8', '--surface': '#FCFDFF', '--text': '#202832', '--text-muted': '#5E6B7A', '--border': '#D6DFE8', '--accent': '#345D86', '--on-accent': '#FFFFFF' };
    for (const [name, value] of Object.entries(expected)) expect(navyOverrides[name]?.toUpperCase(), name).toBe(value);
    expect(navyOverrides['--border-strong']).toBeTruthy();
  });

  it('defines the tokens of the redesign for the size, the width and the control', () => {
    expect(light['--text-2xl']).toBe('2rem');
    expect(light['--content-max']).toBe('100rem');
    expect(light['--prose-max']).toBe('72ch');
    expect(light['--control-height']).toBe('2.25rem');
    for (const name of ['--reply-bg', '--reply-line', '--reply-strong-bg', '--border-strong', '--shadow', '--radius', '--radius-lg']) {
      expect(light[name], name).toBeTruthy();
      expect(dark[name] ?? light[name], name).toBeTruthy();
    }
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
