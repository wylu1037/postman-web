# postman-web

A Next.js HTTP request page for the API Gateway AK/SK protocol.

## What It Does

- Accepts AK/SK and business routing headers: X-Token, X-Order-Id, X-Resource-Id.
- Supports plain, SM4, and RSA+SM4 request encryption.
- Supports whole-body encryption and SM4 JSON field encryption.
- Blocks RSA+SM4 field encryption because the gateway V1 protocol does not support it.
- Encrypts the request body before generating X-Signature.
- Shows CanonicalRequest, StringToSign, final headers, final body, and response.

## Commands

    npm install
    npm test -- --run
    npm run lint
    npm run build
    npm run dev

## Notes

The visual style is tuned toward the getdesign add claude direction: warm neutral page, compact panels, quiet borders, and dark code previews. The CLI could not be run in this sandbox until npm network access is approved.
