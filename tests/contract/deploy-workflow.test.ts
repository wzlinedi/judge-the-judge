// Publishing (research.md, section 21; Principles II and VIII): on a push to main the tests and the end-to-end tests pass first, and only then
// is the built page published to GitHub Pages, which serves it over HTTPS.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
const at = (text: string) => {
  const index = workflow.indexOf(text);
  expect(index, `${text} is in the workflow`).toBeGreaterThanOrEqual(0);
  return index;
};

describe('.github/workflows/deploy.yml', () => {
  it('runs on a push to main and on nothing else that publishes', () => {
    expect(workflow).toMatch(/on:\s*\n\s+push:\s*\n\s+branches: \[main\]/);
    expect(workflow).not.toMatch(/pull_request/);
  });

  it('installs from the lock file, tests, builds, runs the end-to-end tests and only then uploads dist/, in that order', () => {
    const order = ['npm ci', 'npm test', 'npm run build', 'npm run e2e', 'actions/upload-pages-artifact', 'actions/deploy-pages'].map(at);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(workflow).toMatch(/upload-pages-artifact@[^\n]*\n\s+with:\s*\n\s+path: dist/);
  });

  it('installs both browsers of the end-to-end tests, Chrome and Edge, because npm run e2e runs both projects', () => {
    expect(workflow).toMatch(/playwright install[^\n]*\bchromium\b[^\n]*\bmsedge\b|playwright install[^\n]*\bmsedge\b[^\n]*\bchromium\b|playwright install[^\n]*\bchrome\b[^\n]*\bmsedge\b/);
  });

  it('publishes in a separate job that needs the job that tested, with the permissions Pages asks for and no more', () => {
    expect(workflow).toMatch(/deploy:\s*\n\s+needs: build/);
    expect(workflow).toMatch(/permissions:\s*\n\s+contents: read\s*\n\s+pages: write\s*\n\s+id-token: write/);
    expect(workflow).toMatch(/environment:\s*\n\s+name: github-pages/);
    expect(workflow).not.toMatch(/contents: write/);
  });

  it('gives the whole workflow read access only; publishing rights are granted in the deploy job alone (S2)', () => {
    const top = workflow.slice(0, workflow.indexOf('\njobs:'));
    expect(top).toMatch(/\npermissions:\s*\n\s+contents: read\s*\n(?!\s+(pages|id-token))/);
    expect(top).not.toMatch(/pages: write|id-token: write/);
    const deploy = workflow.slice(workflow.indexOf('\n  deploy:'));
    expect(deploy).toMatch(/permissions:\s*\n\s+contents: read\s*\n\s+pages: write\s*\n\s+id-token: write/);
    const build = workflow.slice(workflow.indexOf('\n  build:'), workflow.indexOf('\n  deploy:'));
    expect(build).not.toMatch(/pages: write|id-token: write/);
  });

  it('pins every action to a full commit SHA and names the version in a comment (S6)', () => {
    const lines = workflow.split('\n').filter((l) => /^\s*-?\s*uses:/.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line, line).toMatch(/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+/);
  });

  it('does not leave the checkout token in the repository settings of the build job (S7)', () => {
    expect(workflow).toMatch(/uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\s*\n\s+persist-credentials: false/);
  });

  it('does not publish two runs at once and does not cancel a publication in progress', () => {
    expect(workflow).toMatch(/concurrency:\s*\n\s+group: pages\s*\n\s+cancel-in-progress: false/);
  });

  it('serves the page from a path of its own: the build uses relative asset paths', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/base: '\.\/'/);
  });
});
