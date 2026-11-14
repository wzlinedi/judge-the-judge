import { useRef } from 'preact/hooks';
import type { TestCase } from '../../../core/model';
import { applyMarks } from '../case-window/marks';

type Shown = Omit<TestCase, 'id'> & { id?: string };

/** A case read-only: its fields, with the fragments of the expected errors highlighted and numbered in the judged text. */
export function CaseData({ testCase, judged }: { testCase: Shown; judged: string | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const asCase = { ...testCase, id: testCase.id ?? 'new' } as TestCase;
  return (
    <div ref={ref} class="case-data">
      <p>
        <span class="muted">Kind: </span>
        <strong>{testCase.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}</strong>
        {testCase.base ? <span class="muted">{` · Base: ${testCase.base}`}</span> : null}
      </p>
      {Object.entries(testCase.fields).map(([name, text]) => (
        <section key={name} class="field-block">
          <h3>
            {name}
            {name === judged ? ' (judged text)' : ''}
          </h3>
          <p class="field-text">
            {(name === judged ? applyMarks(text, asCase, null) : [{ text }]).map((segment, i) =>
              'error' in segment && segment.error ? (
                <mark key={i} class="fragment" data-error={segment.error.id} tabIndex={-1}>
                  <sup>{segment.error.label}</sup>
                  {segment.text}
                </mark>
              ) : (
                <span key={i}>{segment.text}</span>
              ),
            )}
          </p>
        </section>
      ))}
    </div>
  );
}

/** The expected errors of a case as a list: number, category, difficulty, fragment, description. */
export function ErrorList({ testCase }: { testCase: Shown }) {
  if (testCase.expected_errors.length === 0) return <p class="muted">This case has no expected errors.</p>;
  return (
    <ol class="plain-list" aria-label="Expected errors">
      {testCase.expected_errors.map((error, i) => (
        <li key={i} class="decide-item">
          <strong>{`E${i + 1}`}</strong>
          <span class="muted">{` ${[error.category ?? 'no category', error.difficulty ?? 'no difficulty'].join(' · ')}`}</span>
          {error.fragment ? <p class="item-fragment">{`“${error.fragment}”`}</p> : <p class="item-fragment muted">No fragment</p>}
          <p class="source">{error.description}</p>
        </li>
      ))}
    </ol>
  );
}
