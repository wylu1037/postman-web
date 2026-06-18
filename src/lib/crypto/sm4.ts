import type { Envelope } from './envelope';

const SBOX = [
  0xd6, 0x90, 0xe9, 0xfe, 0xcc, 0xe1, 0x3d, 0xb7, 0x16, 0xb6, 0x14, 0xc2, 0x28,
  0xfb, 0x2c, 0x05, 0x2b, 0x67, 0x9a, 0x76, 0x2a, 0xbe, 0x04, 0xc3, 0xaa, 0x44,
  0x13, 0x26, 0x49, 0x86, 0x06, 0x99, 0x9c, 0x42, 0x50, 0xf4, 0x91, 0xef, 0x98,
  0x7a, 0x33, 0x54, 0x0b, 0x43, 0xed, 0xcf, 0xac, 0x62, 0xe4, 0xb3, 0x1c, 0xa9,
  0xc9, 0x08, 0xe8, 0x95, 0x80, 0xdf, 0x94, 0xfa, 0x75, 0x8f, 0x3f, 0xa6, 0x47,
  0x07, 0xa7, 0xfc, 0xf3, 0x73, 0x17, 0xba, 0x83, 0x59, 0x3c, 0x19, 0xe6, 0x85,
  0x4f, 0xa8, 0x68, 0x6b, 0x81, 0xb2, 0x71, 0x64, 0xda, 0x8b, 0xf8, 0xeb, 0x0f,
  0x4b, 0x70, 0x56, 0x9d, 0x35, 0x1e, 0x24, 0x0e, 0x5e, 0x63, 0x58, 0xd1, 0xa2,
  0x25, 0x22, 0x7c, 0x3b, 0x01, 0x21, 0x78, 0x87, 0xd4, 0x00, 0x46, 0x57, 0x9f,
  0xd3, 0x27, 0x52, 0x4c, 0x36, 0x02, 0xe7, 0xa0, 0xc4, 0xc8, 0x9e, 0xea, 0xbf,
  0x8a, 0xd2, 0x40, 0xc7, 0x38, 0xb5, 0xa3, 0xf7, 0xf2, 0xce, 0xf9, 0x61, 0x15,
  0xa1, 0xe0, 0xae, 0x5d, 0xa4, 0x9b, 0x34, 0x1a, 0x55, 0xad, 0x93, 0x32, 0x30,
  0xf5, 0x8c, 0xb1, 0xe3, 0x1d, 0xf6, 0xe2, 0x2e, 0x82, 0x66, 0xca, 0x60, 0xc0,
  0x29, 0x23, 0xab, 0x0d, 0x53, 0x4e, 0x6f, 0xd5, 0xdb, 0x37, 0x45, 0xde, 0xfd,
  0x8e, 0x2f, 0x03, 0xff, 0x6a, 0x72, 0x6d, 0x6c, 0x5b, 0x51, 0x8d, 0x1b, 0xaf,
  0x92, 0xbb, 0xdd, 0xbc, 0x7f, 0x11, 0xd9, 0x5c, 0x41, 0x1f, 0x10, 0x5a, 0xd8,
  0x0a, 0xc1, 0x31, 0x88, 0xa5, 0xcd, 0x7b, 0xbd, 0x2d, 0x74, 0xd0, 0x12, 0xb8,
  0xe5, 0xb4, 0xb0, 0x89, 0x69, 0x97, 0x4a, 0x0c, 0x96, 0x77, 0x7e, 0x65, 0xb9,
  0xf1, 0x09, 0xc5, 0x6e, 0xc6, 0x84, 0x18, 0xf0, 0x7d, 0xec, 0x3a, 0xdc, 0x4d,
  0x20, 0x79, 0xee, 0x5f, 0x3e, 0xd7, 0xcb, 0x39, 0x48
];
const FK = [0xa3b1bac6, 0x56aa3350, 0x677d9197, 0xb27022dc];
const CK = [
  0x00070e15, 0x1c232a31, 0x383f464d, 0x545b6269, 0x70777e85, 0x8c939aa1,
  0xa8afb6bd, 0xc4cbd2d9, 0xe0e7eef5, 0xfc030a11, 0x181f262d, 0x343b4249,
  0x50575e65, 0x6c737a81, 0x888f969d, 0xa4abb2b9, 0xc0c7ced5, 0xdce3eaf1,
  0xf8ff060d, 0x141b2229, 0x30373e45, 0x4c535a61, 0x686f767d, 0x848b9299,
  0xa0a7aeb5, 0xbcc3cad1, 0xd8dfe6ed, 0xf4fb0209, 0x10171e25, 0x2c333a41,
  0x484f565d, 0x646b7279
];
const R = 0xe1000000000000000000000000000000n;

function rotl(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}
function tau(x: number): number {
  return (
    ((SBOX[x >>> 24] << 24) |
      (SBOX[(x >>> 16) & 255] << 16) |
      (SBOX[(x >>> 8) & 255] << 8) |
      SBOX[x & 255]) >>>
    0
  );
}
function l(x: number): number {
  return (x ^ rotl(x, 2) ^ rotl(x, 10) ^ rotl(x, 18) ^ rotl(x, 24)) >>> 0;
}
function lp(x: number): number {
  return (x ^ rotl(x, 13) ^ rotl(x, 23)) >>> 0;
}
function read32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}
function write32(out: Uint8Array, offset: number, value: number): void {
  out[offset] = value >>> 24;
  out[offset + 1] = (value >>> 16) & 255;
  out[offset + 2] = (value >>> 8) & 255;
  out[offset + 3] = value & 255;
}
function roundKeys(key: Uint8Array): number[] {
  if (key.length !== 16) throw new Error('SM4 key must be 16 bytes');
  const k = [
    read32(key, 0) ^ FK[0],
    read32(key, 4) ^ FK[1],
    read32(key, 8) ^ FK[2],
    read32(key, 12) ^ FK[3]
  ];
  const rk: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    const next =
      (k[i] ^ lp(tau((k[i + 1] ^ k[i + 2] ^ k[i + 3] ^ CK[i]) >>> 0))) >>> 0;
    k.push(next);
    rk.push(next);
  }
  return rk;
}
export function sm4EncryptBlock(
  block: Uint8Array,
  key: Uint8Array
): Uint8Array {
  if (block.length !== 16) throw new Error('SM4 block must be 16 bytes');
  const rk = roundKeys(key);
  const x = [
    read32(block, 0),
    read32(block, 4),
    read32(block, 8),
    read32(block, 12)
  ];
  for (let i = 0; i < 32; i += 1)
    x.push(
      (x[i] ^ l(tau((x[i + 1] ^ x[i + 2] ^ x[i + 3] ^ rk[i]) >>> 0))) >>> 0
    );
  const out = new Uint8Array(16);
  write32(out, 0, x[35]);
  write32(out, 4, x[34]);
  write32(out, 8, x[33]);
  write32(out, 12, x[32]);
  return out;
}
function inc32(counter: Uint8Array): Uint8Array {
  const out = new Uint8Array(counter);
  for (let i = 15; i >= 12; i -= 1) {
    out[i] = (out[i] + 1) & 255;
    if (out[i] !== 0) break;
  }
  return out;
}
function xorBlock(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) out[i] = a[i] ^ b[i];
  return out;
}
function bytesToBigInt(bytes: Uint8Array): bigint {
  let out = 0n;
  for (const byte of bytes) out = (out << 8n) | BigInt(byte);
  return out;
}
function bigIntToBlock(value: bigint): Uint8Array {
  const out = new Uint8Array(16);
  for (let i = 15; i >= 0; i -= 1) {
    out[i] = Number(value & 255n);
    value >>= 8n;
  }
  return out;
}
function gfMul(x: bigint, y: bigint): bigint {
  let z = 0n;
  let v = y;
  for (let i = 0; i < 128; i += 1) {
    if (((x >> BigInt(127 - i)) & 1n) === 1n) z ^= v;
    v = (v & 1n) === 0n ? v >> 1n : (v >> 1n) ^ R;
  }
  return z;
}
function pad16(bytes: Uint8Array): Uint8Array {
  if (bytes.length % 16 === 0) return bytes;
  const out = new Uint8Array(bytes.length + (16 - (bytes.length % 16)));
  out.set(bytes);
  return out;
}
function ghash(h: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  const hInt = bytesToBigInt(h);
  let y = 0n;
  const padded = pad16(ciphertext);
  for (let offset = 0; offset < padded.length; offset += 16)
    y = gfMul(y ^ bytesToBigInt(padded.slice(offset, offset + 16)), hInt);
  const len = new Uint8Array(16);
  let cBits = BigInt(ciphertext.length) * 8n;
  for (let i = 15; i >= 8; i -= 1) {
    len[i] = Number(cBits & 255n);
    cBits >>= 8n;
  }
  y = gfMul(y ^ bytesToBigInt(len), hInt);
  return bigIntToBlock(y);
}
export function encryptSm4GcmEnvelope(
  plain: Uint8Array,
  key: Uint8Array,
  iv?: Uint8Array
): Envelope {
  const actualIv = iv ?? crypto.getRandomValues(new Uint8Array(12));
  if (actualIv.length !== 12) throw new Error('SM4-GCM IV must be 12 bytes');
  const h = sm4EncryptBlock(new Uint8Array(16), key);
  const j0 = new Uint8Array(16);
  j0.set(actualIv);
  j0[15] = 1;
  let counter = inc32(j0);
  const ciphertext = new Uint8Array(plain.length);
  for (let offset = 0; offset < plain.length; offset += 16) {
    const stream = sm4EncryptBlock(counter, key);
    const chunk = plain.slice(offset, Math.min(offset + 16, plain.length));
    for (let i = 0; i < chunk.length; i += 1)
      ciphertext[offset + i] = chunk[i] ^ stream[i];
    counter = inc32(counter);
  }
  const tag = xorBlock(sm4EncryptBlock(j0, key), ghash(h, ciphertext));
  return { iv: actualIv, ciphertext, tag };
}
export function decryptSm4GcmEnvelope(
  envelope: Envelope,
  key: Uint8Array
): Uint8Array {
  const h = sm4EncryptBlock(new Uint8Array(16), key);
  const j0 = new Uint8Array(16);
  j0.set(envelope.iv);
  j0[15] = 1;
  const expectedTag = xorBlock(
    sm4EncryptBlock(j0, key),
    ghash(h, envelope.ciphertext)
  );
  if (expectedTag.some((byte, index) => byte !== envelope.tag[index]))
    throw new Error('SM4-GCM tag mismatch');
  let counter = inc32(j0);
  const plain = new Uint8Array(envelope.ciphertext.length);
  for (let offset = 0; offset < envelope.ciphertext.length; offset += 16) {
    const stream = sm4EncryptBlock(counter, key);
    const chunk = envelope.ciphertext.slice(
      offset,
      Math.min(offset + 16, envelope.ciphertext.length)
    );
    for (let i = 0; i < chunk.length; i += 1)
      plain[offset + i] = chunk[i] ^ stream[i];
    counter = inc32(counter);
  }
  return plain;
}
