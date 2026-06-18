const textEncoder = new TextEncoder();

export function rfc3986Encode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase());
}

export function percentDecode(value: string): string {
  if (!value) return '';
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === '%' && i + 2 < value.length) {
      const hex = value.slice(i + 1, i + 3);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(...textEncoder.encode(char));
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

export function canonicalQuery(rawQuery?: string | null): string {
  if (!rawQuery) return '';
  const pairs: Array<[string, string]> = [];
  for (const segment of rawQuery.split('&')) {
    if (!segment) continue;
    const eq = segment.indexOf('=');
    const rawKey = eq < 0 ? segment : segment.slice(0, eq);
    const rawValue = eq < 0 ? '' : segment.slice(eq + 1);
    pairs.push([
      rfc3986Encode(percentDecode(rawKey)),
      rfc3986Encode(percentDecode(rawValue))
    ]);
  }
  pairs.sort(([ak, av], [bk, bv]) => ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk));
  return pairs.map(([key, value]) => key + '=' + value).join('&');
}

export function canonicalUri(pathname?: string | null): string {
  let path = pathname || '/';
  if (!path.startsWith('/')) path = '/' + path;
  return path.split('/').map((part, index) => index === 0 ? '' : rfc3986Encode(part)).join('/');
}

export async function sha256Hex(input?: Uint8Array | string | null): Promise<string> {
  const bytes = typeof input === 'string' ? textEncoder.encode(input) : input ?? new Uint8Array();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function bodyBytes(body?: string | Uint8Array | null): Uint8Array {
  if (body instanceof Uint8Array) return body;
  return textEncoder.encode(body ?? '');
}
