// A prompt variable that is a built-in JavaScript name is not "present" in a case that lacks the field (S1, Constitution IX, T397).
import { describe, expect, it } from 'vitest';
import { planImport } from '../../../../src/core/cases/validate-test-cases';
import { sampleProject } from '../../../helpers/fixtures';

const e = sampleProject();

describe('planImport with a variable that is a built-in JavaScript name', () => {
  it.each(['constructor', 'toString', 'hasOwnProperty'])('{{%s}}: cases without that field are listed in missingVariables', (name) => {
    const rows = [{ position: 1, draft: { name: 'N', fields: { source_text: 'S', summary: 'T' }, expected_errors: [] } }];
    const plan = planImport(rows, [], { variables: ['source_text', 'summary', name], judgedText: 'summary', catalog: e.judge_set.error_catalog, existing: [] });
    expect(plan.missingVariables).toEqual([name]);
  });
});
