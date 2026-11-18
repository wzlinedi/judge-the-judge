# Lessons learned

Judge the Judge, feature `specs/001-judge-evaluation-workflow`, from 2026-11-10 to 2026-11-17.

This review is based on the git history (121 commits), the 37 phases of `tasks.md`, the 187 clarifications in `spec.md`, the history of the constitution, and the files that changed most often. Every number below comes from git or from a search of the documents. Nothing here is an estimate.

## The numbers

| What | Value |
|---|---|
| Commits | 121. The first 6 are the specification, written before any code. |
| Planned phases 1 to 18 (the main features) | 17 commits in about one day, +21.9k lines in `src` and `tests` |
| Everything after the planned phases | about 100 commits, +16.9k and −6.8k lines |
| Tasks | 479: about 207 planned and 272 added later (57%) |
| Clarifications | 187. Main sources: prototypes v7 to v15 (51), owner review (43), owner trial (12), the two redesigns (11 + 6), code review (10), security review (3) |
| Files changed most often | `tasks.md` 98, `spec.md` 51, `contracts/ui-flow.md` 44, `components.css` 41, `CaseWindow.tsx` 30, `App.tsx` 28, `labels.ts` 20 |
| Constitution | 6 amendments, from v1.5.0 to v3.2.0 |
| Size of the specification | about 960 KB, of which `tasks.md` is 455 KB and `spec.md` 281 KB |

The main point: the planned build was fast. Most of the work came after the tool was running and people could use it.

## What caused the most changes

1. **The owner saw the working tool only after all 18 phases were built.** The owner reviews and trials of 2026-11-14 to 2026-11-16 gave about 62 commits and 55 clarifications. The prototypes v7 to v15 caught a lot, but not how it feels to work on real data: the layout of the case window, the names, the order of the steps. `CaseWindow.tsx` changed 30 times.
2. **The data model changed halfway.** Two files (the test project and the evaluation) became one test project file, and "finalize" became "Start test run" (Phase 22, 20 tasks). The change reached the data model, the file formats, `App.tsx`, the labels and the e2e tests.
3. **Features were built and then removed or reversed:**
   - removed: Compare, Clone, Show JSON, Approve, Note, Export JSON, the check rules file, Load catalog and Export catalog;
   - added and removed the next day: Recreate;
   - added and reversed: moving a Genuine error into the expected errors (T253);
   - removed and later brought back in another form: Save reply.
4. **The look changed three times.** First black and red (prototype v11), then stone and forest green (the redesign of 2026-11-16), and one day later the Editorial look. This explains the 41 changes of `components.css` and the changes of assertions in `tokens.test.ts` that the owner had to approve.
5. **Names changed.** "Real error" became "Genuine error", "final answer" became "reliable answer", the menu "File" became "More", and "Judge reply and errors" became "Verify the judge reply". `labels.ts` changed 20 times. At the end the Help still had 3 false sentences about names.
6. **The target of the product was decided last.** The hardening (Phase 25, 39 tasks, and the new principle IX of the constitution) and Phase 34 were production-grade work: compatibility with older files, the 50 MB limit, the depth of JSON, `__proto__` keys. On 2026-11-17 the owner decided that the tool is a demo, and part of that work was then not needed. This is the clearest example of a decision to make at the start.
7. **The weight of the process.** There were 8 Convergence phases (64 tasks) only to catch up with the drift between the specification and the code. The documents keep their history instead of only the current state.

## What worked well

- **Test-first and the gates.** At the end: 1,875 unit tests and 232 e2e tests (Chrome and Edge). Every fix has a test that failed first, and this caught real bugs, for example a pasted reply that was saved twice.
- **The owner approves every change of an existing assertion.** Because of this, the redesigns did not weaken the tests.
- **Prototypes before the code.** 51 questions were settled cheaply, before the first line of code.
- **Notes under each task and small commits.** Every decision can be traced.
- **The Help was frozen until the end.** This was the owner's explicit choice and a good trade-off: the text did not change with every rename. The cost was two catch-up phases and 3 false sentences that were found only by checking the Help against the running demo.

## What to agree on at the start

1. **Demo or production.** This decides the compatibility with older files, the limits, how deep the security reviews go and how many edge cases are handled.
2. **The save model and the life cycle.** How many files, what each file holds, and when something becomes fixed (the start of the test run).
3. **A glossary and one list of button names.** One file (`labels.ts`) as the only source, used by the interface, the Help and the tests.
4. **One approved reference for the look** (a mock-up and the design tokens) before the screens are built.
5. **An MVP with an explicit list of what is out of scope**, so that no feature is built only to be removed.
6. **Domain rules with a table of worked examples**, for example how a finding matches an expected error (whole words, one word, numbers, Not found). This rule changed several times, each time for one more case.
7. **A threat model and the limits:** the size of a file, the length of a reply, the depth of JSON, untrusted ids. Principle IX was added only on 2026-11-16.
8. **What happens while something is saved in the background**, for example when the user leaves a window during a save. The same topic came back in three reviews.
9. **An owner trial after each vertical slice**, not after all phases. Build one slice from start to end, review it, and only then build the next.
10. **The gates and the Help policy, agreed up front.** Chrome e2e after each task, the full Chrome and Edge suite before a commit, and the Help updated in every phase or, by choice, at the end.

## The state of the documentation (not fixed)

- **`plan.md` is out of date in the descriptions of its slices.** It still speaks of two files, "Save evaluation" and "finalizing". For example, lines 10, 19, 263 and 267 to 290 describe the old flow.
- **`spec.md` (281 KB) and `tasks.md` (455 KB) are very large.** The Clarifications hold 187 questions, and many answers were replaced by later ones. The specification is hard to read for a new person.
- **There are three empty folders in the root of the repository:** `invalid-files.`, `npm` and `run`. Git does not track them, and they most likely come from a command that was quoted wrongly. They were not touched.
