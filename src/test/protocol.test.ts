import { describe, expect, it } from 'vitest';
import { canonicalQuery, canonicalUri, sha256Hex } from '@/lib/aksk/canonical';
import { signAkSk } from '@/lib/aksk/sign';
import { decryptResponseBody } from '@/lib/crypto/body-decryption';
import { decodeEnvelope, encodeEnvelope } from '@/lib/crypto/envelope';
import { decryptSm4GcmEnvelope, encryptSm4GcmEnvelope } from '@/lib/crypto/sm4';
import { buildGatewayRequest } from '@/lib/http/request-builder';

const enc = new TextEncoder();

const sm4Key = Uint8Array.from([
  0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xfe, 0xdc, 0xba, 0x98, 0x76,
  0x54, 0x32, 0x10
]);
const iv = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

describe('AK/SK canonical signing', () => {
  it('sorts and encodes query by RFC3986 without treating plus as space', () => {
    expect(
      canonicalQuery(
        'z=1&fields=id,status&page=1&a=hello%20world&a=*~&plus=a+b'
      )
    ).toBe('a=%2A~&a=hello%20world&fields=id%2Cstatus&page=1&plus=a%2Bb&z=1');
  });

  it('normalizes uri while preserving path separators', () => {
    expect(canonicalUri('/api/订单 1/detail')).toBe(
      '/api/%E8%AE%A2%E5%8D%95%201/detail'
    );
  });

  it('builds canonical request and HMAC signature over final body bytes', async () => {
    const body = enc.encode('{"orderId":"123","amount":100}');
    const result = await signAkSk({
      method: 'POST',
      url: 'https://api.example.com/v1/orders?type=normal&status=paid',
      accessKey: 'AKi1BymWreaKPMPylmBmeStN',
      secretKey: 'FG6WN6EX8jcLm0RG8Jj7GeKdPBF9O7Y5aXkVlCGnv1A',
      timestampMillis: 1715731200123,
      nonce: 'c9f15cbf-f4ac-4a6c-b54d-f51abf4b5b44',
      body
    });

    expect(result.canonicalRequest).toBe(
      [
        'POST',
        '/v1/orders',
        'status=paid&type=normal',
        'AKi1BymWreaKPMPylmBmeStN',
        '1715731200123',
        'c9f15cbf-f4ac-4a6c-b54d-f51abf4b5b44',
        await sha256Hex(body)
      ].join('\n')
    );
    expect(result.stringToSign).toMatch(/^HmacSHA256\n[0-9a-f]{64}$/);
    expect(result.signature).toMatch(/^[A-Za-z0-9+/]{43}=$/);
  });
});

describe('request encryption', () => {
  it('SM4-GCM envelope round-trips and uses the gateway ENCv1 shape', () => {
    const envelope = encryptSm4GcmEnvelope(
      enc.encode('{"name":"wen"}'),
      sm4Key,
      iv
    );
    const encoded = encodeEnvelope(envelope);
    const decoded = decodeEnvelope(encoded);
    const plain = decryptSm4GcmEnvelope(decoded, sm4Key);

    expect(encoded).toMatch(
      /^ENCv1.[A-Za-z0-9_-]+.[A-Za-z0-9_-]+.[A-Za-z0-9_-]+$/
    );
    expect(new TextDecoder().decode(plain)).toBe('{"name":"wen"}');
  });

  it('builds a whole-body encrypted request before signing with encryption metadata headers', async () => {
    const built = await buildGatewayRequest({
      method: 'POST',
      url: 'https://gateway.local/api-gateway/apiHub?b=2&a=1',
      ak: 'ak-demo',
      sk: 'sk-demo-32-byte-secret-value-0001',
      token: 'token-demo',
      orderId: 'order-7',
      resourceId: 'resource-9',
      body: '{"mobile":"13800000000"}',
      extraHeaders: [{ key: 'Content-Type', value: 'application/json' }],
      crypto: {
        enabled: true,
        algorithm: 'SM4',
        scope: 'WHOLE',
        sm4KeyBase64: Buffer.from(sm4Key).toString('base64')
      },
      timestampMillis: 1715731200123,
      nonce: 'fixed-nonce-for-test',
      randomBytes: (length) => iv.slice(0, length)
    });

    expect(built.headers['X-Encrypt-Version']).toBe('v1');
    expect(built.headers['X-Encrypt-Mode']).toBe('1');
    expect(built.headers['X-Encrypt-Alg']).toBe('0');
    expect(built.headers['X-Signature']).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(JSON.parse(built.bodyText)).toEqual({
      data: expect.stringMatching(/^ENCv1./)
    });
    expect(built.debug.canonicalRequest).toContain(
      await sha256Hex(enc.encode(built.bodyText))
    );
  });

  it('does not encrypt or send a body for GET requests', async () => {
    const built = await buildGatewayRequest({
      method: 'GET',
      url: 'https://gateway.local/api-gateway/apiHub?b=2&a=1',
      ak: 'ak-demo',
      sk: 'sk-demo-32-byte-secret-value-0001',
      token: 'token-demo',
      orderId: 'order-7',
      resourceId: 'resource-9',
      body: '{"mobile":"13800000000"}',
      extraHeaders: [],
      crypto: {
        enabled: true,
        algorithm: 'SM4',
        scope: 'WHOLE',
        sm4KeyBase64: Buffer.from(sm4Key).toString('base64')
      },
      timestampMillis: 1715731200123,
      nonce: 'fixed-nonce-for-test',
      randomBytes: () => {
        throw new Error('GET requests must not encrypt a body');
      }
    });

    expect(built.bodyText).toBe('');
    expect(built.headers['Content-Type']).toBeUndefined();
    expect(built.debug.bodyHash).toBe(await sha256Hex(enc.encode('')));
    expect(built.debug.canonicalRequest).toContain(
      '\n' + (await sha256Hex(enc.encode('')))
    );
  });

  it('rejects RSA+SM4 field encryption because the gateway does not support it', async () => {
    await expect(
      buildGatewayRequest({
        method: 'POST',
        url: 'https://gateway.local/api-gateway/apiHub',
        ak: 'ak',
        sk: 'sk',
        token: 'token',
        orderId: 'order',
        resourceId: 'resource',
        body: '{"name":"plain"}',
        extraHeaders: [],
        crypto: {
          enabled: true,
          algorithm: 'RSA_SM4',
          scope: 'FIELD',
          rsaPublicKeyPem:
            '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtest\n-----END PUBLIC KEY-----',
          fieldPaths: ['name']
        }
      })
    ).rejects.toThrow('RSA+SM4 does not support field encryption');
  });

  it('decrypts whole-body response data with the configured SM4 key', () => {
    const encrypted = encodeEnvelope(
      encryptSm4GcmEnvelope(enc.encode('{"ok":true}'), sm4Key, iv)
    );

    expect(
      decryptResponseBody(
        JSON.stringify({ data: encrypted }),
        Buffer.from(sm4Key).toString('base64')
      )
    ).toEqual({
      bodyText: '{"ok":true}',
      decryptedCount: 1,
      mode: 'whole'
    });
  });

  it('decrypts field-level ENCv1 values in response JSON', () => {
    const mobile = encodeEnvelope(
      encryptSm4GcmEnvelope(enc.encode('13800000000'), sm4Key, iv)
    );

    expect(
      decryptResponseBody(
        JSON.stringify({ user: { mobile }, status: 'ok' }),
        Buffer.from(sm4Key).toString('base64')
      )
    ).toEqual({
      bodyText: JSON.stringify({ user: { mobile: '13800000000' }, status: 'ok' }),
      decryptedCount: 1,
      mode: 'field'
    });
  });
});
