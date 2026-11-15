import { useMemo } from 'preact/hooks';
import type { Finding } from '../../../core/judge/findings';
import { locateFinding } from '../../../core/judge/locate-finding';

export interface ReplyViewProps {
  /** The reply saved for the case. */
  reply: string;
  /** The findings the error rules read from it, in the order of the reply: F1 is the first. */
  findings: readonly Finding[];
  /** The finding that was pressed on the right: its block is marked. */
  pointed: string | null;
  /** A highlighted block was pressed: the finding on the right is marked. */
  onPoint: (key: string) => void;
}

interface Block {
  key: string;
  number: number;
  rules: string[];
  start: number;
  end: number;
}

/** The blocks of the reply that error rules turned into findings, in the order of the text, none inside another (T293). */
export function blocksOf(reply: string, findings: readonly Finding[]): Block[] {
  const found: Block[] = [];
  findings.forEach((finding, index) => {
    const at = locateFinding(reply, finding.key);
    if (at) found.push({ key: finding.key, number: index + 1, rules: finding.rules, start: at.start, end: at.end });
  });
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Block[] = [];
  for (const block of found) {
    const last = kept[kept.length - 1];
    if (!last || block.start >= last.end) kept.push(block);
  }
  return kept;
}

/** A block widened to whole lines, so that the bar at its left stands beside every line of it: it starts where its first line starts and ends after its last line. */
function wholeLines(reply: string, block: Block): Block {
  const lineStart = reply.lastIndexOf('\n', block.start - 1) + 1;
  const start = /^[ \t]*$/.test(reply.slice(lineStart, block.start)) ? lineStart : block.start;
  const newline = reply.indexOf('\n', block.end);
  const lineEnd = newline === -1 ? reply.length : newline;
  const end = /^[\s,]*$/.test(reply.slice(block.end, lineEnd)) ? (newline === -1 ? reply.length : newline + 1) : block.end;
  return { ...block, start, end };
}

/**
 * A saved reply, read-only (T293, T311, FR-055): the text as it is kept (formatted when it is JSON), with a bar at the left of each part that an
 * error rule turned into a finding. The bar has no label; the part is highlighted only while its finding is pointed at (T311). A reply kept as text has no bar.
 */
export function ReplyView({ reply, findings, pointed, onPoint }: ReplyViewProps) {
  const blocks = useMemo(() => {
    const widened = blocksOf(reply, findings).map((b) => wholeLines(reply, b));
    return widened.filter((b, i) => i === 0 || b.start >= (widened[i - 1] as Block).end);
  }, [reply, findings]);
  const parts: Array<string | Block> = [];
  let at = 0;
  for (const block of blocks) {
    if (block.start > at) parts.push(reply.slice(at, block.start));
    parts.push(block);
    at = block.end;
  }
  if (at < reply.length) parts.push(reply.slice(at));

  return (
    <pre class="reply-read" aria-label="Judge reply" tabIndex={0}>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <mark
            key={i}
            class={`reply-block${pointed === part.key ? ' fragment-strong' : ''}`}
            data-finding-block={part.key}
            role="button"
            tabIndex={0}
            onClick={() => onPoint(part.key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPoint(part.key);
              }
            }}
          >
            {reply.slice(part.start, part.end)}
          </mark>
        ),
      )}
    </pre>
  );
}
