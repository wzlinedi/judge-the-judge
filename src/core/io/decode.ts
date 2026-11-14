// Bytes of a file the user chose to text: UTF-8 first (a byte order mark is removed), then Windows-1250,
// which is what spreadsheets in Central Europe write (file-formats.md, section 4).
export interface Decoded {
  text: string;
  encoding: 'utf-8' | 'windows-1250';
}

export function decodeBytes(bytes: Uint8Array): Decoded {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
    return { text: text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1250').decode(bytes), encoding: 'windows-1250' };
  }
}
