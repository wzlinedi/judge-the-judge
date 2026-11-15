// A JSON pasted into a box that reads JSON is formatted at once (T292, FR-084).
import { useState } from 'preact/hooks';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/preact';
import { JsonBox } from '../../../src/ui/components/JsonBox';

function Harness({ start = '' }: { start?: string }) {
  const [text, setText] = useState(start);
  return <JsonBox label="Box" value={text} onChange={setText} check={() => []} />;
}
const box = () => screen.getByLabelText('Box') as HTMLTextAreaElement;
const paste = (text: string) => fireEvent.paste(box(), { clipboardData: { getData: () => text } });

describe('JsonBox paste', () => {
  it('shows a pasted valid JSON with new lines and an indent of 2 spaces', () => {
    render(<Harness />);
    paste('{"claims":[{"text":"x"}]}');
    expect(box().value).toBe('{\n  "claims": [\n    {\n      "text": "x"\n    }\n  ]\n}');
  });

  it('leaves a pasted text that is not valid JSON as it is, for the browser to paste', () => {
    render(<Harness />);
    const notPrevented = paste('{ nope');
    expect(notPrevented).toBe(true);
    expect(box().value).toBe('');
  });

  it('leaves JSON in a code fence or with other text around it as pasted', () => {
    render(<Harness />);
    expect(paste('```json\n{"a":1}\n```')).toBe(true);
    expect(paste('Reply: {"a":1}')).toBe(true);
  });

  it('formats only when the whole box would be valid JSON: a piece pasted into other text is left alone', () => {
    render(<Harness start="abc" />);
    expect(paste('{"a":1}')).toBe(true);
  });

  it('does not format what the user types', () => {
    render(<Harness />);
    fireEvent.input(box(), { target: { value: '{"a":1}' } });
    expect(box().value).toBe('{"a":1}');
  });
});
