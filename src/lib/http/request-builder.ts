import { signAkSk } from '@/lib/aksk/sign';
import {
  encryptRequestBody,
  type CryptoForm
} from '@/lib/crypto/body-encryption';

const textEncoder = new TextEncoder();
const omittedHeaderNames = new Set([
  'x-encrypt-version',
  'x-encrypt-mode',
  'x-encrypt-alg'
]);

export type ExtraHeader = { key: string; value: string };

export type GatewayRequestInput = {
  method: string;
  url: string;
  ak: string;
  sk: string;
  token: string;
  orderId: string;
  resourceId: string;
  body: string;
  extraHeaders: ExtraHeader[];
  crypto: CryptoForm;
  timestampMillis?: number;
  nonce?: string;
  randomBytes?: (length: number) => Uint8Array;
};

export type BuiltGatewayRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyText: string;
  debug: {
    canonicalRequest: string;
    stringToSign: string;
    bodyHash: string;
    encrypted: boolean;
  };
};

function makeNonce(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    ''
  );
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20)
  );
}

function normalizeExtraHeaders(headers: ExtraHeader[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const header of headers) {
    const key = header.key.trim();
    if (!key) continue;
    out[key] = header.value;
  }
  return out;
}

function omitHeaders(
  headers: Record<string, string>,
  names: Set<string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!names.has(key.toLowerCase())) out[key] = value;
  }
  return out;
}

export async function buildGatewayRequest(
  input: GatewayRequestInput
): Promise<BuiltGatewayRequest> {
  if (!input.url.trim()) throw new Error('Request URL is required');
  if (!input.ak.trim()) throw new Error('AK is required');
  if (!input.sk.trim()) throw new Error('SK is required');
  if (!input.token.trim()) throw new Error('X-Token is required');
  if (!input.orderId.trim()) throw new Error('X-Order-Id is required');
  if (!input.resourceId.trim()) throw new Error('X-Resource-Id is required');

  const method = input.method.toUpperCase();
  const hasRequestBody = method !== 'GET' && method !== 'HEAD';
  const encrypted = hasRequestBody
    ? await encryptRequestBody(input.body, input.crypto, input.randomBytes)
    : { bodyText: '', headers: {} };
  const timestampMillis = input.timestampMillis ?? Date.now();
  const nonce = input.nonce ?? makeNonce();
  const signature = await signAkSk({
    method,
    url: input.url,
    accessKey: input.ak,
    secretKey: input.sk,
    timestampMillis,
    nonce,
    body: textEncoder.encode(encrypted.bodyText)
  });

  const headers: Record<string, string> = {
    ...normalizeExtraHeaders(input.extraHeaders),
    'X-Token': input.token,
    'X-Order-Id': input.orderId,
    'X-Resource-Id': input.resourceId,
    ...omitHeaders(encrypted.headers, omittedHeaderNames),
    'X-AK': input.ak,
    'X-Timestamp': String(timestampMillis),
    'X-Nonce': nonce,
    'X-Sign-Algorithm': 'HmacSHA256',
    'X-Signature': signature.signature
  };
  if (
    encrypted.bodyText &&
    !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
  ) {
    headers['Content-Type'] = 'application/json';
  }

  return {
    method,
    url: input.url,
    headers,
    bodyText: encrypted.bodyText,
    debug: {
      canonicalRequest: signature.canonicalRequest,
      stringToSign: signature.stringToSign,
      bodyHash: signature.bodyHash,
      encrypted: input.crypto.enabled
    }
  };
}
