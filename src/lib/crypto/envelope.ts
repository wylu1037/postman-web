import { fromBase64Url, toBase64Url } from './base64url';

export type Envelope = {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  tag: Uint8Array;
  wrappedSessionKey?: Uint8Array;
};

export function encodeEnvelope(envelope: Envelope): string {
  return 'ENCv1.' + toBase64Url(envelope.iv) + '.' + toBase64Url(envelope.ciphertext) + '.' + toBase64Url(envelope.tag);
}

export function decodeEnvelope(encoded: string): Envelope {
  if (!encoded.startsWith('ENCv1.')) throw new Error('Invalid ENCv1 envelope');
  const parts = encoded.slice('ENCv1.'.length).split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) throw new Error('Invalid ENCv1 envelope');
  return { iv: fromBase64Url(parts[0]), ciphertext: fromBase64Url(parts[1]), tag: fromBase64Url(parts[2]) };
}

export function wrapWholeBody(encodedEnvelope: string): string {
  return JSON.stringify({ data: encodedEnvelope });
}
