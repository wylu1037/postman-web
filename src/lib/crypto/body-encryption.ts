import forge from 'node-forge';

import { fromBase64, toBase64Url } from './base64url';
import { encodeEnvelope, wrapWholeBody } from './envelope';
import { encryptSm4GcmEnvelope } from './sm4';

const textEncoder = new TextEncoder();

type RandomBytes = (length: number) => Uint8Array;

export type CryptoAlgorithm = 'SM4' | 'RSA_SM4';
export type CryptoScope = 'WHOLE' | 'FIELD';

export type CryptoForm = {
  enabled: boolean;
  algorithm: CryptoAlgorithm;
  scope: CryptoScope;
  sm4KeyBase64?: string;
  rsaPublicKeyPem?: string;
  fieldPaths?: string[];
};

export type EncryptionResult = {
  bodyText: string;
  headers: Record<string, string>;
};

function defaultRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function sm4KeyFromBase64(value?: string): Uint8Array {
  if (!value?.trim()) throw new Error('SM4 key is required');
  const key = fromBase64(value.trim());
  if (key.length !== 16) throw new Error('SM4 key must decode to 16 bytes');
  return key;
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

function encryptPathValue(
  root: unknown,
  segments: string[],
  encryptValue: (plain: string) => string
): number {
  if (segments.length === 0) return 0;
  const [head, ...tail] = segments;
  if (Array.isArray(root)) {
    if (head === '*')
      return root.reduce(
        (count, item) => count + encryptPathValue(item, tail, encryptValue),
        0
      );
    const index = Number(head);
    if (Number.isInteger(index) && index >= 0 && index < root.length)
      return encryptPathValue(root[index], tail, encryptValue);
    return root.reduce(
      (count, item) => count + encryptPathValue(item, segments, encryptValue),
      0
    );
  }
  if (root == null || typeof root !== 'object') return 0;
  const obj = root as Record<string, unknown>;
  if (!(head in obj)) return 0;
  if (tail.length === 0) {
    const current = obj[head];
    if (typeof current !== 'string')
      throw new Error('Field ' + head + ' must be a string before encryption');
    obj[head] = encryptValue(current);
    return 1;
  }
  return encryptPathValue(obj[head], tail, encryptValue);
}

function bytesToBinary(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

function binaryToBytes(binary: string): Uint8Array {
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function wrapSessionKeyWithRsa(
  publicKeyPem: string,
  sessionKey: Uint8Array
): Promise<Uint8Array> {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const encrypted = publicKey.encrypt(bytesToBinary(sessionKey), 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: {
      md: forge.md.sha1.create()
    }
  });
  return binaryToBytes(encrypted);
}

export async function encryptRequestBody(
  bodyText: string,
  config: CryptoForm,
  randomBytes: RandomBytes = defaultRandomBytes
): Promise<EncryptionResult> {
  if (!config.enabled) return { bodyText, headers: {} };
  if (config.algorithm === 'RSA_SM4' && config.scope === 'FIELD') {
    throw new Error('RSA+SM4 does not support field encryption');
  }

  const headers: Record<string, string> = {
    'X-Encrypt-Version': 'v1',
    'X-Encrypt-Mode': '1',
    'X-Encrypt-Alg': config.algorithm === 'SM4' ? '0' : '1'
  };

  if (config.algorithm === 'SM4') {
    const sm4Key = sm4KeyFromBase64(config.sm4KeyBase64);
    if (config.scope === 'WHOLE') {
      const env = encryptSm4GcmEnvelope(
        textEncoder.encode(bodyText),
        sm4Key,
        randomBytes(12)
      );
      return { bodyText: wrapWholeBody(encodeEnvelope(env)), headers };
    }
    const fields =
      config.fieldPaths?.map((item) => item.trim()).filter(Boolean) ?? [];
    if (fields.length === 0)
      throw new Error(
        'At least one field path is required for field encryption'
      );
    const root = JSON.parse(bodyText) as unknown;
    for (const fieldPath of fields) {
      const count = encryptPathValue(
        root,
        normalizeFieldPath(fieldPath),
        (plain) =>
          encodeEnvelope(
            encryptSm4GcmEnvelope(
              textEncoder.encode(plain),
              sm4Key,
              randomBytes(12)
            )
          )
      );
      if (count === 0)
        throw new Error('Field path did not match: ' + fieldPath);
    }
    return { bodyText: JSON.stringify(root), headers };
  }

  if (!config.rsaPublicKeyPem?.trim())
    throw new Error('RSA public key is required');
  const sessionKey = randomBytes(16);
  const env = encryptSm4GcmEnvelope(
    textEncoder.encode(bodyText),
    sessionKey,
    randomBytes(12)
  );
  const wrapped = await wrapSessionKeyWithRsa(
    config.rsaPublicKeyPem.trim(),
    sessionKey
  );
  headers['X-Encrypt-Key'] = toBase64Url(wrapped);
  headers['X-Encrypt-Key-Alg'] = 'RSA/ECB/OAEPWithSHA-256AndMGF1Padding';
  return { bodyText: wrapWholeBody(encodeEnvelope(env)), headers };
}
