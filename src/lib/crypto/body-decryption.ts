import { fromBase64 } from './base64url';
import { decodeEnvelope } from './envelope';
import { decryptSm4GcmEnvelope } from './sm4';

const textDecoder = new TextDecoder();

export type ResponseDecryptionResult = {
  bodyText: string;
  decryptedCount: number;
  mode: 'direct' | 'whole' | 'field';
};

function sm4KeyFromBase64(value?: string): Uint8Array {
  if (!value?.trim()) throw new Error('SM4 key is required');
  const key = fromBase64(value.trim());
  if (key.length !== 16) throw new Error('SM4 key must decode to 16 bytes');
  return key;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnvelopeText(value: string): boolean {
  return value.trim().startsWith('ENCv1.');
}

function decryptEnvelopeText(value: string, key: Uint8Array): string {
  return textDecoder.decode(decryptSm4GcmEnvelope(decodeEnvelope(value.trim()), key));
}

function decryptJsonValue(
  value: unknown,
  key: Uint8Array,
  state: { count: number }
): unknown {
  if (typeof value === 'string' && isEnvelopeText(value)) {
    state.count += 1;
    return decryptEnvelopeText(value, key);
  }

  if (Array.isArray(value))
    return value.map((item) => decryptJsonValue(item, key, state));

  if (!isJsonObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([itemKey, itemValue]) => [
      itemKey,
      decryptJsonValue(itemValue, key, state)
    ])
  );
}

export function decryptResponseBody(
  bodyText: string,
  sm4KeyBase64?: string
): ResponseDecryptionResult {
  const trimmed = bodyText.trim();
  if (!trimmed) throw new Error('Response body is empty');

  const key = sm4KeyFromBase64(sm4KeyBase64);
  if (isEnvelopeText(trimmed)) {
    return {
      bodyText: decryptEnvelopeText(trimmed, key),
      decryptedCount: 1,
      mode: 'direct'
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error('Response body must be ENCv1 text or JSON');
  }

  if (
    isJsonObject(parsed) &&
    typeof parsed.data === 'string' &&
    isEnvelopeText(parsed.data)
  ) {
    return {
      bodyText: decryptEnvelopeText(parsed.data, key),
      decryptedCount: 1,
      mode: 'whole'
    };
  }

  const state = { count: 0 };
  const decrypted = decryptJsonValue(parsed, key, state);
  if (state.count === 0) throw new Error('No ENCv1 data found in response body');

  return {
    bodyText: JSON.stringify(decrypted),
    decryptedCount: state.count,
    mode: 'field'
  };
}
