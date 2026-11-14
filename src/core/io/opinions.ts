// Reading the opinion of the user's LLM for one case (contracts/file-formats.md, section 7; FR-063, FR-084).
import { extractJson } from '../judge/extract-json';
import type { Difficulty, Problem, ReadResult, VerificationOpinion } from '../model';

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

/** The one opinion in the text: the wrapped object, the bare object, or a list with exactly one of them. */
function pickOne(root: unknown): { ok: true; item: Obj } | { ok: false; problem: Problem } {
  let list: unknown[] | undefined;
  if (Array.isArray(root)) list = root;
  else if (isObject(root) && Array.isArray(root['opinions'])) list = root['opinions'];
  if (list) {
    if (list.length > 1) return { ok: false, problem: { message: `The answer holds ${list.length} opinions. An opinion is asked for one case at a time; paste the opinion of this case only.` } };
    if (list.length === 0) return { ok: false, problem: { message: 'The list of opinions is empty.' } };
    root = list[0];
  }
  if (isObject(root) && isObject(root['opinion'])) root = root['opinion'];
  if (!isObject(root)) return { ok: false, problem: { message: 'The opinion must be a JSON object with an id, expected, additional and new.' } };
  return { ok: true, item: root };
}

export function readOpinion(text: string, caseId: string): ReadResult<VerificationOpinion> {
  const found = extractJson(text);
  if (!found.ok) {
    const problem: Problem = { message: found.message };
    if (found.line !== undefined) problem.line = found.line;
    if (found.column !== undefined) problem.column = found.column;
    return { ok: false, problems: [problem] };
  }
  const picked = pickOne(found.value);
  if (!picked.ok) return { ok: false, problems: [picked.problem] };
  const item = picked.item;

  const rawId = item['id'];
  if (typeof rawId !== 'string' && typeof rawId !== 'number') {
    return { ok: false, problems: [{ message: 'The opinion has no id, so it cannot be matched to a case.', path: 'opinion.id' }] };
  }
  const id = String(rawId);
  if (id !== caseId) {
    return { ok: false, problems: [{ message: `This opinion is for case ${id}, but this is case ${caseId}. Nothing changed.`, path: 'opinion.id' }] };
  }

  const problems: Problem[] = [];
  const notes: string[] = [];
  const list = (key: string): unknown[] => (Array.isArray(item[key]) ? (item[key] as unknown[]) : []);
  const reasonAndFragment = (e: Obj) => ({ ...(str(e['reason']) ? { reason: str(e['reason']) as string } : {}), ...(str(e['fragment']) ? { fragment: str(e['fragment']) as string } : {}) });

  const expected: VerificationOpinion['expected'] = [];
  list('expected').forEach((raw, i) => {
    if (!isObject(raw) || !positive(raw['index'])) {
      notes.push(`Entry ${i + 1} of "expected" has no valid index, so it was left out.`);
      return;
    }
    expected.push({ index: raw['index'], ...(typeof raw['found'] === 'boolean' ? { found: raw['found'] } : {}), ...reasonAndFragment(raw) });
  });

  const added: VerificationOpinion['new'] = [];
  const newFinding = (raw: Obj, where: string): void => {
    const text = str(raw['text']);
    if (text === undefined) problems.push({ message: 'A new finding needs its text.', path: `${where}.text` });
    if (typeof raw['real'] !== 'boolean') problems.push({ message: 'A new finding needs "real": true or false.', path: `${where}.real` });
    if (text === undefined || typeof raw['real'] !== 'boolean') return;
    const difficulty = raw['difficulty'];
    const valid = difficulty === 'obvious' || difficulty === 'subtle';
    if (difficulty !== undefined && !valid) notes.push(`The difficulty "${String(difficulty)}" of a new finding is not obvious or subtle, so it was left out.`);
    added.push({
      text,
      real: raw['real'],
      ...reasonAndFragment(raw),
      ...(str(raw['category']) ? { category: (str(raw['category']) as string).trim() } : {}),
      ...(valid ? { difficulty: difficulty as Difficulty } : {}),
    });
  };

  const additional: VerificationOpinion['additional'] = [];
  list('additional').forEach((raw, i) => {
    if (!isObject(raw)) {
      notes.push(`Entry ${i + 1} of "additional" is not an object, so it was left out.`);
      return;
    }
    if (positive(raw['index'])) {
      additional.push({ index: raw['index'], ...(typeof raw['real'] === 'boolean' ? { real: raw['real'] } : {}), ...reasonAndFragment(raw) });
    } else if (str(raw['text']) !== undefined) {
      newFinding(raw, `additional[${i + 1}]`); // a finding with text and no valid index is a new finding
    } else {
      notes.push(`Entry ${i + 1} of "additional" has neither a valid index nor a text, so it was left out.`);
    }
  });
  list('new').forEach((raw, i) => {
    if (isObject(raw)) newFinding(raw, `new[${i + 1}]`);
    else problems.push({ message: 'A new finding must be an object with text and real.', path: `new[${i + 1}]` });
  });

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: { id, expected, additional, new: added }, notes };
}
