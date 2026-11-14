// In-memory fakes of the two ports, used by unit, component and integration tests.
import type { ClipboardReader, ClipboardResult, FileOpener, OpenedFile, Ports, SaveResult, SaveTarget } from './types';

export interface FakeSaveTarget extends SaveTarget {
  /** The text of the last successful write. */
  lastText: string | null;
  /** How many times a file was asked for. */
  asked: number;
  /** When set, the next save or saveAs returns it instead of writing. */
  nextResult: SaveResult | null;
}

export function createFakeSaveTarget(chosenName = 'file.json'): FakeSaveTarget {
  const target: FakeSaveTarget = {
    fileName: null,
    lastText: null,
    asked: 0,
    nextResult: null,
    async save(text) {
      if (target.nextResult) {
        const result = target.nextResult;
        target.nextResult = null;
        if (result.status === 'no_longer_writable') target.fileName = null;
        return result;
      }
      if (target.fileName === null) target.asked++;
      target.fileName ??= chosenName;
      target.lastText = text;
      return { status: 'saved', fileName: target.fileName };
    },
    async saveAs(text) {
      if (target.nextResult) return target.save(text);
      target.asked++;
      target.fileName = chosenName;
      target.lastText = text;
      return { status: 'saved', fileName: chosenName };
    },
    useLoaded(handle) {
      target.fileName = handle.name;
    },
    forget() {
      target.fileName = null;
    },
  };
  return target;
}

export interface FakeClipboard extends ClipboardReader {
  text: string;
  refuse: boolean;
  available: boolean;
}

export function createFakeClipboard(text = ''): FakeClipboard {
  const clipboard: FakeClipboard = {
    text,
    refuse: false,
    available: true,
    async readText(): Promise<ClipboardResult> {
      if (!clipboard.available) return { status: 'not_available' };
      if (clipboard.refuse) return { status: 'refused' };
      return clipboard.text.trim() === '' ? { status: 'empty' } : { status: 'text', text: clipboard.text };
    },
  };
  return clipboard;
}

export interface FakeOpener extends FileOpener {
  /** The file the next `open` returns; null means the user cancels. It is used once. */
  next: { name: string; text: string } | null;
}

export function createFakeOpener(): FakeOpener {
  const opener: FakeOpener = {
    next: null,
    async open(): Promise<OpenedFile | null> {
      const file = opener.next;
      opener.next = null;
      if (!file) return null;
      return { text: file.text, handle: { name: file.name, createWritable: async () => ({ write: async () => {}, close: async () => {} }) } };
    },
  };
  return opener;
}

export interface FakePorts extends Ports {
  testProjectTarget: FakeSaveTarget;
  evaluationTarget: FakeSaveTarget;
  clipboard: FakeClipboard;
  opener: FakeOpener;
}

export function createFakePorts(): FakePorts {
  return {
    testProjectTarget: createFakeSaveTarget('test-project.json'),
    evaluationTarget: createFakeSaveTarget('evaluation.json'),
    clipboard: createFakeClipboard(),
    opener: createFakeOpener(),
  };
}
