// An in-memory stand-in for the File System Access API in the browser, so the e2e tests can "save to a file"
// and "load from it" without a native dialog. The files live in the test process and survive page reloads.
import type { Page } from '@playwright/test';

export interface MemoryFiles {
  files: Map<string, string>;
  /** How many times the save picker was shown. */
  asked: () => number;
  /** The name the next save picker returns; by default the suggested name. */
  chooseSaveName: (name: string) => void;
  /** The file the next open picker returns. */
  chooseOpenName: (name: string) => void;
  /** While true, writing to an already chosen file fails, as when the file was removed. */
  failWrites: (fail: boolean) => void;
}

export async function installMemoryFiles(page: Page): Promise<MemoryFiles> {
  const files = new Map<string, string>();
  let asked = 0;
  let saveName: string | null = null;
  let openName = '';
  let failing = false;

  await page.exposeFunction('__memAsked', (suggested: string) => {
    asked++;
    const name = saveName ?? suggested;
    saveName = null;
    return name;
  });
  await page.exposeFunction('__memWrite', (name: string, text: string) => {
    if (failing) throw new Error('The file was removed');
    files.set(name, text);
  });
  await page.exposeFunction('__memRead', (name: string) => files.get(name) ?? '');
  await page.exposeFunction('__memOpenName', () => openName);

  await page.addInitScript(() => {
    const w = window as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const handle = (name: string) => ({
      name,
      requestPermission: async () => 'granted',
      createWritable: async () => {
        let buffer = '';
        return { write: async (text: string) => void (buffer += text), close: async () => w['__memWrite'](name, buffer) };
      },
      getFile: async () => ({ name, text: async () => w['__memRead'](name), arrayBuffer: async () => new TextEncoder().encode(await w['__memRead'](name)).buffer }),
    });
    w['showSaveFilePicker'] = async (options: { suggestedName: string }) => handle(await w['__memAsked'](options.suggestedName));
    w['showOpenFilePicker'] = async () => [handle(await w['__memOpenName']())];
  });

  return {
    files,
    asked: () => asked,
    chooseSaveName: (name) => void (saveName = name),
    chooseOpenName: (name) => void (openName = name),
    failWrites: (fail) => void (failing = fail),
  };
}
