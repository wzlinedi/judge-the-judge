import type { Problem } from '../../../core/model';
import { Dialog } from '../../components/Dialog';
import { ErrorMessage } from '../../components/ErrorMessage';
import { labels } from '../../labels';

export const DEMO = 'demo';

export interface ExampleEntry {
  id: string;
  name: string;
  description: string;
}

export interface LoadExampleWindowProps {
  open: boolean;
  /** Every registered metric: the window names none of them itself (Principle VI). */
  metrics: readonly ExampleEntry[];
  onChoose: (example: string) => void;
  onLoadMetric: () => void;
  onClose: () => void;
  /** Problems of the last file given to "Load metric definition…". */
  problems?: readonly Problem[];
  /** A definition whose id belongs to one loaded earlier: the user chooses whether to replace it. */
  replace?: { message: string; onReplace: () => void; onKeep: () => void };
}

/** The ready examples (FR-019, FR-026): the registered metrics start a new test project, and the demo is a finished run. */
export function LoadExampleWindow({ open, metrics, onChoose, onLoadMetric, onClose, problems = [], replace }: LoadExampleWindowProps) {
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
        {metrics.map((metric) => (
          <li key={metric.id}>
            <button type="button" onClick={() => onChoose(metric.id)}>
              {metric.name}
            </button>
            <span class="muted">{` ${metric.description}`}</span>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => onChoose(DEMO)}>
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
      <ErrorMessage problems={[...problems]} title="The metric definition was not loaded. Nothing has changed." />
      {replace ? (
        <div class="notice warn">
          <p>{`${replace.message} Replace it?`}</p>
          <div class="button-row">
            <button type="button" onClick={replace.onKeep}>
              Keep it
            </button>
            <button type="button" class="primary" onClick={replace.onReplace}>
              Replace
            </button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
