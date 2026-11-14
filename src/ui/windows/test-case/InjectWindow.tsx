import { useState } from 'preact/hooks';
import type { CaseEdit } from '../../../app/actions/cases';
import { newDraft, type InjectDraft } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import { checkCaseJson } from '../../../core/cases/case-json';
import { contextOf, JsonCaseView } from './JsonCaseView';
import { InjectPrepare } from './InjectPrepare';

export interface InjectWindowProps {
  state: AppState;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
}

/** "Case with injected errors" (FR-040, FR-041, FR-085): part 1 prepares the prompt, parts 2 and 3 are the JSON view. */
export function InjectWindow({ state, onApply, onClose }: InjectWindowProps) {
  const [draft, setDraft] = useState<InjectDraft>(() => newDraft(state));
  const [text, setText] = useState('');
  const [part, setPart] = useState<1 | 2>(1);
  const [touched, setTouched] = useState(false);
  const first = newDraft(state);
  const changed = touched || draft.base !== '' || draft.instructions !== '' || draft.rows.length !== first.rows.length || draft.rows.some((r, i) => r.description !== '' || r.difficulty !== 'llm' || r.category !== first.rows[i]?.category);

  if (part === 2) {
    return (
      <JsonCaseView
        state={state}
        mode="inject"
        initialText={text}
        onTextChange={setText}
        base={draft.base}
        errorsToPrepare={draft.rows.length}
        onBack={() => setPart(1)}
        touched={changed}
        onApply={onApply}
        onClose={onClose}
      />
    );
  }
  const check = text.trim() === '' ? undefined : checkCaseJson(text, { ...contextOf(state), mode: 'inject', ...(draft.base !== '' ? { base: draft.base } : {}), errorsToPrepare: draft.rows.length });
  return (
    <InjectPrepare
      state={state}
      draft={draft}
      onDraft={(next) => {
        setTouched(true);
        setDraft(next);
      }}
      onNext={() => setPart(2)}
      text={text}
      check={check}
      dirty={changed || text !== ''}
      onApply={onApply}
      onClose={onClose}
    />
  );
}
