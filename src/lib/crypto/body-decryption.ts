import forge from 'node-forge';

import { fromBase64, fromBase64Url } from './base64url';
import { decodeEnvelope } from './envelope';
import { decryptSm4GcmEnvelope } from './sm4';

const textDecoder = new TextDecoder();

export type ResponseDecryptionResult = {
  bodyText: string;
  decryptedCount: number;
  mode: 'direct' | 'whole' | 'field';
};

export type ResponseDecryptionOptions = {
  algorithm?: 'SM4' | 'RSA_SM4';
  sm4KeyBase64?: string;
  rsaPrivateKeyPem?: string;
  encryptKey?: string;
};

function binaryToBytes(binary: string): Uint8Array {
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBinary(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

function sm4KeyFromBase64(value?: string): Uint8Array {
  if (!value?.trim()) throw new Error('SM4 key is required');
  const key = fromBase64(value.trim());
  if (key.length !== 16) throw new Error('SM4 key must decode to 16 bytes');
  return key;
}

function wrappedKeyFromHeader(value?: string): Uint8Array {
  if (!value?.trim()) throw new Error('X-Encrypt-Key is required');
  const raw = value.trim();
  try {
    return fromBase64Url(raw);
  } catch {
    return fromBase64(raw);
  }
}

function unwrapSessionKeyWithRsa(
  privateKeyPem: string | undefined,
  encryptKey: string | undefined
): Uint8Array {
  if (!privateKeyPem?.trim()) throw new Error('RSA private key is required');
  const privateKey = forge.pki.privateKeyFromPem(
    privateKeyPem
  ) as forge.pki.rsa.PrivateKey;
  const wrapped = wrappedKeyFromHeader(encryptKey);
  const decrypted = privateKey.decrypt(bytesToBinary(wrapped), 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: {
      md: forge.md.sha1.create()
    }
  });
  const sessionKey = binaryToBytes(decrypted);
  if (sessionKey.length !== 16)
    throw new Error('RSA unwrapped session key must be 16 bytes');
  return sessionKey;
}

function resolveSm4Key(options: ResponseDecryptionOptions): Uint8Array {
  if ((options.algorithm ?? 'SM4') === 'RSA_SM4') {
    return unwrapSessionKeyWithRsa(
      options.rsaPrivateKeyPem,
      options.encryptKey
    );
  }
  return sm4KeyFromBase64(options.sm4KeyBase64);
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
  options: string | ResponseDecryptionOptions = {}
): ResponseDecryptionResult {
  const normalizedOptions: ResponseDecryptionOptions =
    typeof options === 'string' ? { sm4KeyBase64: options } : options;
  const trimmed = bodyText.trim();
  if (!trimmed) throw new Error('Response body is empty');

  const key = resolveSm4Key(normalizedOptions);
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
