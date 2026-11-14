// The plan of an import: what is valid, what is not, and what the summary has to say (FR-027 to FR-033, FR-079).
import { describe, expect, it } from 'vitest';
import { planImport, type ImportContext } from '../../../../src/core/cases/validate-test-cases';
import type { DraftCase } from '../../../../src/core/io/test-cases-json';
import { sampleEvaluation } from '../../../helpers/fixtures';

const e = sampleEvaluation();
const context = (over: Partial<ImportContext> = {}): ImportContext => ({ variables: ['source_text', 'summary'], judgedText: 'summary', catalog: e.judge_set.error_catalog, existing: [], ...over });
const draft = (over: Partial<DraftCase> = {}): DraftCase => ({ name: 'N', fields: { source_text: 'S', summary: 'T' }, expected_errors: [], ...over });
const rows = (...drafts: DraftCase[]) => drafts.map((d, i) => ({ position: i + 1, draft: d }));

describe('planImport', () => {
  it('counts clean cases and cases with injected errors', () => {
    const plan = planImport(rows(draft({ name: 'A' }), draft({ name: 'B', expected_errors: [{ description: 'd', category: 'factual-error', fragment: 'T' }] })), [], context());
    expect(plan.clean).toBe(1);
    expect(plan.injected).toBe(1);
    expect(plan.cases.map((c) => c.id)).toEqual(['1', '2']);
    expect(plan.cases[1]!.expected_errors[0]!.id).toBe('e1');
  });

  it('assigns identifiers after the existing ones, and names a used identifier as new', () => {
    const plan = planImport(rows(draft({ id: '1', name: 'A' }), draft({ id: '9', name: 'B' })), [], context({ existing: e.dataset.cases }));
    expect(plan.cases.map((c) => c.id)).toEqual(['3', '9']);
    expect(plan.newIdentifiers).toBe(1);
  });

  it('lets a base follow the new identifier of its case, and drops a base that is nowhere', () => {
    const plan = planImport(
      rows(draft({ id: '1', name: 'Clean' }), draft({ id: '2', name: 'Injected', base: '1', fields: { source_text: 'S', summary: 'T2' }, expected_errors: [{ description: 'd', fragment: 'T2' }] }), draft({ id: '3', name: 'Lost', base: '77' })),
      [],
      context({ existing: e.dataset.cases }),
    );
    expect(plan.cases.map((c) => [c.id, c.base])).toEqual([['3', undefined], ['4', '3'], ['5', undefined]]);
    expect(plan.notes.join(' ')).toMatch(/base "77"/);
  });

  it('keeps a name that is already used and names it, so that both cases warn', () => {
    const plan = planImport(rows(draft({ name: 'Anna' }), draft({ name: 'Fresh' }), draft({ name: 'fresh ' })), [], context({ existing: e.dataset.cases }));
    expect(plan.cases).toHaveLength(3);
    expect(plan.duplicateNames).toEqual(['Anna', 'Fresh']);
  });

  it('names categories that are not in the catalog, once each', () => {
    const plan = planImport(rows(draft({ expected_errors: [{ description: 'd', category: 'tone-shift' }, { description: 'd', category: 'tone-shift' }, { description: 'd', category: 'factual-error' }] })), [], context());
    expect(plan.missingCategories).toEqual(['tone-shift']);
  });

  it('puts a case with a field that is too long, empty or identical to its base among the invalid, with position and reason', () => {
    const plan = planImport(
      rows(draft({ name: 'Long', fields: { source_text: 'x'.repeat(100_001), summary: 'T' } }), draft({ name: 'Empty', fields: { source_text: 'S', summary: '' } }), draft({ id: '8', name: 'Twin', base: '1', fields: e.dataset.cases[0]!.fields, expected_errors: [{ description: 'd' }] }), draft({ name: 'Fine' })),
      [{ position: 9, label: 'Broken', reason: 'The case has no fields.' }],
      context({ existing: e.dataset.cases }),
    );
    expect(plan.cases.map((c) => c.name)).toEqual(['Fine']);
    expect(plan.invalid.map((i) => i.position)).toEqual([9, 1, 2, 3]);
    expect(plan.invalid.find((i) => i.position === 3)!.reason).toMatch(/identical to its base/);
  });

  it('reports fields that match no variable and variables that have no field', () => {
    const plan = planImport(rows(draft({ fields: { source_text: 'S', extra: 'X' } })), [], context());
    expect(plan.unmatchedFields).toEqual(['extra']);
    expect(plan.missingVariables).toEqual(['summary']);
    expect(plan.cases).toHaveLength(1);
  });

  it('refuses more than 500 cases in the test project after the import, naming the limit and the number found', () => {
    const many = Array.from({ length: 501 }, (_, i) => draft({ name: `C${i}` }));
    const plan = planImport(rows(...many), [], context());
    expect(plan.tooMany).toEqual({ limit: 500, found: 501 });
    const withExisting = planImport(rows(...many.slice(0, 499)), [], context({ existing: e.dataset.cases }));
    expect(withExisting.tooMany).toEqual({ limit: 500, found: 501 });
    expect(planImport(rows(...many.slice(0, 498)), [], context({ existing: e.dataset.cases })).tooMany).toBeUndefined();
  });
});
