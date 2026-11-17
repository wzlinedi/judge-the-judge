// T434, T439 (FR-091, FR-092, SC-049; research.md, 35.3 to 35.5): the Editorial look of base.css and components.css, read from the CSS text.
// styles.test.ts keeps its rules (weights, radii, spaces, breakpoint, no literal color); this file checks the Editorial choices on top of them.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = ['src/ui/styles/base.css', 'src/ui/styles/components.css'] as const;

interface Rule {
  file: string;
  selectors: string[];
  declarations: Record<string, string>;
}

const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '');
/** Split a selector list on the commas that are not inside parentheses. */
function splitSelectors(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

function rulesOf(file: string): Rule[] {
  const rules: Rule[] = [];
  for (const m of strip(readFileSync(file, 'utf8')).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations: Record<string, string> = {};
    for (const d of (m[2] as string).split(';')) {
      const at = d.indexOf(':');
      if (at !== -1) declarations[d.slice(0, at).trim()] = d.slice(at + 1).trim();
    }
    rules.push({ file, selectors: splitSelectors(m[1] as string), declarations });
  }
  return rules;
}

const rules = FILES.flatMap(rulesOf);
/** The value of a property for one selector, the last rule in the cascade order (base.css, then components.css) winning. */
function value(selector: string, property: string): string | undefined {
  let found: string | undefined;
  for (const rule of rules) if (rule.selectors.includes(selector) && rule.declarations[property] !== undefined) found = rule.declarations[property];
  return found;
}
/** Every rule that names the selector. */
const rulesFor = (selector: string) => rules.filter((r) => r.selectors.includes(selector));
const SINGLE_WEIGHT = /var\(--font-(display|body|mono)\b/;

describe('the Editorial type of base.css and the shell (T434; research.md, 35.3 and 35.4)', () => {
  it('sets the body in Inter', () => {
    expect(value('body', 'font')).toContain('var(--font)');
  });

  it('sets the names of views and sections and the title of the case window in the display font at 400 and --text-2xl', () => {
    for (const selector of ['.app-main h2:not(.dialog h2)', '.case-window-title']) {
      expect(value(selector, 'font-family'), selector).toBe('var(--font-display)');
      expect(value(selector, 'font-weight'), selector).toBe('400');
      expect(value(selector, 'font-size'), selector).toBe('var(--text-2xl)');
    }
  });

  it('sets the tool name in the display font at 400 and --text-xl, and every dialog title in Inter at 600 and --text-lg', () => {
    expect(value('.app-name', 'font-family')).toBe('var(--font-display)');
    expect(value('.app-name', 'font-weight')).toBe('400');
    expect(value('.app-name', 'font-size')).toBe('var(--text-xl)');
    expect(value('.dialog h2', 'font-family')).toBe('var(--font)');
    expect(value('.dialog h2', 'font-weight')).toBe('600');
    expect(value('.dialog h2', 'font-size')).toBe('var(--text-lg)');
  });

  it('gives every rule in the display, body or mono font the weight 400: these fonts have no bold file', () => {
    const offenders = rules
      .filter((r) => SINGLE_WEIGHT.test(r.declarations['font-family'] ?? '') || SINGLE_WEIGHT.test(r.declarations['font'] ?? ''))
      .filter((r) => r.declarations['font-weight'] !== '400' && !/^400\b/.test(r.declarations['font'] ?? ''))
      .map((r) => `${r.file.split('/').pop()}: ${r.selectors.join(', ')}`);
    expect(offenders).toEqual([]);
  });

  it('sets the table heads, the status marks of a table, the number of the current step and the number of a mark at 400; the counts stay Inter at 600', () => {
    for (const selector of ['th', 'td .status-mark', '.step.current .step-number', '.fragment sup']) {
      expect(value(selector, 'font-weight'), selector).toBe('400');
    }
    expect(value('.count dd', 'font-weight')).toBe('600');
    expect(value('.count dd', 'font-family') ?? 'var(--font)').toBe('var(--font)');
  });

  it('sets the texts of a case and the "what next" sentence in Newsreader at --text-body', () => {
    for (const selector of ['.field-text', '.next-sentence']) {
      expect(value(selector, 'font-family'), selector).toBe('var(--font-body)');
      expect(value(selector, 'font-size'), selector).toBe('var(--text-body)');
    }
  });

  it('sets code, JSON and table heads in JetBrains Mono; a table head is a small muted label in capitals', () => {
    for (const selector of ['code', 'pre', 'textarea.json', 'th']) expect(value(selector, 'font-family'), selector).toBe('var(--font-mono)');
    expect(value('th', 'font-size')).toBe('var(--text-xs)');
    expect(value('th', 'text-transform')).toBe('uppercase');
    expect(value('th', 'color')).toBe('var(--text-muted)');
  });

  it('keeps the message banner at --text-md (refusals-are-seen.spec.ts needs 16 px)', () => {
    expect(value('.notice-line.has-message', 'font-size')).toBe('var(--text-md)');
  });

  it('underlines every link and link button, and no rule removes the underline (WCAG 1.4.1)', () => {
    for (const selector of ['a', '.link-button']) expect(value(selector, 'text-decoration') ?? value(selector, 'text-decoration-line'), selector).toContain('underline');
    const removed = rules.filter((r) => r.selectors.some((s) => /(^|\s)a\b|\.link-button/.test(s)) && /^none\b/.test(r.declarations['text-decoration'] ?? r.declarations['text-decoration-line'] ?? ''));
    expect(removed.map((r) => r.selectors.join(', '))).toEqual([]);
  });

  it('writes the leading zero of a step number as generated content that is not read (SC-049)', () => {
    expect(value('.step-number::before', 'content')).toBe('"0" / ""');
  });

  it('keeps the weight of a passage pointed at: Newsreader has no bold file', () => {
    for (const rule of rulesFor('.fragment-strong')) {
      const weight = rule.declarations['font-weight'];
      if (weight !== undefined) expect(['inherit', 'normal']).toContain(weight);
    }
  });
});

describe('the Editorial views and windows (T439; research.md, 35.4 and 35.7)', () => {
  it('draws a card as a flat section: no fill, no radius, no side borders, a hairline at its top', () => {
    expect(['transparent', 'none']).toContain(value('.card', 'background'));
    expect(value('.card', 'border-radius')).toBe('0');
    expect(value('.card', 'border')).toBe('0');
    expect(value('.card', 'border-top')).toBe('1px solid var(--border)');
  });

  it('keeps the 1 px frame of a case part on all sides (v4-test-case-window.spec.ts checks the top one)', () => {
    expect(value('.case-part', 'border')).toBe('1px solid var(--border)');
  });

  it('draws a status mark in a table as a mono pill', () => {
    expect(value('td .status-mark', 'border-radius')).toBe('var(--radius-lg)');
    expect(value('td .status-mark', 'font-family')).toBe('var(--font-mono)');
    expect(value('td .status-mark', 'font-size')).toBe('var(--text-xs)');
  });

  it('marks a passage with a 2 px line in the color of its state, and the radius of a control', () => {
    expect(value('.fragment', 'border-bottom')).toBe('2px solid var(--mark-warning-line)');
    expect(value('.fragment-found', 'border-bottom-color')).toBe('var(--mark-success-line)');
    expect(value('.fragment-missed', 'border-bottom-color')).toBe('var(--mark-error-line)');
    expect(value('.fragment', 'border-radius')).toBe('var(--radius)');
  });

  it('keeps the gap after the number of a mark (layout-details.spec.ts needs 3 px)', () => {
    expect(value('.fragment sup', 'margin-right')).toBe('var(--space-1)');
  });

  it('sets the overall result in the display font at --text-3xl, the counts in Inter 600 with tabular figures, the rates in the display font at --text-xl', () => {
    expect(value('.overall-result', 'font-family')).toBe('var(--font-display)');
    expect(value('.overall-result', 'font-weight')).toBe('400');
    expect(value('.overall-result', 'font-size')).toBe('var(--text-3xl)');
    expect(value('.count dd', 'font-family')).toBe('var(--font)');
    expect(value('.count dd', 'font-weight')).toBe('600');
    expect(value('.count dd', 'font-variant-numeric')).toBe('tabular-nums');
    expect(value('.rate dd', 'font-family')).toBe('var(--font-display)');
    expect(value('.rate dd', 'font-weight')).toBe('400');
    expect(value('.rate dd', 'font-size')).toBe('var(--text-xl)');
  });

  it('puts dialogs and the More menu on the raised surface with the large radius and the one shadow', () => {
    for (const selector of ['.dialog', '.menu']) {
      expect(value(selector, 'background'), selector).toBe('var(--surface)');
      expect(value(selector, 'border-radius'), selector).toBe('var(--radius-lg)');
      expect(value(selector, 'box-shadow'), selector).toBe('var(--shadow)');
    }
  });

  it('frames a table with the large radius', () => {
    expect(value('.table-scroll', 'border-radius')).toBe('var(--radius-lg)');
  });
});

/** The bodies of the `@media (min-width: 760px)` blocks of a file, found by matching braces (value() reads their rules as plain rules). */
function wideBlocks(file: string): string[] {
  const text = strip(readFileSync(file, 'utf8'));
  const blocks: string[] = [];
  for (const m of text.matchAll(/@media\s*\(min-width:\s*760px\)\s*\{/g)) {
    let depth = 1;
    let i = (m.index as number) + m[0].length;
    const start = i;
    for (; i < text.length && depth > 0; i += 1) {
      if (text[i] === '{') depth += 1;
      if (text[i] === '}') depth -= 1;
    }
    blocks.push(text.slice(start, i - 1));
  }
  return blocks;
}
/** The declarations of a selector in the rules outside every media block of a file. */
function plainDeclarations(file: string, selector: string): Record<string, string> {
  const text = strip(readFileSync(file, 'utf8')).replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!splitSelectors(m[1] as string).includes(selector)) continue;
    for (const d of (m[2] as string).split(';')) {
      const at = d.indexOf(':');
      if (at !== -1) out[d.slice(0, at).trim()] = d.slice(at + 1).trim();
    }
  }
  return out;
}

describe('the Editorial type of fields, inputs and tables (Phase 33; research.md, 35.4)', () => {
  const INPUTS = ['input[type="text"]', 'input:not([type])', 'textarea', 'select'];

  it('sets a field label as a small muted mono label in capitals, like a table head', () => {
    for (const selector of ['.field-label', '.rule-head label', '.category label']) {
      expect(value(selector, 'font-family'), selector).toBe('var(--font-mono)');
      expect(value(selector, 'font-weight'), selector).toBe('400');
      expect(value(selector, 'font-size'), selector).toBe('var(--text-xs)');
      expect(value(selector, 'text-transform'), selector).toBe('uppercase');
      expect(value(selector, 'letter-spacing'), selector).toBe('0.08em');
      expect(value(selector, 'color'), selector).toBe('var(--text-muted)');
    }
  });

  it('sets the typed text of an input in Inter at --text-sm, without the capitals of a label that holds it', () => {
    for (const selector of INPUTS) {
      expect(value(selector, 'font-family'), selector).toBe('var(--font)');
      expect(value(selector, 'font-size'), selector).toBe('var(--text-sm)');
      expect(value(selector, 'text-transform'), selector).toBe('none');
      expect(value(selector, 'letter-spacing'), selector).toBe('normal');
    }
  });

  it('keeps a JSON editor in the mono font at --text-sm', () => {
    expect(value('textarea.json', 'font-family')).toBe('var(--font-mono)');
    expect(value('textarea.json', 'font-size')).toBe('var(--text-sm)');
  });

  it('sets a table cell at --text-sm', () => {
    expect(value('td', 'font-size')).toBe('var(--text-sm)');
  });

  it('lines the message banner up with the content from 760 px; below 760 px it keeps its 16 px margins and --text-md', () => {
    const file = 'src/ui/styles/components.css';
    const wide = wideBlocks(file)
      .flatMap((block) => [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)])
      .filter((m) => splitSelectors(m[1] as string).includes('.notice-line.has-message'))
      .map((m) => (m[2] as string).replace(/\s+/g, ' ').trim());
    expect(wide.length, 'a .notice-line.has-message rule in a 760 px media block').toBeGreaterThan(0);
    expect(wide.join(' ')).toContain('margin: var(--space-2) var(--space-6)');
    const plain = plainDeclarations(file, '.notice-line.has-message');
    expect(plain['margin']).toBe('var(--space-2) var(--space-4)');
    expect(plain['font-size']).toBe('var(--text-md)');
  });
});
