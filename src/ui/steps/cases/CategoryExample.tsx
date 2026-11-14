import { useEffect, useRef, useState } from 'preact/hooks';
import type { Category, TestCase } from '../../../core/model';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';
import { MarkedFields } from '../../windows/case-window/MarkedFields';

export interface CategoryExampleProps {
  category: Category;
  /** The test cases that use the category, in the order of the table. */
  cases: readonly TestCase[];
  judged: string | undefined;
  onExample: (example: string) => void;
  onClose: () => void;
}

/** "Example" of a category (T237): the test cases that use it, one at a time, with the short example that goes into the prompts. */
export function CategoryExample({ category, cases, judged, onExample, onClose }: CategoryExampleProps) {
  const [index, setIndex] = useState(0);
  const textRef = useRef<HTMLDivElement>(null);
  const current = cases[Math.min(index, cases.length - 1)];
  const errors = current ? current.expected_errors.filter((e) => e.category === category.name) : [];
  useEffect(() => {
    textRef.current?.querySelector<HTMLElement>('mark.fragment-strong')?.scrollIntoView?.({ block: 'nearest' });
  }, [current?.id]);
  if (!current) return null;
  const at = Math.min(index, cases.length - 1);
  return (
    <Dialog
      open
      wide
      title={`Example: ${category.name}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" disabled={at === 0} onClick={() => setIndex(at - 1)}>
            {labels.previousTestCase}
          </button>
          <button type="button" disabled={at >= cases.length - 1} onClick={() => setIndex(at + 1)}>
            {labels.nextTestCase}
          </button>
          <button type="button" class="primary" onClick={onClose}>
            {labels.close}
          </button>
        </>
      }
    >
      <p class="muted">{category.description ? category.description : 'This category has no description yet.'}</p>
      <p role="status" aria-label="Position">
        <strong>{`case ${current.id} · ${current.name} (${at + 1} of ${cases.length})`}</strong>
      </p>
      <ul class="decide-list" aria-label="Errors of this category">
        {errors.map((e) => (
          <li key={e.id} class="decide-item">
            {e.description}
            {e.fragment ? <span class="muted">{` — “${e.fragment}”`}</span> : null}
          </li>
        ))}
      </ul>
      <MarkedFields testCase={current} judged={judged} effective={null} uncovered={[]} strong={errors.map((e) => e.id)} rootRef={textRef} />
      <label class="field-label" for="category-example-short">
        Short example for prompts
      </label>
      <input id="category-example-short" type="text" placeholder="A short example (optional)" value={category.example ?? ''} onInput={(event) => onExample((event.currentTarget as HTMLInputElement).value)} />
    </Dialog>
  );
}
