import { useState } from 'preact/hooks';
import { saveCaseFromJson, type CaseEdit } from '../../../app/actions/cases';
import type { AppState } from '../../../app/store';
import { checkCaseJson } from '../../../core/cases/case-json';
import { cleanCasePrompt } from '../../../core/generation/clean-case-prompt';
import { CopyButton } from '../../components/CopyButton';
import { JsonBox } from '../../components/JsonBox';
import { labels } from '../../labels';
import { CaseData } from './CaseData';
import { contextOf, Status } from './JsonCaseView';
import { TestCaseFrame } from './TestCaseFrame';

export interface CleanCaseViewProps {
  state: AppState;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
}

/** The clean case view (FR-083): the prompt for the user's LLM, the answer checked as it is pasted, then Approve and close. */
export function CleanCaseView({ state, onApply, onClose }: CleanCaseViewProps) {
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [like, setLike] = useState('');
  const [answer, setAnswer] = useState('');
  const { judge_set, dataset } = state.evaluation;
  const clean = dataset.cases.filter((c) => c.expected_errors.length === 0);
  const likeCase = clean.find((c) => c.id === like);
  const prompt = cleanCasePrompt(judge_set, comment, likeCase);
  const check = answer.trim() === '' ? undefined : checkCaseJson(answer, { ...contextOf(state), mode: 'clean', name });
  const valid = check?.case !== undefined;

  const approve = () => {
    const edit = saveCaseFromJson(state, answer, { mode: 'clean', name });
    onApply(edit);
    if (edit.state !== state) onClose();
  };

  return (
    <TestCaseFrame
      title={labels.cleanCase}
      dirty={name !== '' || comment !== '' || like !== '' || answer !== ''}
      onClose={onClose}
      headerExtra={
        <button type="button" class="primary" disabled={!valid} onClick={approve}>
          {labels.approveAndClose}
        </button>
      }
      left={
        <>
          <label class="field-label" for="clean-name">
            Name
          </label>
          <input id="clean-name" type="text" value={name} onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)} />
          <label class="field-label" for="clean-comment">
            Comment (optional)
          </label>
          <textarea id="clean-comment" rows={3} value={comment} onInput={(event) => setComment((event.currentTarget as HTMLTextAreaElement).value)} />
          <label class="field-label" for="clean-like">
            Like case (optional)
          </label>
          <select id="clean-like" value={like} onChange={(event) => setLike((event.currentTarget as HTMLSelectElement).value)}>
            <option value="">None</option>
            {clean.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || `Case ${c.id}`}
              </option>
            ))}
          </select>
          <label class="field-label" for="clean-prompt">
            Prompt for your LLM
          </label>
          <textarea id="clean-prompt" class="json" rows={12} readOnly value={prompt} />
          <CopyButton text={prompt} label={labels.copyPrompt} />
        </>
      }
      right={
        <>
          <JsonBox label="Answer of your LLM" value={answer} onChange={setAnswer} check={() => check?.problems ?? []} rows={10} />
          {check ? <Status check={check} /> : null}
          {check?.case ? <CaseData testCase={check.case} judged={judge_set.judged_text} /> : null}
        </>
      }
    />
  );
}
