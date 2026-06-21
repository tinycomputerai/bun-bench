# Confused-Deputy Safe Act-As Delegation

Build a Bun HTTP service that lets authenticated users perform actions on behalf of
other principals using signed delegation tokens. Effective authority must be the
**intersection** of caller scopes, delegated scopes, chain narrowing, principal
scopes, and resource policy — never the deputy's ambient privileges alone.

## Requirements

- Listen on the port provided by `PORT`.
- State is kept in memory.
- Return JSON for every response.

### Authentication

Bearer tokens (fixed for this task):

| Token        | User   | Scopes             |
| ------------ | ------ | ------------------ |
| `tok-admin`  | admin  | read, write, admin |
| `tok-editor` | editor | read, write        |
| `tok-viewer` | viewer | read               |

Pre-seeded resource `res-1` is owned by **editor**.

Resource write policy: allowed when effective scopes include `write` and either
`admin` or the resource **owner equals the delegation principal** (not the deputy).

### Endpoints

`GET /healthz` → `200` `{ "ok": true }`.

`GET /audit` → `200` `{ "entries": [...] }` audit log of act-as attempts.

`POST /resources` — create a resource (authenticated).

- Body: `{ "title": string }`.
- Owner is `admin` when caller is admin, otherwise `editor`.
- Success → `201` with `{ "id", "owner", "title" }`.

`POST /delegations` — mint a signed delegation token (authenticated).

- Body: `{ "principal": string, "scopes": string[], "chain"?: string[] }`.
- Caller must possess every requested scope or → `403`.
- Success → `201` `{ "id", "token" }`.

`POST /act-as` — perform an action under delegation.

- Header: `X-Delegation-Token: <signed token>`.
- Body: `{ "action": "read"|"write", "resource_id": string }`.
- Effective scopes = caller scopes ∩ delegated scopes ∩ each chain user's scopes ∩
  principal's scopes.
- Deny → `403`. Log every attempt in audit with `{ deputy, principal, action, resource_id, allowed }`.
- Allow → `200` `{ "ok": true, "resource", "acted_as", "deputy", "effective_scopes" }`.

`POST /delegations/:id/revoke` — revoke a delegation by id → `200` `{ "revoked": true }`.

## Notes

- Delegation chains may only **narrow** authority.
- Revoked or invalid delegations → `403`.
- Do not expose stack traces.
