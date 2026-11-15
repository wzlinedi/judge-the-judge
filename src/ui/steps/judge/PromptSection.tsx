import { useEffect, useId, useState } from 'preact/hooks';
import { setJudgedText, setPrompt, type JudgeEdit } from '../../../app/actions/judge';
import { promptLocked, type AppState } from '../../../app/store';
import { findVariables } from '../../../core/judge/variables';
import { judgeVersion } from '../../../core/judge/version';
import { Explain } from '../../components/Explain';

export interface SectionProps {
  state: AppState;
  onEdit: (result: JudgeEdit) => void;
}

/** The judge prompt, its variables, the judged text and the judge version (FR-010). Read as it changes: no button. */
export function PromptSection({ state, onEdit }: SectionProps) {
  const id = useId();
  const set = state.project.judge_set;
  const locked = promptLocked(state);
  const variables = findVariables(set.prompt);
  const [version, setVersion] = useState('');

  useEffect(() => {
    let current = true;
    if (set.prompt.trim() === '') setVersion('');
    else void judgeVersion(set).then((v) => current && setVersion(v));
    return () => {
      current = false;
    };
  }, [set]);

  return (
    <section class="card" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>Prompt and variables</h2>
      <label for={`${id}-prompt`} class="field-label">
        Judge prompt
      </label>
      <textarea
        id={`${id}-prompt`}
        rows={10}
        value={set.prompt}
        readOnly={locked}
        spellcheck={false}
        onInput={(event) => onEdit(setPrompt(state, (event.currentTarget as HTMLTextAreaElement).value))}
      />
      {locked ? <p class="muted">The test run has started, so the prompt is fixed. To test another prompt, load the test project with “Load the test project only”.</p> : null}
      {version ? <p class="muted">{`Judge version: ${version}`}</p> : null}
      {set.prompt.trim() !== '' && variables.length === 0 ? <p class="muted">Nothing from the test cases will reach the prompt.</p> : null}
      {variables.length > 0 ? (
        <fieldset class="variables" disabled={locked}>
          <legend>
            Judged text <Explain>The judged text is the output the judge evaluates. Errors are injected into it.</Explain>
          </legend>
          <ul aria-label="Variables" class="plain-list">
            {variables.map((name) => (
              <li key={name}>
                <label class="inline-check">
                  <input type="radio" name={`${id}-judged`} checked={set.judged_text === name} onChange={() => onEdit(setJudgedText(state, name))} />
                  <code>{`{{${name}}}`}</code>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
    </section>
  );
}
