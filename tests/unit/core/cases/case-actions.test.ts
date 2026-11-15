// FR-017, FR-025, FR-033, FR-039, FR-053, FR-078: identifiers, who may be changed, and the late marks.
import { describe, expect, it } from 'vitest';
import { assignIdentifiers, nextCaseId } from '../../../../src/core/cases/identifiers';
import { canChangeCase, markLate } from '../../../../src/core/cases/case-actions';
import type { TestCase } from '../../../../src/core/model';
import { sampleEvaluation } from '../../../helpers/fixtures';

const e = sampleEvaluation();
const cases = e.dataset.cases;

describe('identifiers', () => {
  it('uses the next free number', () => {
    expect(nextCaseId([])).toBe('1');
    expect(nextCaseId(cases)).toBe('3');
    expect(nextCaseId([{ ...cases[0]!, id: 'x' }, { ...cases[0]!, id: '7' }])).toBe('8');
  });

  it('assigns identifiers to cases without one, never colliding, and to their expected errors', () => {
    const made = assignIdentifiers(
      [
        { name: 'A', fields: {}, expected_errors: [{ id: 'e2', description: 'kept' }, { description: 'new' }] },
        { id: '1', name: 'B', fields: {}, expected_errors: [] },
        { name: 'C', fields: {}, expected_errors: [] },
      ],
      cases,
    );
    expect(made.map((c) => c.id)).toEqual(['3', '4', '5']);
    expect(made[0]!.expected_errors.map((x) => x.id)).toEqual(['e2', 'e1']);
  });
});

describe('canChangeCase', () => {
  it('allows everything before finalizing', () => {
    const open = { ...e.dataset.cases };
    void open;
    expect(canChangeCase(cases, {}, false, '1', 'rename')).toEqual({ allowed: true });
  });

  it('allows Edit expected errors, Rename and Remove for a case with a reply too (T234, T254)', () => {
    for (const action of ['correct', 'rename', 'remove'] as const) expect(canChangeCase(cases, e.replies, true, '2', action)).toEqual({ allowed: true });
  });

  it('allows them after finalizing for a case without a reply', () => {
    const noReplies = {};
    expect(canChangeCase(cases, noReplies, true, '2', 'rename').allowed).toBe(true);
    expect(canChangeCase(cases, noReplies, true, '2', 'correct').allowed).toBe(true);
  });

  it('allows removing a base that other cases were made from (T283)', () => {
    expect(canChangeCase(cases, {}, false, '1', 'remove')).toEqual({ allowed: true });
    expect(canChangeCase(cases, {}, false, '1', 'rename')).toEqual({ allowed: true });
  });
});

describe('markLate (FR-053)', () => {
  const plain: TestCase = { id: '5', name: 'x', fields: {}, expected_errors: [] };

  it('marks nothing before the first reply', () => {
    expect(markLate(plain, false, 'added')).toBe(plain);
  });

  it('marks a case added or imported after the first reply as added', () => {
    expect(markLate(plain, true, 'added').changed_after_first_reply).toBe('added');
  });

  it('marks a corrected case as corrected, but an added one stays added', () => {
    expect(markLate(plain, true, 'corrected').changed_after_first_reply).toBe('corrected');
    expect(markLate({ ...plain, changed_after_first_reply: 'added' }, true, 'corrected').changed_after_first_reply).toBe('added');
  });
});
