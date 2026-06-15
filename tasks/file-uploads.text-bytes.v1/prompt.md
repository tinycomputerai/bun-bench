# Text Upload Byte Counter

Implement a Bun HTTP service that counts uploaded text bytes.

## Requirements

- Listen on the port provided by `PORT`.
- `POST /upload` accepts only `text/plain` request bodies.
- A valid request returns HTTP 200 with:

```json
{ "bytes": 5 }
```

- Count UTF-8 bytes, not JavaScript string characters.
- Missing or non-text content types return HTTP 415 with:

```json
{ "error": "unsupported_media_type" }
```
