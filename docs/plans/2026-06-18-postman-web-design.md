# postman-web Design

## Goal

Build a Next.js HTTP request page for the API gateway AK/SK protocol. The page lets a caller enter AK/SK, business routing headers, request data, and request encryption settings, then sends the request with the same order expected by the gateway: encrypt the request body first, sign the final body bytes, then send.

## Protocol Notes

- AK/SK headers follow `AK_SK鉴权方案设计文档.md`: `X-AK`, `X-Timestamp`, `X-Nonce`, `X-Sign-Algorithm`, and `X-Signature`.
- `CanonicalRequest` uses uppercase method, RFC3986 canonical URI, canonical query sorted by encoded key/value, AK, timestamp, nonce, and lowercase SHA-256 of the final request body bytes.
- `StringToSign` is `HmacSHA256 + "\n" + sha256Hex(CanonicalRequest)`.
- `X-Signature` is Base64 HMAC-SHA256 using SK bytes.
- `ApiKeyRoutingFilter` verifies the signature before calling `cryptoService.decryptRequest`, so encryption must happen before signing.
- Business routing headers exposed in the form are `X-Token`, `X-Order-Id`, and `X-Resource-Id`.
- Request encryption headers follow the gateway crypto implementation: `X-Encrypt-Version`, `X-Encrypt-Mode`, `X-Encrypt-Alg`, and, for RSA+SM4 whole-body mode, `X-Encrypt-Key`.
- Whole-body encryption sends JSON body `{"data":"ENCv1.<iv>.<ciphertext>.<tag>"}`.
- Field encryption replaces selected string fields with `ENCv1...` envelopes.
- RSA+SM4 field encryption is disabled because `FieldLevelProcessor` rejects it.

## UI Shape

The application is one work-focused page with a Claude/getdesign-inspired neutral surface: warm off-white page, charcoal text, restrained borders, amber accent, compact form groups, and code panels for generated request details. It uses shadcn-style local components and `react-hook-form` plus `zod` validation.
