import { describe, expect, it, vi } from 'vitest';
import { createBrowserClipboardReader, createBrowserSaveTarget, openWithPicker } from '../../../src/app/ports/browser';
import { createFakeClipboard, createFakeSaveTarget } from '../../../src/app/ports/fakes';

function fakeHandle(name = 'work.json', options: { failWrite?: boolean; permission?: 'granted' | 'denied' } = {}) {
  const written: string[] = [];
  const handle = {
    name,
    written,
    createWritable: vi.fn(async () => {
      if (options.failWrite) throw new DOMException('gone', 'NotFoundError');
      return {
        write: vi.fn(async (text: string) => {
          written.push(text);
        }),
        close: vi.fn(async () => {}),
      };
    }),
    requestPermission: vi.fn(async () => options.permission ?? 'granted'),
  };
  return handle;
}

const abort = () => new DOMException('The user aborted a request.', 'AbortError');

describe('browser SaveTarget', () => {
  it('asks for a file the first time and overwrites it later', async () => {
    const handle = fakeHandle();
    const showSaveFilePicker = vi.fn(async (_options: unknown) => handle);
    const target = createBrowserSaveTarget({ showSaveFilePicker }, () => 'My project.json');

    expect(target.fileName).toBeNull();
    expect(await target.save('one')).toEqual({ status: 'saved', fileName: 'work.json' });
    expect(await target.save('two')).toEqual({ status: 'saved', fileName: 'work.json' });

    expect(showSaveFilePicker).toHaveBeenCalledTimes(1);
    expect(showSaveFilePicker.mock.calls[0]?.[0]).toMatchObject({ suggestedName: 'My project.json' });
    expect(handle.written).toEqual(['one', 'two']);
    expect(target.fileName).toBe('work.json');
  });

  it('saveAs always asks and the new file becomes current', async () => {
    const first = fakeHandle('a.json');
    const second = fakeHandle('b.json');
    const showSaveFilePicker = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const target = createBrowserSaveTarget({ showSaveFilePicker }, () => 'x.json');
    await target.save('1');
    expect(await target.saveAs('2')).toEqual({ status: 'saved', fileName: 'b.json' });
    await target.save('3');
    expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
    expect(first.written).toEqual(['1']);
    expect(second.written).toEqual(['2', '3']);
  });

  it('a cancelled dialog returns "cancelled" and keeps the current file', async () => {
    const handle = fakeHandle('a.json');
    const showSaveFilePicker = vi.fn().mockResolvedValueOnce(handle).mockRejectedValueOnce(abort());
    const target = createBrowserSaveTarget({ showSaveFilePicker }, () => 'x.json');
    await target.save('1');
    expect(await target.saveAs('2')).toEqual({ status: 'cancelled' });
    expect(target.fileName).toBe('a.json');
    expect(await target.save('3')).toEqual({ status: 'saved', fileName: 'a.json' });
  });

  it('useLoaded makes the picked file current and asks for write permission once', async () => {
    const handle = fakeHandle('loaded.json');
    const showSaveFilePicker = vi.fn();
    const target = createBrowserSaveTarget({ showSaveFilePicker }, () => 'x.json');
    target.useLoaded(handle);
    expect(target.fileName).toBe('loaded.json');

    expect(await target.save('1')).toEqual({ status: 'saved', fileName: 'loaded.json' });
    expect(await target.save('2')).toEqual({ status: 'saved', fileName: 'loaded.json' });
    expect(handle.requestPermission).toHaveBeenCalledTimes(1);
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(showSaveFilePicker).not.toHaveBeenCalled();
  });

  it('a refused permission is treated like a cancelled dialog and keeps the file', async () => {
    const handle = fakeHandle('loaded.json', { permission: 'denied' });
    const target = createBrowserSaveTarget({ showSaveFilePicker: vi.fn() }, () => 'x.json');
    target.useLoaded(handle);
    expect(await target.save('1')).toEqual({ status: 'cancelled' });
    expect(target.fileName).toBe('loaded.json');
    expect(handle.written).toEqual([]);
  });

  it('a write that fails reports "file no longer writable" and forgets the file', async () => {
    const handle = fakeHandle('gone.json', { failWrite: true });
    const target = createBrowserSaveTarget({ showSaveFilePicker: vi.fn(async () => handle) }, () => 'x.json');
    expect(await target.save('1')).toEqual({ status: 'no_longer_writable' });
    expect(target.fileName).toBeNull();
  });

  it('forget drops the current file so the next save asks again', async () => {
    const handle = fakeHandle();
    const showSaveFilePicker = vi.fn(async () => handle);
    const target = createBrowserSaveTarget({ showSaveFilePicker }, () => 'x.json');
    await target.save('1');
    target.forget();
    expect(target.fileName).toBeNull();
    await target.save('2');
    expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
  });
});

describe('openWithPicker', () => {
  it('returns the text and the handle of the picked file', async () => {
    const handle = { ...fakeHandle('in.json'), getFile: async () => ({ text: async () => '{"a":1}', name: 'in.json' }) };
    const showOpenFilePicker = vi.fn(async () => [handle]);
    expect(await openWithPicker({ showOpenFilePicker })).toMatchObject({ text: '{"a":1}', handle: { name: 'in.json' } });
  });

  it('returns null when the dialog is cancelled', async () => {
    expect(await openWithPicker({ showOpenFilePicker: vi.fn().mockRejectedValue(abort()) })).toBeNull();
  });
});

describe('browser ClipboardReader', () => {
  it('returns the text', async () => {
    const reader = createBrowserClipboardReader({ navigator: { clipboard: { readText: async () => 'hello' } } });
    expect(await reader.readText()).toEqual({ status: 'text', text: 'hello' });
  });

  it('returns "empty" for no text', async () => {
    const reader = createBrowserClipboardReader({ navigator: { clipboard: { readText: async () => '  \n' } } });
    expect(await reader.readText()).toEqual({ status: 'empty' });
  });

  it('returns "refused" when the browser refuses', async () => {
    const reader = createBrowserClipboardReader({
      navigator: {
        clipboard: {
          readText: async () => {
            throw new DOMException('no', 'NotAllowedError');
          },
        },
      },
    });
    expect(await reader.readText()).toEqual({ status: 'refused' });
  });

  it('returns "not available" without the API', async () => {
    expect(await createBrowserClipboardReader({ navigator: {} }).readText()).toEqual({ status: 'not_available' });
    expect(await createBrowserClipboardReader({}).readText()).toEqual({ status: 'not_available' });
  });
});

describe('fakes', () => {
  it('the fake save target keeps the text in memory and follows the same rules', async () => {
    const target = createFakeSaveTarget('evaluation.json');
    expect(target.fileName).toBeNull();
    expect(await target.save('a')).toEqual({ status: 'saved', fileName: 'evaluation.json' });
    expect(target.lastText).toBe('a');
    target.forget();
    expect(target.fileName).toBeNull();
    target.nextResult = { status: 'cancelled' };
    expect(await target.save('b')).toEqual({ status: 'cancelled' });
    expect(target.lastText).toBe('a');
  });

  it('the fake clipboard returns what was put into it', async () => {
    const clipboard = createFakeClipboard('pasted');
    expect(await clipboard.readText()).toEqual({ status: 'text', text: 'pasted' });
    clipboard.text = '';
    expect(await clipboard.readText()).toEqual({ status: 'empty' });
    clipboard.refuse = true;
    expect(await clipboard.readText()).toEqual({ status: 'refused' });
  });
});
