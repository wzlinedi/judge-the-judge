import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const forbiddenImports = /from\s+['"][^'"]*\/(ui|app|sources)(\/[^'"]*)?['"]/;
const forbiddenGlobals = [
  /\bwindow\b/,
  /\bdocument\b/,
  /\bnavigator\b/,
  /\bfetch\s*\(/,
  /\blocalStorage\b/,
  /\bDate\.now\b/,
  /new\s+Date\s*\(/,
  /\bMath\.random\b/,
];

describe('core boundary (Principle III)', () => {
  const files = sourceFiles('src/core');

  it('finds the core sources', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s imports nothing from ui, app or sources', (file) => {
    expect(stripComments(readFileSync(file, 'utf8'))).not.toMatch(forbiddenImports);
  });

  it.each(files)('%s uses no browser, clock or random API', (file) => {
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const pattern of forbiddenGlobals) expect(text, `${file} matches ${pattern}`).not.toMatch(pattern);
  });
});
