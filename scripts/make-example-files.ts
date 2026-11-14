// Writes the example CSV of the import window for the variables of the Accuracy metric (FR-030). Run with `npm run examples`.
import { writeFileSync } from 'node:fs';
import { exampleCsv } from '../src/core/io/example-csv';

writeFileSync('examples/files/test-cases-example.csv', exampleCsv(['source_text', 'summary']).text);
