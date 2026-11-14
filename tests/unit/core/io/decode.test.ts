// "Import test cases" reads bytes: UTF-8 first, then Windows-1250 (file-formats.md, section 4).
import { describe, expect, it } from 'vitest';
import { decodeBytes } from '../../../../src/core/io/decode';

const utf8 = (text: string) => new TextEncoder().encode(text);

describe('decodeBytes', () => {
  it('reads UTF-8 with Polish characters', () => {
    expect(decodeBytes(utf8('Zażółć gęślą jaźń'))).toEqual({ text: 'Zażółć gęślą jaźń', encoding: 'utf-8' });
  });

  it('removes a byte order mark', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('name,field:a')]);
    expect(decodeBytes(bytes)).toEqual({ text: 'name,field:a', encoding: 'utf-8' });
  });

  it('falls back to Windows-1250 when the bytes are not UTF-8, and says so', () => {
    const bytes = new Uint8Array([0x5a, 0x61, 0xbf, 0xf3, 0xb3, 0xe6]); // Zażółć
    expect(decodeBytes(bytes)).toEqual({ text: 'Zażółć', encoding: 'windows-1250' });
  });

  it('keeps every kind of line ending as it is', () => {
    for (const text of ['a\r\nb', 'a\nb', 'a\rb']) expect(decodeBytes(utf8(text)).text).toBe(text);
  });

  it('reads an empty file as empty text', () => {
    expect(decodeBytes(new Uint8Array())).toEqual({ text: '', encoding: 'utf-8' });
  });
});
