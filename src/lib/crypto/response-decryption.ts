import { fromBase64 } from './base64url';
import type { CryptoAlgorithm, CryptoScope } from './body-encryption';
import { decodeEnvelope } from './envelope';
import { decryptSm4GcmEnvelope } from './sm4';

const textDecoder = new TextDecoder();

export type ResponseCryptoConfig = {
  algorithm: CryptoAlgorithm;
  scope: CryptoScope;
  sm4KeyBase64?: string;
  fieldPaths?: string[];
};

function sm4KeyFromBase64(value?: string): Uint8Array {
  if (!value?.trim()) throw new Error('SM4 key is required');
  const key = fromBase64(value.trim());
  if (key.length !== 16) throw new Error('SM4 key must decode to 16 bytes');
  return key;
}

function isEnvelopeString(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('ENCv1.');
}

function normalizeFieldPath(path: string): string[] {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '$') return [];
  const noRoot = trimmed.startsWith('$.')
    ? trimmed.slice(2)
    : trimmed.replace(/^\$\./, '');
  return noRoot
    .replace(/\[\*\]/g, '.*')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}

function decryptEnvelopeText(value: string, sm4Key: Uint8Array): string {
  return textDecoder.decode(decryptSm4GcmEnvelope(decodeEnvelope(value), sm4Key));
}

function decryptPathValue(
  root: unknown,
  segments: string[],
  sm4Key: Uint8Array,
  fieldPath: string
): number {
  if (segments.length === 0) return 0;
  const [head, ...tail] = segments;
  if (Array.isArray(root)) {
    if (head === '*') {
      return root.reduce(
        (count, item) =>
          count + decryptPathValue(item, tail, sm4Key, fieldPath),
        0
      );
    }
    const index = Number(head);
    if (Number.isInteger(index) && index >= 0 && index < root.length)
      return decryptPathValue(root[index], tail, sm4Key, fieldPath);
    return root.reduce(
      (count, item) =>
        count + decryptPathValue(item, segments, sm4Key, fieldPath),
      0
    );
  }
  if (root == null || typeof root !== 'object') return 0;
  const obj = root as Record<string, unknown>;
  if (!(head in obj)) return 0;
  if (tail.length === 0) {
    const current = obj[head];
    if (!isEnvelopeString(current))
      throw new Error('Field path is not an ENCv1 value: ' + fieldPath);
    obj[head] = decryptEnvelopeText(current, sm4Key);
    return 1;
  }
  return decryptPathValue(obj[head], tail, sm4Key, fieldPath);
}

function decryptAllEnvelopeStrings(
  value: unknown,
  sm4Key: Uint8Array
): { value: unknown; count: number } {
  if (isEnvelopeString(value)) {
    return { value: decryptEnvelopeText(value, sm4Key), count: 1 };
  }
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const decrypted = decryptAllEnvelopeStrings(item, sm4Key);
      count += decrypted.count;
      return decrypted.value;
    });
    return { value: next, count };
  }
  if (value !== null && typeof value === 'object') {
    let count = 0;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const decrypted = decryptAllEnvelopeStrings(item, sm4Key);
      count += decrypted.count;
      next[key] = decrypted.value;
    }
    return { value: next, count };
  }
  return { value, count: 0 };
}

export function decryptResponseBody(
  bodyText: string,
  config: ResponseCryptoConfig
): string {
  if (config.algorithm !== 'SM4')
    throw new Error('Response decryption currently supports SM4 only');

  const sm4Key = sm4KeyFromBase64(config.sm4KeyBase64);
  const trimmed = bodyText.trim();
  if (!trimmed) throw new Error('Response body is empty');
  if (isEnvelopeString(trimmed)) return decryptEnvelopeText(trimmed, sm4Key);

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error('Response body is not JSON or an ENCv1 envelope');
  }

  if (isEnvelopeString(parsed)) return decryptEnvelopeText(parsed, sm4Key);
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    isEnvelopeString((parsed as Record<string, unknown>).data)
  ) {
    return decryptEnvelopeText(
      (parsed as Record<string, string>).data,
      sm4Key
    );
  }

  const fieldPaths =
    config.fieldPaths?.map((item) => item.trim()).filter(Boolean) ?? [];
  if (fieldPaths.length > 0) {
    let count = 0;
    for (const fieldPath of fieldPaths) {
      count += decryptPathValue(
        parsed,
        normalizeFieldPath(fieldPath),
        sm4Key,
        fieldPath
      );
    }
    if (count > 0) return JSON.stringify(parsed);
  }

  const decrypted = decryptAllEnvelopeStrings(parsed, sm4Key);
  if (decrypted.count === 0) throw new Error('No ENCv1 data found in response');
  return JSON.stringify(decrypted.value);
}
