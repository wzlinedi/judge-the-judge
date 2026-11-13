import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';

export type ExampleId = 'accuracy' | 'completeness' | 'demo';

export interface LoadExampleWindowProps {
  open: boolean;
  onChoose: (example: ExampleId) => void;
  onLoadMetric: () => void;
  onClose: () => void;
}

/** The ready examples (FR-019, FR-026): two metrics that start a new test project, and the demo run. */
export function LoadExampleWindow({ open, onChoose, onLoadMetric, onClose }: LoadExampleWindowProps) {
  return (
    <Dialog
      open={open}
      title={labels.loadExample}
      onClose={onClose}
      actions={
        <button type="button" onClick={onClose}>
          {labels.cancel}
        </button>
      }
    >
      <ul class="example-list">
        <li>
          <button type="button" onClick={() => onChoose('accuracy')}>
            Accuracy
          </button>
          <span class="muted"> Does the judge find the errors in a text?</span>
        </li>
        <li>
          <button type="button" onClick={() => onChoose('completeness')}>
            Completeness
          </button>
          <span class="muted"> Does the judge find what is missing?</span>
        </li>
        <li>
          <button type="button" onClick={() => onChoose('demo')}>
            Demo: book summaries
          </button>
          <span class="muted"> A finished run, to see what the results look like.</span>
        </li>
        <li>
          <button type="button" onClick={onLoadMetric}>
            {labels.loadMetricDefinition}
          </button>
        </li>
      </ul>
    </Dialog>
  );
}
