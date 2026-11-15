import { useState } from 'preact/hooks';
import { saveCaseFromJson, type CaseEdit } from '../../../app/actions/cases';
import type { AppState } from '../../../app/store';
import { checkCaseJson } from '../../../core/cases/case-json';
import { cleanCasePrompt } from '../../../core/generation/clean-case-prompt';
import { JsonBox } from '../../components/JsonBox';
import { labels } from '../../labels';
import { CaseData } from './CaseData';
import { contextOf, NameField, Part, Status, typedNameOf, type TypedName } from './CaseParts';
import { PromptEditor } from './PromptEditor';
import { TestCaseFrame } from './TestCaseFrame';

export interface CleanCaseViewProps {
  state: AppState;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
}

/** The clean case view (FR-083): the prompt for the user's LLM, the answer checked as it is pasted, then Save case. */
export function CleanCaseView({ state, onApply, onClose }: CleanCaseViewProps) {
  const [typed, setTyped] = useState<TypedName>(null);
  const name = typedNameOf(typed) ?? '';
  const [like, setLike] = useState('');
  const [answer, setAnswer] = useState('');
  /** The prompt as the user edited it (T262); undefined while it follows Like case. */
  const [edited, setEdited] = useState<string | undefined>(undefined);
  const { judge_set, dataset } = state.evaluation;
  const clean = dataset.cases.filter((c) => c.expected_errors.length === 0);
  const likeCase = clean.find((c) => c.id === like);
  const built = cleanCasePrompt(judge_set, likeCase);
  const prompt = edited ?? built;
  const check = answer.trim() === '' ? undefined : checkCaseJson(answer, { ...contextOf(state), mode: 'clean', name });
  const valid = check?.case !== undefined;

  const approve = () => {
    const edit = saveCaseFromJson(state, answer, { mode: 'clean', name, generationPrompt: prompt });
    onApply(edit);
    if (edit.state !== state) onClose();
  };

  return (
    <TestCaseFrame
      title={labels.cleanCase}
      dirty={typed !== null || like !== '' || answer !== '' || edited !== undefined}
      onClose={onClose}
      headerAction={
        <>
          <button type="button" class="primary" disabled={!valid} aria-describedby={valid ? undefined : 'clean-approve-why'} onClick={approve}>
            {labels.saveCase}
          </button>
          {valid ? null : (
            <span id="clean-approve-why" class="why-disabled">
              {check ? 'Fix the problems listed under the answer to approve.' : 'Paste the answer of your LLM to approve.'}
            </span>
          )}
        </>
      }
    >
      <Part number={1} title="About the case">
        <div class="form-grid">
          <NameField state={state} check={check} typed={typed} onTyped={setTyped} />
          <label class="field-label" for="clean-like">
            Like case (optional)
          </label>
          <div>
            <select id="clean-like" value={like} onChange={(event) => setLike((event.currentTarget as HTMLSelectElement).value)}>
              <option value="">None</option>
              {clean.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || `Case ${c.id}`}
                </option>
              ))}
            </select>
            <p class="muted">The prompt shows your LLM the texts of this case as an example, so that the new case has the same kind of text.</p>
          </div>
        </div>
      </Part>
      <Part number={2} title="Ask your LLM">
        <PromptEditor id="clean-prompt" rows={12} built={built} edited={edited} onEdit={setEdited} />
      </Part>
      <Part number={3} title="Paste its answer">
        <JsonBox label="Answer of your LLM" value={answer} onChange={setAnswer} check={() => check?.problems ?? []} rows={10} />
        {check ? <Status check={check} /> : null}
        {check?.case ? <CaseData testCase={check.case} judged={judge_set.judged_text} /> : null}
      </Part>
    </TestCaseFrame>
  );
}
