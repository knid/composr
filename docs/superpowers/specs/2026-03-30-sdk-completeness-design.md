# Sub-project C: SDK Completeness — Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Depends on:** Nothing (foundation layer)
**Blocks:** Sub-projects A, B, D (they need data flowing)

---

## Overview

The SDK data pipeline is incomplete. The `assemblyLogs` table is never written to, metadata auto-capture is missing, the SDK client doesn't use SSE streaming, and there's no server-side compose endpoint. This sub-project fixes all four gaps so that downstream features (charts, dashboard stats, scoring) have real data to work with.

---

## C1: Write to `assemblyLogs` table

### Problem
The `assemblyLogs` table exists in the schema but no code writes to it. Dashboard stats like "Assemblies / 24h" are hardcoded placeholders.

### Solution
Write an assembly log entry from two locations:

1. **`POST /api/sdk/track`** — When a tracked assembly comes in, insert into `assemblyLogs` alongside the existing `scores` insert. The SDK will send `resolvedBlocks` and `tokenCount` as part of the track payload (it already has this data from `compose()`).

2. **`POST /api/v1/compose`** (new endpoint, see C4) — After server-side composition, write the assembly log directly.

### Changes

**SDK `TrackPayload` type** (`sdk/src/types.ts`):
- Add optional fields: `resolvedBlocks: string[]`, `tokenCount: number`

**SDK `client.ts`**:
- `track()` method: accept and forward `resolvedBlocks` and `tokenCount`

**`app/api/sdk/track/route.ts`**:
- After inserting into `scores`, also insert into `assemblyLogs` with: `teamId`, `compositionId`, `compositionVersion`, `environment`, `context`, `resolvedBlocks`, `variantId`, `tokenCount`

---

## C2: Auto-capture metadata

### Problem
The spec defines auto-captured metadata (`_req`, `_time`, `_env`, `_sdk`) that IF nodes can evaluate against. Currently none of this is auto-populated.

### Solution
Auto-inject metadata in the SDK's `compose()` method before calling the compose engine.

### Metadata mapping

| Prefix | Fields | Source |
|--------|--------|--------|
| `_time` | `hour`, `dayOfWeek`, `date`, `timestamp` | Generated from `Date.now()` at compose time |
| `_env` | `name` | From the client's configured `environment` |
| `_sdk` | `version`, `language` | From SDK `package.json` version; hardcoded `"typescript"` |
| `_req` | `ip`, `country`, `userId`, `userAgent` | Caller-provided via `_request` in context (SDK cannot auto-detect these) |

### Changes

**SDK `client.ts`**:
- In `compose()`, before calling the compose engine, build and merge auto-captured context:
  ```
  _time: { hour, dayOfWeek, date, timestamp }
  _env: { name: this.environment }
  _sdk: { version: SDK_VERSION, language: "typescript" }
  _req: { ...context._request }  // pass-through from caller
  ```
- Remove `_request` from context after mapping to `_req` (keep `_request` as deprecated alias)

**SDK `types.ts`**:
- Update `ComposeContext` to document `_request` as the input field

**Server-side (`app/api/v1/compose/route.ts`)** (see C4):
- Also inject `_time`, `_env`, `_sdk` before composition. For server-side compose, `_req` fields can be extracted from the HTTP request headers (IP from `x-forwarded-for`, userAgent from `user-agent`).

---

## C3: SSE streaming in the SDK client

### Problem
The server has `GET /api/sdk/stream/[env]` with SSE support, but the SDK client only polls with `setInterval`.

### Solution
After `initialize()` fetches the initial config, open an SSE connection for real-time updates. Fall back to polling when SSE isn't available.

### Changes

**SDK `client.ts`**:
- New private method `connectSSE()`:
  - Opens a connection to `${baseUrl}/api/sdk/stream/${environment}` with Bearer auth header
  - On `config_updated` event: calls `fetchConfig()` to refresh
  - On connection error: fall back to polling via `setInterval`
  - Stores the connection for cleanup
- `initialize()`: after `fetchConfig()`, call `connectSSE()` if `useSSE` is enabled
- `destroy()`: close SSE connection + clear any polling timer

**SDK `types.ts`**:
- Add `useSSE?: boolean` to `ComposrConfig` (default: `true` in browser via `typeof window !== "undefined"`, `false` in Node.js)

**Fallback strategy:**
- Browser: use native `EventSource` (widely supported)
- Node.js: default to polling. If `useSSE: true` is explicitly set, attempt SSE (works on Node 20+ which has native `EventSource`). If it fails, fall back to polling silently.
- When SSE is active, disable the polling timer to avoid redundant fetches

---

## C4: REST `POST /v1/compose` endpoint

### Problem
The spec defines `POST /v1/compose` for server-side composition (any language). Currently composition only happens in the SDK client.

### Solution
New API route that authenticates, resolves the composition by name, runs the graph engine, writes an assembly log, and returns the result.

### New file: `app/api/v1/compose/route.ts`

**Request:**
```json
{
  "composition": "builder",
  "context": { "projectType": "ecommerce", "hasAuth": true }
}
```

**Response:**
```json
{
  "id": "asm_<uuid>",
  "text": "assembled prompt string...",
  "version": "v14",
  "variantId": null,
  "tokenCount": 1234,
  "blocks": ["role", "framework-rules", "output-format"],
  "compositionName": "builder"
}
```

### Implementation details

1. **Auth:** Bearer API key, same `authenticateSDK` pattern as other SDK endpoints
2. **Rate limit:** Same as config endpoint (100 req/min per key)
3. **Resolve composition:** Look up by `name` (not ID) for the team. Respect deployed version for the API key's environment — if a deployment exists for that env, use that version's graph; otherwise use latest.
4. **Inject metadata:** Auto-inject `_time`, `_env` (`name` from the API key's environment), `_sdk` (`language: "rest"`, `version: "1"`). Extract `_req.ip` from `x-forwarded-for`, `_req.userAgent` from `user-agent` header.
5. **Compose:** Call `assembleGraph()` from `lib/graph-engine.ts` with the team's blocks and the resolved composition graph.
6. **Assembly log:** Insert into `assemblyLogs` table.
7. **Usage tracking:** Track as `"compose"` endpoint. Add `"compose"` to the usage page's aggregation (currently only handles `"config"`, `"track"`, `"score"`).
8. **Generate assembly ID:** UUID prefixed with `asm_` for easy identification.

### Changes to existing files

**`app/(app)/usage/page.tsx`:**
- Add `compose` to the endpoint aggregation alongside config/track/score

**`lib/usage.ts`:**
- No change needed (already accepts arbitrary endpoint strings)

---

## Files changed (summary)

| File | Change |
|------|--------|
| `sdk/src/types.ts` | Add `resolvedBlocks`, `tokenCount` to `TrackPayload`. Add `useSSE` to `ComposrConfig`. |
| `sdk/src/client.ts` | Auto-inject `_time`/`_env`/`_sdk` in `compose()`. Forward `resolvedBlocks`/`tokenCount` in `track()`. Add SSE connection with fallback. |
| `app/api/sdk/track/route.ts` | Insert into `assemblyLogs` after inserting into `scores`. |
| `app/api/v1/compose/route.ts` | **New file.** Server-side compose endpoint. |
| `app/(app)/usage/page.tsx` | Handle `"compose"` endpoint in aggregation. |

---

## Out of scope

- Python SDK (sub-project G)
- Dashboard wiring to assemblyLogs (sub-project B)
- Additional scorers (sub-project D)
- Any Phase 4 / Scale items
