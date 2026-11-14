// Browser adapters: the File System Access API and the asynchronous clipboard (Chrome and Edge).
// The environment is passed in, so tests can stub it and the adapters never reach for `window`.
import type { ClipboardReader, ClipboardResult, FileHandleLike, FileOpener, SaveResult, SaveTarget } from './types';

export interface BrowserEnv {
  showSaveFilePicker?: (options: unknown) => Promise<FileHandleLike>;
  showOpenFilePicker?: (options: unknown) => Promise<Array<FileHandleLike & { getFile(): Promise<{ text(): Promise<string>; arrayBuffer?(): Promise<ArrayBuffer>; name: string }> }>>;
  navigator?: { clipboard?: { readText?: () => Promise<string> } };
}

const JSON_TYPES = [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }];
const IMPORT_TYPES = [{ description: 'CSV or JSON file', accept: { 'text/csv': ['.csv'], 'application/json': ['.json'], 'text/plain': ['.txt'] } }];

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** True when the page can save to a chosen file and read the clipboard (FR-003). */
export function browserSupported(env: BrowserEnv): boolean {
  return typeof env.showSaveFilePicker === 'function' && typeof env.navigator?.clipboard?.readText === 'function';
}

export function createBrowserSaveTarget(env: BrowserEnv, suggestedName: () => string): SaveTarget {
  let handle: FileHandleLike | null = null;
  /** A handle opened by a load is readable only: the first save asks for write permission. */
  let needsPermission = false;

  const write = async (target: FileHandleLike, text: string): Promise<SaveResult> => {
    try {
      const stream = await target.createWritable();
      await stream.write(text);
      await stream.close();
      return { status: 'saved', fileName: target.name };
    } catch {
      handle = null;
      needsPermission = false;
      return { status: 'no_longer_writable' };
    }
  };

  const ask = async (text: string): Promise<SaveResult> => {
    if (typeof env.showSaveFilePicker !== 'function') return { status: 'cancelled' };
    let chosen: FileHandleLike;
    try {
      chosen = await env.showSaveFilePicker({ suggestedName: suggestedName(), types: JSON_TYPES });
    } catch (error) {
      if (isAbort(error)) return { status: 'cancelled' };
      throw error;
    }
    const result = await write(chosen, text);
    if (result.status === 'saved') {
      handle = chosen;
      needsPermission = false;
    }
    return result;
  };

  return {
    get fileName() {
      return handle?.name ?? null;
    },
    set fileName(value: string | null) {
      if (value === null) handle = null;
    },
    async save(text) {
      if (!handle) return ask(text);
      if (needsPermission) {
        const permission = (await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'granted';
        if (permission !== 'granted') return { status: 'cancelled' };
        needsPermission = false;
      }
      return write(handle, text);
    },
    saveAs: ask,
    useLoaded(picked) {
      handle = picked;
      needsPermission = true;
    },
    forget() {
      handle = null;
      needsPermission = false;
    },
  };
}

export interface PickedFile {
  text: string;
  bytes?: Uint8Array;
  handle: FileHandleLike;
}

/** "Load …" through the browser's picker, so a later save goes to the same file. Null when cancelled. */
export async function openWithPicker(env: BrowserEnv, kind: 'json' | 'import' = 'json'): Promise<PickedFile | null> {
  if (typeof env.showOpenFilePicker !== 'function') return null;
  try {
    const [picked] = await env.showOpenFilePicker({ types: kind === 'import' ? IMPORT_TYPES : JSON_TYPES, multiple: false });
    if (!picked) return null;
    const file = await picked.getFile();
    if (kind === 'import' && typeof file.arrayBuffer === 'function') {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { text: new TextDecoder().decode(bytes), bytes, handle: picked };
    }
    return { text: await file.text(), handle: picked };
  } catch (error) {
    if (isAbort(error)) return null;
    throw error;
  }
}

export function createBrowserClipboardReader(env: BrowserEnv): ClipboardReader {
  return {
    async readText(): Promise<ClipboardResult> {
      const read = env.navigator?.clipboard?.readText;
      if (typeof read !== 'function') return { status: 'not_available' };
      try {
        const text = await read.call(env.navigator?.clipboard);
        return text.trim() === '' ? { status: 'empty' } : { status: 'text', text };
      } catch {
        return { status: 'refused' };
      }
    },
  };
}

export function createBrowserOpener(env: BrowserEnv): FileOpener {
  return { open: (kind) => openWithPicker(env, kind) };
}
