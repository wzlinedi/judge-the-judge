// Writes the invalid and unsupported files of quickstart V11 into tmp/invalid-files/, to try by hand. Run with `npm run invalid-files`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { invalidFiles } from './invalid-files';

const dir = 'tmp/invalid-files';
mkdirSync(dir, { recursive: true });
for (const [name, text] of Object.entries(invalidFiles)) writeFileSync(`${dir}/${name}`, text);
console.log(`${Object.keys(invalidFiles).length} files written to ${dir}/`);
