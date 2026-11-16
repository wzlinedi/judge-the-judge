// T317 (FR-091, FR-092; research.md, sections 33.4 and 33.5): the style files take every color, radius, shadow, space and weight from the tokens,
// use one breakpoint, and give the headings three looks. The rules are read from the CSS text, so a one-off value fails the test.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = ['src/ui/styles/base.css', 'src/ui/styles/components.css'] as const;

interface Declaration {
  file: string;
  selector: string;
  property: string;
  value: string;
}

function strip(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function declarationsOf(file: string): Declaration[] {
  const found: Declaration[] = [];
  const css = strip(readFileSync(file, 'utf8'));
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (rule[1] as string).trim();
    for (const declaration of (rule[2] as string).split(';')) {
      const at = declaration.indexOf(':');
      if (at === -1) continue;
      found.push({ file, selector, property: declaration.slice(0, at).trim(), value: declaration.slice(at + 1).trim() });
    }
  }
  return found;
}

const all = FILES.flatMap(declarationsOf);
const show = (d: Declaration) => `${d.file.split('/').pop()}: ${d.selector} { ${d.property}: ${d.value} }`;
const offenders = (bad: (d: Declaration) => boolean) => all.filter(bad).map(show);

describe('the style files use only the tokens (FR-091)', () => {
  it('has no hex, rgb, hsl or named color', () => {
    const named = /\b(white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|silver|gold|navy)\b/i;
    const colorProperty = /color|background|border|outline|fill|stroke|shadow/;
    expect(offenders((d) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(d.value) || (colorProperty.test(d.property) && named.test(d.value)))).toEqual([]);
  });

  it('uses a shadow only as var(--shadow), and only on dialogs and menus', () => {
    expect(offenders((d) => d.property === 'box-shadow' && d.value !== 'none' && d.value !== 'var(--shadow)')).toEqual([]);
    expect(offenders((d) => d.property === 'box-shadow' && d.value === 'var(--shadow)' && !/\.dialog|\.menu/.test(d.selector))).toEqual([]);
  });

  it('uses two radii: var(--radius) and var(--radius-lg), and 0', () => {
    expect(offenders((d) => d.property.startsWith('border-radius') && d.value.split(/\s+/).some((t) => !['var(--radius)', 'var(--radius-lg)', '0'].includes(t)))).toEqual([]);
  });

  it('takes every margin, padding and gap from the scale of 4 px (var(--space-1) to var(--space-6)), 0 or auto', () => {
    const bad = (d: Declaration): boolean => {
      if (!/^(margin|padding|gap|row-gap|column-gap)(-|$)/.test(d.property)) return false;
      if (d.selector === '.visually-hidden' && d.property === 'margin' && d.value === '-1px') return false;
      const rest = d.value.replace(/var\(--space-[1-6]\)/g, '').replace(/calc\([^)]*\)/g, '');
      return rest.split(/[\s,]+/).filter(Boolean).some((t) => t !== '0' && t !== 'auto');
    };
    expect(offenders(bad)).toEqual([]);
  });

  it('uses the one breakpoint, 760 px', () => {
    const queries = FILES.flatMap((file) => [...strip(readFileSync(file, 'utf8')).matchAll(/@media[^{]*/g)].map((m) => m[0].trim()));
    expect(queries.filter((q) => /\d+px/.test(q) && !/^@media \((min-width:\s*760px|max-width:\s*759px)\)$/.test(q))).toEqual([]);
  });

  it('uses only the weights 400 and 600 (and inherit or normal)', () => {
    expect(offenders((d) => d.property === 'font-weight' && !['400', '600', 'inherit', 'normal'].includes(d.value))).toEqual([]);
  });

  it('gives h4 and h5 the look of an h3 or of a small label, never a fourth size (Clarifications 2026-11-16)', () => {
    const rules = all.filter((d) => /\bh[45]\b/.test(d.selector) && d.property === 'font-size');
    expect(rules.filter((d) => !['var(--text-md)', 'var(--text-sm)'].includes(d.value)).map(show)).toEqual([]);
    const base = all.filter((d) => d.file.endsWith('base.css') && /(^|,\s*)h4(,|$)/.test(d.selector));
    expect(base.find((d) => d.property === 'font-weight')?.value, 'base.css sets the weight of h4 and h5').toBe('600');
    expect(base.find((d) => d.property === 'font-size')?.value).toBe('var(--text-md)');
  });
});

describe('the tokens of the redesign (research.md, section 33.4)', () => {
  const tokens = strip(readFileSync('src/ui/styles/tokens.css', 'utf8'));
  const names = (pattern: RegExp) => [...new Set([...tokens.matchAll(pattern)].map((m) => m[1]))];

  it('has exactly two radii and one shadow', () => {
    expect(names(/(--radius[\w-]*)\s*:/g).sort()).toEqual(['--radius', '--radius-lg']);
    expect(names(/(--shadow[\w-]*)\s*:/g)).toEqual(['--shadow']);
  });

  it('keeps the six spaces of the 4 px scale and the sizes of the type', () => {
    expect(names(/(--space-\d+)\s*:/g)).toEqual(['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6']);
    expect(names(/(--text-(?:sm|md|lg|xl|2xl))\s*:/g).sort()).toEqual(['--text-2xl', '--text-lg', '--text-md', '--text-sm', '--text-xl']);
  });
});
