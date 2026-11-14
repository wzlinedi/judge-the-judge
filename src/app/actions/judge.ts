// The actions of the Judge step (FR-009 to FR-014, FR-019, FR-053, FR-088). Every action returns the next
// state and, when there is something to tell the user, one plain sentence. Refused actions return the same state.
import { ruleList } from '../../core/judge/findings';
import { proposeFindingText, recognizeFields, validFindingTextField, type RecognizedFields } from '../../core/judge/fields';
import { findVariables, proposeJudgedText } from '../../core/judge/variables';
import type { Condition, ErrorRule, JudgeSet, ReplyMapping } from '../../core/model';
import { edit, promptLocked, type AppState } from '../store';

export interface JudgeEdit {
  state: AppState;
  note?: string;
}

const refuse = (state: AppState, note: string): JudgeEdit => ({ state, note });
const FIXED = 'The judge prompt is fixed once the test cases are finalized. Use "Reopen test cases" to change it.';

function withJudgeSet(state: AppState, change: (set: JudgeSet) => JudgeSet): AppState {
  return edit(state, (e) => ({ ...e, judge_set: change(e.judge_set) }));
}

/** The fields of the sample reply, or null while there is no readable sample. */
function recognized(set: JudgeSet): RecognizedFields | null {
  if (set.sample_reply === undefined || set.sample_reply.trim() === '') return null;
  const result = recognizeFields(set.sample_reply);
  return result.ok ? result : null;
}

export function setPrompt(state: AppState, prompt: string): JudgeEdit {
  if (promptLocked(state)) return refuse(state, FIXED);
  const set = state.evaluation.judge_set;
  const proposal = proposeJudgedText(findVariables(prompt), set.judged_text);
  const next = withJudgeSet(state, (s) => {
    const { judged_text: _old, ...rest } = s;
    return { ...rest, prompt, ...(proposal.name !== undefined ? { judged_text: proposal.name } : {}) };
  });
  return proposal.note ? { state: next, note: proposal.note } : { state: next };
}

export function setJudgedText(state: AppState, name: string): JudgeEdit {
  if (promptLocked(state)) return refuse(state, FIXED);
  if (!findVariables(state.evaluation.judge_set.prompt).includes(name)) {
    return refuse(state, `"${name}" is not a variable of the prompt.`);
  }
  return { state: withJudgeSet(state, (s) => ({ ...s, judged_text: name })) };
}

/** Keeps the mapping the user chose while its list and field exist, proposes one for new lists, never touches it for an unreadable sample. */
function remap(mapping: ReplyMapping, fields: RecognizedFields): ReplyMapping {
  const proposals = proposeFindingText(fields);
  const finding_text: Record<string, string> = {};
  for (const list of fields.lists) {
    const current = mapping.finding_text[list];
    const chosen = current !== undefined && validFindingTextField(fields, list, current) ? current : proposals[list];
    if (chosen !== undefined) finding_text[list] = chosen;
  }
  return { finding_text };
}

export function setSampleReply(state: AppState, text: string): JudgeEdit {
  return {
    state: withJudgeSet(state, (s) => {
      const { sample_reply: _old, ...rest } = s;
      if (text.trim() === '') return rest;
      const read = recognizeFields(text);
      if (!read.ok) return { ...rest, sample_reply: text, reply_mapping: s.reply_mapping };
      const error_rules = s.error_rules.map((rule) => {
        const list = ruleList(rule);
        if (rule.finding_text === undefined || (list !== undefined && validFindingTextField(read, list, rule.finding_text))) return rule;
        const { finding_text: _gone, ...kept } = rule;
        return kept;
      });
      return { ...rest, sample_reply: text, reply_mapping: remap(s.reply_mapping, read), error_rules };
    }),
  };
}

/**
 * "Where the error is" of a rule (T232): the text field of the list item that shows where the error is.
 * The field the reply mapping proposes for the list is the default and is not stored in the rule;
 * choosing it again removes the rule's own field.
 */
export function setRuleWhere(state: AppState, ruleIndex: number, field: string): JudgeEdit {
  const set = state.evaluation.judge_set;
  const rule = set.error_rules[ruleIndex];
  const list = rule ? ruleList(rule) : undefined;
  const fields = recognized(set);
  if (!rule || list === undefined) return refuse(state, 'This rule is about the whole reply, so there is no place in it to point at.');
  if (!fields || !validFindingTextField(fields, list, field)) return refuse(state, `${field} is not a text field of the items of ${list}.`);
  const isDefault = set.reply_mapping.finding_text[list] === field;
  return {
    state: changeRule(state, ruleIndex, (r) => {
      const { finding_text: _own, ...rest } = r;
      return isDefault ? rest : { ...rest, finding_text: field };
    }),
  };
}

const NO_SAMPLE = 'Paste a sample reply first: a rule can only use the fields the sample reply contains.';

function newRuleName(rules: readonly ErrorRule[]): string {
  let n = rules.length + 1;
  while (rules.some((r) => r.name === `Rule ${n}`)) n++;
  return `Rule ${n}`;
}

export function addRule(state: AppState): JudgeEdit {
  const fields = recognized(state.evaluation.judge_set);
  const first = fields?.fields[0];
  if (!fields || !first) return refuse(state, NO_SAMPLE);
  const rule: ErrorRule = {
    name: newRuleName(state.evaluation.judge_set.error_rules),
    match: 'any',
    conditions: [{ field: first.path, comparison: 'equals', value: '' }],
  };
  return { state: withJudgeSet(state, (s) => ({ ...s, error_rules: [...s.error_rules, rule] })) };
}

function changeRule(state: AppState, index: number, change: (rule: ErrorRule) => ErrorRule): AppState {
  return withJudgeSet(state, (s) => ({ ...s, error_rules: s.error_rules.map((r, i) => (i === index ? change(r) : r)) }));
}

export function updateRule(state: AppState, index: number, patch: Partial<Pick<ErrorRule, 'name' | 'match'>>): JudgeEdit {
  return { state: changeRule(state, index, (r) => ({ ...r, ...patch })) };
}

export function removeRule(state: AppState, index: number): JudgeEdit {
  return { state: withJudgeSet(state, (s) => ({ ...s, error_rules: s.error_rules.filter((_, i) => i !== index) })) };
}

export function addCondition(state: AppState, ruleIndex: number): JudgeEdit {
  const fields = recognized(state.evaluation.judge_set);
  const first = fields?.fields[0];
  if (!fields || !first) return refuse(state, NO_SAMPLE);
  return { state: changeRule(state, ruleIndex, (r) => ({ ...r, conditions: [...r.conditions, { field: first.path, comparison: 'equals', value: '' }] })) };
}

export function updateCondition(state: AppState, ruleIndex: number, conditionIndex: number, patch: Partial<Condition>): JudgeEdit {
  if (patch.field !== undefined) {
    const fields = recognized(state.evaluation.judge_set);
    if (!fields || !fields.fields.some((f) => f.path === patch.field)) {
      return refuse(state, `The sample reply has no field ${patch.field}. Only fields of the sample reply can be used.`);
    }
  }
  const fieldsNow = recognized(state.evaluation.judge_set);
  return {
    state: changeRule(state, ruleIndex, (r) => {
      const changed = {
        ...r,
        conditions: r.conditions.map((c, i) => {
          if (i !== conditionIndex) return c;
          const merged = { ...c, ...patch };
          if (merged.comparison === 'is_empty' || merged.comparison === 'is_not_empty') delete merged.value;
          else merged.value ??= '';
          return merged;
        }),
      };
      // the rule's own "Where the error is" belongs to its list: a rule moved to another list loses it
      const list = ruleList(changed);
      if (changed.finding_text !== undefined && (list === undefined || (fieldsNow !== null && !validFindingTextField(fieldsNow, list, changed.finding_text)))) {
        const { finding_text: _gone, ...rest } = changed;
        return rest;
      }
      return changed;
    }),
  };
}

export function removeCondition(state: AppState, ruleIndex: number, conditionIndex: number): JudgeEdit {
  return { state: changeRule(state, ruleIndex, (r) => ({ ...r, conditions: r.conditions.filter((_, i) => i !== conditionIndex) })) };
}
