import { useState } from 'preact/hooks';
import type { CaseEdit } from '../../../app/actions/cases';
import { injectPrompt, newDraft, type InjectDraft } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import { checkCaseJson } from '../../../core/cases/case-json';
import { AnswerBox, contextOf, ExpectedErrorsPart, NameField, Part, typedNameOf, type TypedName } from './CaseParts';
import { InjectParts } from './InjectParts';
import { SaveCaseButton } from './SaveCaseButton';
import { TestCaseFrame } from './TestCaseFrame';
import { labels } from '../../labels';

export interface InjectWindowProps {
  state: AppState;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
}

/** "Case with injected errors" (FR-040, FR-041, FR-085): the five parts follow one another on one page; Save case is at the bottom. */
export function InjectWindow({ state, onApply, onClose }: InjectWindowProps) {
  const [draft, setDraft] = useState<InjectDraft>(() => newDraft(state));
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [typed, setTyped] = useState<TypedName>(null);
  const first = newDraft(state);
  const changed = touched || typed !== null || draft.base !== '' || draft.instructions !== '' || draft.rows.length !== first.rows.length || draft.rows.some((r, i) => r.description !== '' || r.difficulty !== 'llm' || r.category !== first.rows[i]?.category);
  const check = text.trim() === '' ? undefined : checkCaseJson(text, { ...contextOf(state), mode: 'inject', ...(draft.base !== '' ? { base: draft.base } : {}), errorsToPrepare: draft.rows.length, ...(typedNameOf(typed) !== undefined ? { name: typedNameOf(typed) as string } : {}) });

  return (
    <TestCaseFrame
      title={labels.caseWithInjectedErrors}
      dirty={changed || text !== ''}
      onClose={onClose}
      headerAction={<SaveCaseButton state={state} text={text} mode="inject" {...(draft.base !== '' ? { base: draft.base } : {})} errorsToPrepare={draft.rows.length} generationPrompt={injectPrompt(state, draft)} {...(typedNameOf(typed) !== undefined ? { name: typedNameOf(typed) as string } : {})} check={check} emptyReason="Paste the answer of your LLM to save." onApply={onApply} onClose={onClose} />}
    >
      <InjectParts
        state={state}
        nameField={<NameField state={state} check={check} typed={typed} onTyped={setTyped} />}
        draft={draft}
        onDraft={(next) => {
          setTouched(true);
          setDraft(next);
        }}
      />
      <Part number={4} title="Paste its answer">
        <p class="muted">Paste what your LLM returned into the box. It is checked as you paste it. To change anything, change the JSON in the box.</p>
        <AnswerBox label="Case JSON" value={text} onChange={setText} check={check} rows={14} state={state} hideCleanKind />
      </Part>
      <Part number={5} title="Expected errors">
        <ExpectedErrorsPart state={state} text={text} check={check} />
      </Part>
    </TestCaseFrame>
  );
}
