// The two browser features sit behind ports, so every action can be tested with fakes
// (research.md, section 25; Principle III). The core never sees either port.

export type SaveResult =
  | { status: 'saved'; fileName: string }
  | { status: 'cancelled' }
  | { status: 'no_longer_writable' };

export interface FileHandleLike {
  name: string;
  createWritable(): Promise<{ write(text: string): Promise<void>; close(): Promise<void> }>;
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}

/** One instance per kind of file: the test project and the evaluation (FR-076). */
export interface SaveTarget {
  /** The remembered file, in memory only; null when there is none. */
  fileName: string | null;
  /** Writes to the current file; asks for one the first time. */
  save(text: string): Promise<SaveResult>;
  /** Always asks for a file. */
  saveAs(text: string): Promise<SaveResult>;
  /** Makes a file opened by the matching load the current one. */
  useLoaded(handle: FileHandleLike): void;
  /** Drops the current file. */
  forget(): void;
}

export type ClipboardResult =
  | { status: 'text'; text: string }
  | { status: 'empty' }
  | { status: 'refused' }
  | { status: 'not_available' };

export interface ClipboardReader {
  readText(): Promise<ClipboardResult>;
}

/** A file the user picked to load: its text and the handle that makes it the current file for later saves. */
export interface OpenedFile {
  text: string;
  handle: FileHandleLike;
}

export interface FileOpener {
  /** Asks the user for a file; null when they cancel. */
  open(): Promise<OpenedFile | null>;
}

export interface Ports {
  testProjectTarget: SaveTarget;
  evaluationTarget: SaveTarget;
  clipboard: ClipboardReader;
  opener: FileOpener;
}
