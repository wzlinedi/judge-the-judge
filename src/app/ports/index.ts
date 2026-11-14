import { createBrowserClipboardReader, createBrowserOpener, createBrowserSaveTarget, type BrowserEnv } from './browser';
import type { Ports } from './types';

export type { ClipboardReader, ClipboardResult, FileHandleLike, FileOpener, OpenedFile, Ports, SaveResult, SaveTarget } from './types';
export { browserSupported, openWithPicker, type BrowserEnv } from './browser';

/** The real ports of the page. `testProjectName` gives the suggested file name from the test project name. */
export function createBrowserPorts(env: BrowserEnv, testProjectName: () => string): Ports {
  const safe = (name: string) => name.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'untitled';
  return {
    testProjectTarget: createBrowserSaveTarget(env, () => `${safe(testProjectName())} - test project.json`),
    evaluationTarget: createBrowserSaveTarget(env, () => `${safe(testProjectName())} - evaluation.json`),
    clipboard: createBrowserClipboardReader(env),
    opener: createBrowserOpener(env),
  };
}
