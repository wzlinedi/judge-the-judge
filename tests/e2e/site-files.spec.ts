// T220: the files the Help names are on the published site, so a user of the site can open them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : name === '.gitkeep' ? [] : [path];
  });

test('every example, every JSON Schema and the metric guide are served next to the page, unchanged', async ({ request }) => {
  const files = [...filesUnder('examples'), ...filesUnder('docs')];
  expect(files.length).toBeGreaterThan(10);
  for (const file of files) {
    const response = await request.get(`/${file}`);
    expect(response.status(), file).toBe(200);
    expect(await response.text(), file).toBe(readFileSync(file, 'utf8'));
  }
});
