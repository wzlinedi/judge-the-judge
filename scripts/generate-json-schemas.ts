// Writes docs/schemas/*.schema.json. Run by `npm run build` and with `npm run schemas`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { jsonSchemas, SCHEMA_DIRECTORY } from './json-schemas';

mkdirSync(SCHEMA_DIRECTORY, { recursive: true });
for (const [name, text] of Object.entries(jsonSchemas())) writeFileSync(`${SCHEMA_DIRECTORY}/${name}`, text);
