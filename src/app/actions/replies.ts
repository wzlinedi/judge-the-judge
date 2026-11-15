// Entering the judge's replies one case at a time (FR-053, FR-056, FR-057, FR-059).
import { formatIfWholeJson } from '../../core/io/format-json';
import { composePrompt } from '../../core/judge/compose';
import { countingModeOf } from '../../core/judge/counting-mode';
import { judgeVersion } from '../../core/judge/version';
import type { Evaluation, Problem } from '../../core/model';
import { pastedReplySource } from '../../sources/pasted-reply';
import type { ReplyBatch } from '../../sources/types';
import type { Ports } from '../ports/types';
import { edit, recordReplySaved, type AppState } from '../store';

/** After this many replies not saved to a file, Run reminds the user to save (FR-059, SC-032). */
export const REMINDER_EVERY = 25;

export const reminderDue = (repliesSinceSave: number): boolean => repliesSinceSave >= REMINDER_EVERY;

/** Replacing a reply asks only when decisions were set by hand or approved from an opinion; it says how many (FR-056). */
export function replaceNeedsQuestion(evaluation: Evaluation, caseId: string): { ask: boolean; count: number } {
  const decisions = evaluation.decisions[caseId];
  if (!decisions) return { ask: false, count: 0 };
  const count = Object.keys(decisions.expected).length + Object.keys(decisions.additional).length + decisions.added_findings.length;
  return { ask: count > 0, count };
}

export interface AttachOptions {
  /** The judge version, recorded when the first reply arrives. */
  judgeVersion: string;
  /** The way of counting now, recorded with the first reply. */
  countedPer?: 'expected_error' | 'case';
  /** The user was asked about replacing replies that have decisions and said yes. */
  confirmReplace?: boolean;
}

export interface AttachResult {
  evaluation: Evaluation;
  saved: string[];
  unchanged: string[];
  needsConfirmation: Array<{ caseId: string; count: number }>;
  problems: Problem[];
}

/** Stores each reply with the prompt composed for its case; a replaced reply resets the case. */
export function attachReplies(evaluation: Evaluation, batch: ReplyBatch, options: AttachOptions): AttachResult {
  const result: AttachResult = { evaluation, saved: [], unchanged: [], needsConfirmation: [], problems: [...batch.problems] };
  if (!evaluation.dataset.finalized) {
    if (batch.items.length > 0) result.problems.push({ message: 'Finalize the test cases before entering replies.' });
    return result;
  }

  const replies = { ...evaluation.replies };
  const decisions = { ...evaluation.decisions };
  for (const item of batch.items) {
    const testCase = evaluation.dataset.cases.find((c) => c.id === item.case_id);
    if (!testCase) {
      result.problems.push({ message: `There is no test case ${item.case_id}.` });
      continue;
    }
    // a reply that is valid JSON is kept formatted (T292): the same data, other spaces
    const text = formatIfWholeJson(item.reply);
    const had = replies[item.case_id]?.reply;
    if (had !== undefined && formatIfWholeJson(had) === text) {
      result.unchanged.push(item.case_id);
      continue;
    }
    const question = replaceNeedsQuestion(evaluation, item.case_id);
    if (question.ask && !options.confirmReplace) {
      result.needsConfirmation.push({ caseId: item.case_id, count: question.count });
      continue;
    }
    replies[item.case_id] = { prompt: composePrompt(evaluation.judge_set.prompt, testCase).text, reply: text };
    delete decisions[item.case_id];
    result.saved.push(item.case_id);
  }

  if (result.saved.length === 0) return result;
  result.evaluation = {
    ...evaluation,
    replies,
    decisions,
    reply_judge_version: evaluation.reply_judge_version ?? options.judgeVersion,
    ...(evaluation.reply_counted_per !== undefined || options.countedPer !== undefined ? { reply_counted_per: evaluation.reply_counted_per ?? (options.countedPer as 'expected_error' | 'case') } : {}),
  };
  return result;
}

/**
 * Emptying the reply box of a saved reply removes the reply (T291): the case is "Not run" again, with no decisions and no added
 * findings. When the last reply goes, the run starts again from nothing, as when the last case with a reply is removed.
 */
export function removeReply(evaluation: Evaluation, caseId: string): Evaluation {
  if (evaluation.replies[caseId] === undefined) return evaluation;
  const { [caseId]: _reply, ...replies } = evaluation.replies;
  const { [caseId]: _decisions, ...decisions } = evaluation.decisions;
  if (Object.keys(replies).length > 0) return { ...evaluation, replies, decisions };
  const { reply_judge_version: _version, reply_counted_per: _counted, rules_corrected_after_replies: _rules, ...rest } = evaluation;
  return { ...rest, replies, decisions };
}

export type ReplyStatus = 'saved' | 'unchanged' | 'empty' | 'refused' | 'clipboard_blocked' | 'needs_confirmation';

export interface ReplyOutcome {
  state: AppState;
  status: ReplyStatus;
  /** Said to the user when there is something to say. */
  message?: string;
  /** How many decisions replacing the reply would remove, when the user must be asked. */
  replaces?: number;
  /** The text that was read from the clipboard, so the question can be answered without reading it again. */
  text?: string;
}

/** "Save reply": the text of the box becomes the reply of the case. */
export async function saveReply(state: AppState, caseId: string, text: string, options: { confirmed?: boolean } = {}): Promise<ReplyOutcome> {
  const batch = await pastedReplySource.collect({ caseId, text });
  if (batch.items.length === 0) return { state, status: 'empty', message: batch.problems[0]?.message ?? 'The reply is empty.' };

  const version = await judgeVersion(state.evaluation.judge_set);
  const attached = attachReplies(state.evaluation, batch, {
    judgeVersion: version,
    countedPer: countingModeOf(state.evaluation.judge_set) === 'per_case' ? 'case' : 'expected_error',
    confirmReplace: options.confirmed === true,
  });
  const [first] = attached.needsConfirmation;
  if (first) {
    return {
      state,
      status: 'needs_confirmation',
      replaces: first.count,
      text,
      message: `Replacing this reply removes ${first.count} ${first.count === 1 ? 'decision' : 'decisions'} you made. The case is marked again from the new reply.`,
    };
  }
  if (attached.saved.length === 0) {
    if (attached.unchanged.length > 0) return { state, status: 'unchanged', message: 'This is the reply already saved. Nothing changed.' };
    return { state, status: 'refused', message: attached.problems[0]?.message ?? 'The reply was not saved.' };
  }
  const next = recordReplySaved({ ...state, evaluation: attached.evaluation });
  return { state: next, status: 'saved' };
}

/** "Paste reply from clipboard": reads the clipboard and saves the reply in one action (FR-056). */
export async function pasteReplyFromClipboard(state: AppState, caseId: string, ports: Ports, options: { confirmed?: boolean } = {}): Promise<ReplyOutcome> {
  const read = await ports.clipboard.readText();
  if (read.status === 'empty') return { state, status: 'empty', message: 'The clipboard is empty. Copy the judge’s reply first, then press the button again.' };
  if (read.status === 'refused') {
    return { state, status: 'clipboard_blocked', message: 'The browser did not let the page read the clipboard. Paste the reply into the box with Ctrl+V and press Save reply.' };
  }
  if (read.status === 'not_available') {
    return { state, status: 'clipboard_blocked', message: 'This browser cannot read the clipboard for the page. Paste the reply into the box with Ctrl+V and press Save reply.' };
  }
  return saveReply(state, caseId, read.text, options);
}

/** The model details are free text; the tool does not read them (FR-058). */
export function modelDetailsEdit(state: AppState, text: string): AppState {
  return edit(state, (e) => ({ ...e, model_note: text }));
}
