import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { HelpStep } from '../../../src/ui/help/HelpStep';

const expected = JSON.parse(readFileSync('examples/demo/expected-results.json', 'utf8'));

describe('Help (Principle VIII)', () => {
  it('has the sections written so far, in plain headings', () => {
    render(<HelpStep />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['What the tool does', 'How big a test needs to be', 'The four steps', 'Files: the test project and the evaluation', 'Privacy and saving', 'Examples and demo data', 'Reading the results']);
  });

  it('quotes the numbers of the demo from the demo files, so they cannot drift', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    const c = expected.after_deciding.counters;
    expect(text).toContain(`${c.expected_found} of ${c.expected_total}`);
    expect(text).toContain(`${expected.awaiting_verification.length} cases`);
    expect(text).toMatch(/20 test cases/);
  });

  it('states the fixed minimum test size', () => {
    render(<HelpStep />);
    expect(document.body.textContent).toMatch(/at least 30 injected errors and 10 clean cases/);
  });

  it('names the buttons as they are labeled in the tool', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Load example…', 'Continue', 'Approve', 'Issue: missed', 'Issue: false positive', 'Real error']) expect(text).toContain(label);
  });

  it('explains the two files, the indicator, "… as" and running the same test with another LLM', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Save test project', 'Save evaluation', 'Save evaluation as', 'Load test project', 'Load evaluation', 'All changes saved', 'Unsaved changes']) expect(text).toContain(label);
    expect(text).toMatch(/another LLM/);
    expect(text).toMatch(/replies are kept only by/i);
  });

  it('explains privacy and saving: Chrome and Edge, the permission prompt, nothing leaves the browser, save often', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/Chrome or Edge/);
    expect(text).toMatch(/permission/i);
    expect(text).toMatch(/never sent/i);
    expect(text).toMatch(/save often/i);
  });
});
