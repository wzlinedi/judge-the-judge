// The example file of the import window (FR-030): the variables of the current judge prompt as `field:` columns, two clean cases.
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;

export function exampleCsv(variables: readonly string[]): { text: string; note?: string } {
  const columns = variables.length > 0 ? variables : ['field_1'];
  const header = ['name', ...columns.map((v) => `field:${v}`)].join(',');
  const row = (name: string, text: (v: string) => string) => [quote(name), ...columns.map((v) => quote(text(v)))].join(',');
  const lines = [header, row('First clean case', (v) => `Correct text for ${v}`), row('Second clean case', (v) => `Another correct text for ${v}`)];
  return {
    text: `﻿${lines.join('\r\n')}\r\n`,
    ...(variables.length === 0 ? { note: 'The judge prompt has no variables yet, so the example uses field:field_1. Write the prompt first and download the example again.' } : {}),
  };
}
