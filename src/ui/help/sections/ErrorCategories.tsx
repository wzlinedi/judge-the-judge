import { labels } from '../../labels';

export function ErrorCategories() {
  return (
    <section aria-labelledby="help-categories">
      <h3 id="help-categories">Error categories</h3>
      <p>
        The <strong>error catalog</strong> is the list of kinds of error you inject, each with a name, a description and an example. It lives in the{' '}
        <strong>Error categories</strong> section above the table of the Test cases step, and nowhere else. The catalog is saved inside the test project file;
        it has no file of its own.
      </p>
      <p>
        Add categories by typing or pasting one per line, optionally as <code>name - description</code>, and press <strong>{labels.addCategory}</strong>. Names are
        written in lower case with dashes, and names already in the catalog are skipped and reported. A category in a case you paste joins the catalog when the case
        is saved.
      </p>
      <p>
        Each category shows how many test cases use it. <strong>{labels.rename}</strong> changes the name in every expected error that uses it, also after the
        test cases are finalized. <strong>{labels.remove}</strong> works at once for an unused category; for a used one it is disabled and the sentence beside it
        says how to go on. The tool never adds, renames or removes a category by itself, and your judge does not have to use the catalog.
      </p>
    </section>
  );
}
