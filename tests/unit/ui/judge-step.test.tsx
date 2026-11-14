// The Judge step (User Story 2; FR-009 to FR-014, FR-021, FR-084, FR-088, SC-037, SC-038).
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { JudgeStep } from '../../../src/ui/steps/judge/JudgeStep';
import { nextAction } from '../../../src/app/selectors';
import { createState, type AppState } from '../../../src/app/store';
import { startFromMetric } from '../../../src/app/actions/judge';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { metricFor } from '../../../src/app/metrics';
import { sampleEvaluation } from '../../helpers/fixtures';

const SAMPLE = JSON.stringify({ claims: [{ text: 'The hero is a doctor', verdict: 'contradicted' }, { text: 'The hero is a baker', verdict: 'supported' }] });

let latest: AppState = createState();
let notes: string[] = [];

function Harness({ start }: { start: AppState }) {
  const [state, setState] = useState(start);
  latest = state;
  return (
    <JudgeStep
      state={state}
      onEdit={(result) => {
        setState(result.state);
        latest = result.state;
        if (result.note) notes.push(result.note);
      }}
    />
  );
}

const show = (start: AppState = createState()) => {
  notes = [];
  return render(<Harness start={start} />);
};
const type = (label: string | RegExp, value: string) => fireEvent.input(screen.getByLabelText(label), { target: { value } });
const accuracy = () => startFromMetric(createState(), metricFor('accuracy'), createFakePorts());

describe('what the step shows', () => {
  it('has no welcome section, no catalog, no clean case section and no Save evaluation', () => {
    show();
    expect(screen.queryByText(/welcome/i)).toBeNull();
    expect(screen.queryByText(/error categories/i)).toBeNull();
    expect(screen.queryByText(/clean case/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /save evaluation/i })).toBeNull();
  });

  it('has no button of its own besides Add rule, Add condition, Remove and Explain', () => {
    show(accuracy());
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    const names = screen.getAllByRole('button').map((b) => (b.textContent ?? '').trim());
    for (const name of names) expect(['Add rule', 'Add condition', 'Remove', 'Explain']).toContain(name);
  });

  it('keeps every paragraph to one sentence and puts explanations behind Explain', () => {
    show(accuracy());
    for (const p of document.querySelectorAll('p')) expect((p.textContent ?? '').match(/[.!?](\s|$)/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: 'Explain' }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/judged text is the output/i)).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Explain' })[0]!);
    expect(document.querySelector('.explain-body')).not.toBeNull();
  });
});

describe('prompt, variables and judged text (FR-010)', () => {
  it('lists the variables live and proposes the last as the judged text', () => {
    show();
    type('Judge prompt', '{{prompt_input}} {{prompt_output}} {{context}}');
    const list = screen.getByRole('list', { name: 'Variables' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('prompt_input'), expect.stringContaining('prompt_output'), expect.stringContaining('context'),
    ]);
    expect((screen.getByRole('radio', { name: /context/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /prompt_output/ }));
    expect(latest.evaluation.judge_set.judged_text).toBe('prompt_output');
  });

  it('says that nothing reaches the prompt when it has no variables', () => {
    show();
    type('Judge prompt', 'Just text');
    expect(screen.getByText(/nothing from the test cases will reach the prompt/i)).toBeTruthy();
  });

  it('tells the user when the judged text had to change', () => {
    show();
    type('Judge prompt', '{{a}} {{b}}');
    fireEvent.click(screen.getByRole('radio', { name: /a/ }));
    type('Judge prompt', '{{b}} {{c}}');
    expect(notes.join(' ')).toMatch(/no longer in the prompt/);
  });

  it('shows the judge version once there is a prompt', async () => {
    show(accuracy());
    expect(await screen.findByText(/Judge version: [0-9a-f]{12}/)).toBeTruthy();
  });

  it('is read-only once the test cases are finalized, and says why', () => {
    show({ ...createState(), evaluation: sampleEvaluation() });
    expect((screen.getByLabelText('Judge prompt') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.getByText(/fixed because the test cases are finalized/i)).toBeTruthy();
  });
});

describe('sample reply (FR-011, FR-084, FR-088, SC-037)', () => {
  it('reads a broken sample at once, shows line and column and keeps the text', () => {
    show();
    type('Sample reply', '{\n  "claims": [\n');
    expect(screen.getByText(/Line \d+, column \d+/)).toBeTruthy();
    expect((screen.getByLabelText('Sample reply') as HTMLTextAreaElement).value).toBe('{\n  "claims": [\n');
    expect(screen.queryByRole('button', { name: /read|check|analy/i })).toBeNull();
  });

  it('shows the fields with paths, kinds and values once the sample is fixed, also inside a code fence', () => {
    show();
    type('Sample reply', 'Here you go:\n```json\n' + SAMPLE + '\n```');
    const table = screen.getByRole('table', { name: 'Fields of the sample reply' });
    expect(within(table).getByText('claims[].verdict')).toBeTruthy();
    expect(within(table).getByText(/contradicted/)).toBeTruthy();
    expect(screen.queryByText(/Line \d+/)).toBeNull();
  });

  it('keeps the fields of the last readable sample while the new text is broken', () => {
    show();
    type('Sample reply', SAMPLE);
    type('Sample reply', SAMPLE.slice(0, 20));
    expect(screen.getByRole('table', { name: 'Fields of the sample reply' })).toBeTruthy();
  });

  it('has no "Text of a finding" choice per list: it moved to each rule as "Where the error is" (T232)', () => {
    show();
    type('Sample reply', SAMPLE);
    expect(screen.queryByLabelText(/Text of a finding/)).toBeNull();
    expect(screen.queryByLabelText(/Where the error is/)).toBeNull();
  });
});

describe('rules (FR-013, FR-014)', () => {
  const withSample = () => {
    show();
    type('Sample reply', SAMPLE);
  };

  it('each rule about a list has its own "Where the error is": proposed automatically, changeable, and absent in the file while it is the proposal (T232)', () => {
    withSample();
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    fireEvent.change(screen.getByLabelText(/Field of condition 1 of rule 1/), { target: { value: 'claims[].verdict' } });
    const select = screen.getByLabelText(/Where the error is in rule 1/) as HTMLSelectElement;
    expect(select.value).toBe('claims[].text');
    expect(latest.evaluation.judge_set.error_rules[0]).not.toHaveProperty('finding_text');
    fireEvent.change(select, { target: { value: 'claims[].verdict' } });
    expect(latest.evaluation.judge_set.error_rules[0]?.finding_text).toBe('claims[].verdict');
    fireEvent.change(select, { target: { value: 'claims[].text' } });
    expect(latest.evaluation.judge_set.error_rules[0]).not.toHaveProperty('finding_text');
  });

  it('a rule about the whole reply has no "Where the error is"', () => {
    show();
    type('Sample reply', JSON.stringify({ verdict: { biased: 'yes' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(screen.queryByLabelText(/Where the error is/)).toBeNull();
  });

  it('offers only recognized fields and no proposed rules', () => {
    withSample();
    expect(screen.queryByRole('group', { name: /Rule/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    const field = screen.getByLabelText(/Field of condition 1 of rule 1/) as HTMLSelectElement;
    expect([...field.options].map((o) => o.value)).toEqual(['claims[].text', 'claims[].verdict']);
  });

  it('refuses Add rule without a sample and says why', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(notes.join(' ')).toMatch(/sample reply/);
    expect(latest.evaluation.judge_set.error_rules).toEqual([]);
  });

  it('builds a rule with two conditions joined by "any of", then a second with "all of"', () => {
    withSample();
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    fireEvent.change(screen.getByLabelText(/Field of condition 1 of rule 1/), { target: { value: 'claims[].verdict' } });
    type(/Value of condition 1 of rule 1/, 'contradicted');
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    fireEvent.change(screen.getByLabelText(/Field of condition 2 of rule 1/), { target: { value: 'claims[].verdict' } });
    type(/Value of condition 2 of rule 1/, 'unsupported');
    fireEvent.change(screen.getByLabelText('Conditions of rule 1'), { target: { value: 'any' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    fireEvent.change(screen.getByLabelText('Conditions of rule 2'), { target: { value: 'all' } });
    const rules = latest.evaluation.judge_set.error_rules;
    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({ match: 'any' });
    expect(rules[0]!.conditions.map((c) => c.value)).toEqual(['contradicted', 'unsupported']);
    expect(rules[1]).toMatchObject({ match: 'all' });
  });

  it('hides the value box for "is empty" and removes conditions and rules', () => {
    withSample();
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    fireEvent.change(screen.getByLabelText(/Comparison of condition 1 of rule 1/), { target: { value: 'is_empty' } });
    expect(screen.queryByLabelText(/Value of condition 1 of rule 1/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Remove rule 1/ }));
    expect(latest.evaluation.judge_set.error_rules).toEqual([]);
  });

  it('the preview names the rule that makes each part a finding', () => {
    withSample();
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    fireEvent.change(screen.getByLabelText(/Field of condition 1 of rule 1/), { target: { value: 'claims[].verdict' } });
    type(/Value of condition 1 of rule 1/, 'contradicted');
    type('Name of rule 1', 'Bad claim');
    const preview = screen.getByRole('table', { name: 'Preview of the findings' });
    const rows = within(preview).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toMatch(/The hero is a doctor.*Finding.*Bad claim/);
    expect(rows[1]!.textContent).toMatch(/No finding/);
  });

  it('marks a rule broken when the new sample lacks its field, and warns about readability', () => {
    withSample();
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    fireEvent.change(screen.getByLabelText(/Field of condition 1 of rule 1/), { target: { value: 'claims[].verdict' } });
    type(/Value of condition 1 of rule 1/, 'contradicted');
    type('Sample reply', JSON.stringify({ items: [{ label: 'x' }] }));
    expect(screen.getByText(/Broken rule/)).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Readability' }).textContent).toMatch(/broken/);
    const field = screen.getByLabelText(/Field of condition 1 of rule 1/) as HTMLSelectElement;
    expect([...field.options].some((o) => /not in the sample reply/.test(o.textContent ?? ''))).toBe(true);
  });

  it('T226: the values seen are examples from the sample, and a rule may use any value', () => {
    withSample();
    expect(screen.getByText(/examples from your sample/i)).toBeTruthy();
    expect(screen.getByText(/can use any value/i)).toBeTruthy();
  });

  it('T227: beside the value box a line says that any value is kept as it is typed', () => {
    withSample();
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(screen.getAllByText(/Any value; it is kept as you type it/).length).toBeGreaterThan(0);
    type(/Value of condition 1 of rule 1/, 'aaa');
    expect((screen.getByLabelText(/Value of condition 1 of rule 1/) as HTMLInputElement).value).toBe('aaa');
    expect(latest.evaluation.judge_set.error_rules[0]!.conditions[0]!.value).toBe('aaa');
  });

  it("T227: the owner's steps (verdict equals aaa, text equals bbb, Add condition) show an unfinished condition, not a broken rule", () => {
    withSample();
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    fireEvent.change(screen.getByLabelText(/Field of condition 1 of rule 1/), { target: { value: 'claims[].verdict' } });
    type(/Value of condition 1 of rule 1/, 'aaa');
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    fireEvent.change(screen.getByLabelText(/Field of condition 2 of rule 1/), { target: { value: 'claims[].text' } });
    type(/Value of condition 2 of rule 1/, 'bbb');
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    expect(screen.queryByText(/Broken rule/)).toBeNull();
    const third = screen.getByLabelText(/Value of condition 3 of rule 1/).closest('.condition') as HTMLElement;
    expect(third.textContent).toContain('Condition 3: type a value');
    expect((screen.getByLabelText(/Value of condition 1 of rule 1/) as HTMLInputElement).value).toBe('aaa');
    expect((screen.getByLabelText(/Value of condition 2 of rule 1/) as HTMLInputElement).value).toBe('bbb');
    expect(screen.getByText(/Rule 1 is not used until every condition has a value/)).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Readability' }).textContent).toMatch(/not used|unfinished/i);
    type(/Value of condition 3 of rule 1/, 'ccc');
    expect(screen.queryByText(/Condition 3: type a value/)).toBeNull();
    expect(screen.queryByText(/is not used until/)).toBeNull();
  });

  it('T227: a rule with a field that is not in the sample is still "Broken rule"', () => {
    withSample();
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    type(/Value of condition 1 of rule 1/, 'x');
    type('Sample reply', JSON.stringify({ items: [{ label: 'x' }] }));
    expect(screen.getByText(/Broken rule/)).toBeTruthy();
  });

  it('warns when replies cannot be read automatically, with no sample and no rule', () => {
    show(accuracy());
    type('Sample reply', '');
    const warning = screen.getByRole('status', { name: 'Readability' });
    expect(warning.textContent).toMatch(/no sample reply/i);
    expect(warning.textContent).toMatch(/verification/);
  });

  it('shows no warning for a complete judge', () => {
    show(accuracy());
    expect(screen.queryByRole('status', { name: 'Readability' })).toBeNull();
  });
});

describe('the "what next" line (FR-001)', () => {
  const next = (state: AppState) => nextAction(state, 'judge');

  it('names what is still missing', () => {
    expect(next(createState()).sentence).toMatch(/prompt/);
    let state = latestFrom('{{a}}');
    expect(next(state).sentence).toMatch(/sample reply/);
    expect(next(state).sentence).toMatch(/rule/);
    state = latestFrom('no variables');
    expect(next(state).sentence).toMatch(/variable/);
    expect(next(state).action.disabled).toBe(true);
  });

  it('offers Next: Test cases once nothing is missing', () => {
    const state = accuracy();
    expect(next(state).action).toMatchObject({ label: 'Next: Test cases', go: 'cases' });
    expect(next(state).action.disabled).toBeFalsy();
  });

  it('says the prompt is fixed after finalizing', () => {
    const state: AppState = { ...createState(), evaluation: sampleEvaluation() };
    expect(next(state).sentence).toMatch(/fixed/);
  });

  function latestFrom(prompt: string): AppState {
    const s = createState();
    return { ...s, evaluation: { ...s.evaluation, judge_set: { ...s.evaluation.judge_set, prompt } } };
  }
});
