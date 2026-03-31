# Batch 3: Scale & Operations — Webhooks, Improved Search, Composition Folders

**Date:** 2026-04-01
**Status:** Approved
**Scope:** 2 features that support adoption and growth as teams scale past 20+ blocks and compositions.

## Problem

As teams add more prompts to Composr, two pain points emerge: (1) no visibility into changes — when someone deploys to prod, the rest of the team doesn't know, and (2) finding things gets hard — search only matches block names, compositions have an unused folder field.

## Solution Overview

1. **Generic Webhooks** — POST to any URL when configurable events happen (deploys, edits, etc.)
2. **Improved Search + Composition Folders** — search across name/description/content, surface the existing folder field on compositions

---

## 1. Webhooks

### Schema

**New table: `webhooks`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| teamId | text | FK → teams.id |
| url | text | Webhook endpoint URL |
| events | jsonb | Array of event names, e.g. `["deployment.promoted", "block.updated"]` |
| enabled | boolean | Default true, toggle without deleting |
| secret | text | Optional HMAC-SHA256 secret for payload verification |
| createdAt | timestamp | Creation time |

### Supported Events

Reuse existing audit log action names:
- `block.created`
- `block.updated`
- `block.deleted`
- `composition.updated`
- `deployment.promoted`
- `deployment.review_requested`

### Delivery

A `fireWebhooks()` function in `lib/webhooks.ts`:
1. Queries the `webhooks` table for the team, filtered by `enabled = true`
2. Filters webhooks whose `events` array includes the current event
3. For each matching webhook, fires an async `fetch()` POST — fire-and-forget
4. If `secret` is configured, adds an `X-Composr-Signature` header with HMAC-SHA256 of the JSON body
5. Failures are logged to console, not retried

Called from `logAudit()` — after writing the audit log entry, call `fireWebhooks()` with the same event data. This ensures every auditable action can trigger webhooks without adding webhook calls to every API route.

### Payload Format

```json
{
  "event": "deployment.promoted",
  "timestamp": "2026-04-01T12:00:00Z",
  "teamId": "org_...",
  "resource": {
    "type": "deployment",
    "id": "uuid",
    "metadata": { "environment": "prod", "version": 5 }
  }
}
```

### API Routes

- `GET /api/webhooks` — list webhooks for team (Clerk-auth)
- `POST /api/webhooks` — create webhook (url, events, secret optional)
- `PUT /api/webhooks/[id]` — update webhook (toggle enabled, change events/url)
- `DELETE /api/webhooks/[id]` — delete webhook

### UI

Settings page gets a "Webhooks" section (new component `components/settings/webhooks.tsx`):
- List of configured webhooks: URL (truncated), event badges, enabled toggle, delete button
- "Add Webhook" button opens a dialog with:
  - URL input
  - Event checkboxes (multi-select from supported events list)
  - Optional secret input
- Edit inline: toggle enabled, click to edit URL/events

---

## 2. Improved Search + Composition Folders

### Block Search

In `components/blocks/block-list.tsx`, update the `filtered` logic to search across `name`, `description`, and `content`:

```typescript
const matchesSearch = !search || [b.name, b.description, b.content]
  .filter(Boolean)
  .some(field => field!.toLowerCase().includes(search.toLowerCase()))
```

No new API, no server-side search. Blocks are already loaded client-side.

### Composition Search

In the compositions list page, extend search to also match `description` (same pattern).

### Composition Folders

The `compositions` table already has a `folder` text column (nullable). Changes:

**Compositions list page:**
1. Add a folder filter dropdown populated from `distinct(folder)` of loaded compositions
2. Show folder as a subtle label/badge on each composition card
3. Filter compositions by selected folder

**Composition create/edit:**
1. Add a "Folder" input field to the new composition dialog
2. Support changing folder in the composition editor (either in properties or toolbar)

Folders are free-form text — users type any string. No folder management UI (create/rename/delete). The dropdown auto-populates from existing folder values.

---

## Files to Create or Modify

### New Files
| File | Responsibility |
|------|---------------|
| `lib/webhooks.ts` | `fireWebhooks()` function + HMAC signing |
| `lib/webhooks.test.ts` | Tests for webhook matching and signing |
| `app/api/webhooks/route.ts` | List/create webhooks |
| `app/api/webhooks/[id]/route.ts` | Update/delete webhook |
| `components/settings/webhooks.tsx` | Webhook management UI |

### Modified Files
| File | Changes |
|------|---------|
| `lib/schema.ts` | Add `webhooks` table |
| `lib/audit.ts` | Call `fireWebhooks()` after logging |
| `app/(app)/settings/page.tsx` | Add Webhooks section |
| `components/blocks/block-list.tsx` | Expand search to description + content |
| `app/(app)/compositions/page.tsx` | Pass folder data to client component |
| `components/compositions/composition-list.tsx` | New client component with folder filter + search (extracted from page) |
| `components/compositions/new-composition-button.tsx` | Add folder field |

---

## What's NOT in Scope

- Migration CLI (user decided to skip — bulk import API already exists)
- Retry queue / delivery tracking for webhooks
- Server-side full-text search (client-side is sufficient at current scale)
- Folder CRUD (folders are free-form strings, no management UI)
