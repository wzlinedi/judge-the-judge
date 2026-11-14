// The error catalog of the test project (FR-015, FR-016, FR-024). The tool never adds, renames or removes
// a category by itself: every function here is called for one action of the user.
import type { Category, Reply, TestCase } from '../model';

/** Lower case with dashes. */
export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
}

export interface CategoryEntry {
  name: string;
  description?: string;
}

/** One category per line, optionally `name - description`, `name: description` or `name | description`. */
export function parseCategoryList(text: string): CategoryEntry[] {
  const entries: CategoryEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    const found = [line.indexOf(' - '), line.indexOf(':'), line.indexOf('|')].filter((i) => i > 0);
    const at = found.length === 0 ? -1 : Math.min(...found);
    const rest = at === -1 ? '' : line.slice(at).replace(/^\s*-\s|^[:|]/, '').trim();
    const name = normalizeCategoryName(at === -1 ? line : line.slice(0, at));
    if (name === '') continue;
    entries.push(rest === '' ? { name } : { name, description: rest });
  }
  return entries;
}

export interface AddResult {
  catalog: Category[];
  added: string[];
  /** Names that were already in the catalog (or twice in the list), reported to the user. */
  skipped: string[];
}

export function addCategories(catalog: readonly Category[], entries: readonly CategoryEntry[]): AddResult {
  const next = [...catalog];
  const added: string[] = [];
  const skipped: string[] = [];
  for (const entry of entries) {
    const name = normalizeCategoryName(entry.name);
    if (name === '') continue;
    if (next.some((c) => c.name === name)) {
      skipped.push(name);
      continue;
    }
    next.push({ name, ...(entry.description ? { description: entry.description } : {}) });
    added.push(name);
  }
  return { catalog: next, added, skipped };
}

/** The number of test cases that use a category; a case counts once however many of its errors have it. */
export function categoryUses(cases: readonly TestCase[], name: string): number {
  return cases.filter((c) => c.expected_errors.some((e) => e.category === name)).length;
}

export type RemoveCheck = { allowed: true } | { allowed: false; reason: string };

export function canRemoveCategory(_catalog: readonly Category[], cases: readonly TestCase[], replies: Readonly<Record<string, Reply>>, finalized: boolean, name: string): RemoveCheck {
  const users = cases.filter((c) => c.expected_errors.some((e) => e.category === name));
  if (users.length === 0) return { allowed: true };
  const used = `Used by ${users.length} test ${users.length === 1 ? 'case' : 'cases'}.`;
  if (finalized && users.every((c) => replies[c.id] !== undefined)) return { allowed: false, reason: `${used} It can be renamed.` };
  const those = users.length === 1 ? 'that test case' : 'those test cases';
  return { allowed: false, reason: `${used} Remove ${those} first, or rename the category.` };
}

export type RenameResult = { ok: true; catalog: Category[]; cases: TestCase[] } | { ok: false; reason: string };

/** A rename applies to every expected error that uses the category. A name already in the catalog is refused. */
export function renameCategory(catalog: readonly Category[], cases: readonly TestCase[], from: string, to: string): RenameResult {
  const name = normalizeCategoryName(to);
  if (name === '') return { ok: false, reason: 'The new name is empty.' };
  if (!catalog.some((c) => c.name === from)) return { ok: false, reason: `There is no category "${from}".` };
  if (name !== from && catalog.some((c) => c.name === name)) return { ok: false, reason: `The category "${name}" is already in the catalog.` };
  return {
    ok: true,
    catalog: catalog.map((c) => (c.name === from ? { ...c, name } : c)),
    cases: cases.map((c) => (c.expected_errors.some((e) => e.category === from) ? { ...c, expected_errors: c.expected_errors.map((e) => (e.category === from ? { ...e, category: name } : e)) } : c)),
  };
}
