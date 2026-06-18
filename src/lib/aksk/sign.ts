import {
  bodyBytes,
  canonicalQuery,
  canonicalUri,
  sha256Hex
} from './canonical';

const textEncoder = new TextEncoder();

declare const Buffer: {
  from(
    input: Uint8Array | string,
    encoding?: string
  ): { toString(encoding: string): string };
};

export type SignInput = {
  method: string;
  url: string;
  accessKey: string;
  secretKey: string;
  timestampMillis: number;
  nonce: string;
  body?: string | Uint8Array | null;
  algorithm?: 'HmacSHA256';
};

export type SignOutput = {
  signature: string;
  canonicalRequest: string;
  stringToSign: string;
  bodyHash: string;
};

function base64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export async function buildCanonicalRequest(
  input: Omit<SignInput, 'secretKey'>
): Promise<{ canonicalRequest: string; bodyHash: string }> {
  const parsed = new URL(input.url);
  const bodyHash = await sha256Hex(bodyBytes(input.body));
  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri(parsed.pathname),
    canonicalQuery(parsed.search ? parsed.search.slice(1) : ''),
    input.accessKey,
    String(input.timestampMillis),
    input.nonce,
    bodyHash
  ].join('\n');
  return { canonicalRequest, bodyHash };
}

export async function signAkSk(input: SignInput): Promise<SignOutput> {
  const algorithm = input.algorithm ?? 'HmacSHA256';
  const { canonicalRequest, bodyHash } = await buildCanonicalRequest({
    ...input,
    algorithm
  });
  const canonicalHash = await sha256Hex(canonicalRequest);
  const stringToSign = algorithm + '\n' + canonicalHash;
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(input.secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(stringToSign)
  );
  return {
    signature: base64(new Uint8Array(mac)),
    canonicalRequest,
    stringToSign,
    bodyHash
  };
}
