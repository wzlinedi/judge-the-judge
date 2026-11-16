// Content versions (research.md, section 14): the first 12 hexadecimal characters of the SHA-256
// hash of the canonical JSON (keys sorted, line endings normalized). Web Crypto exists in browsers
// and in Node, so no library is needed.

function normalize(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\r\n?/g, '\n');
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) Object.defineProperty(out, key, { value: normalize(item), enumerable: true, writable: true, configurable: true });
    }
    return out;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export async function sha256Short(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12);
}

export async function contentVersion(value: unknown): Promise<string> {
  return sha256Short(canonicalJson(value));
}
