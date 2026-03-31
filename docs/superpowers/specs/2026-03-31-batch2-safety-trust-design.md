# Batch 2: Safety & Trust — Impact Analysis, Prompt Diff, Approval Gate

**Date:** 2026-03-31
**Status:** Approved
**Scope:** 3 features that make teams trust remote prompt editing enough to move all their prompts into Composr.

## Problem

Teams hesitate to move production prompts into Composr because there's no safety net. You can't see what a block change will affect, you can't compare versions visually, and anyone can push to prod without a second pair of eyes.

## Solution Overview

Three features, all query-driven on existing data:

1. **Impact Analysis** — see which compositions use a block before editing it
2. **Prompt Diff** — side-by-side text diff between composition versions
3. **Soft Approval Gate** — diff preview + confirmation + optional review request when deploying to prod

## Implementation Approach

Query-driven — no new tables, no new schema migrations (except possibly a lightweight one). All three features are read-side UI work on existing data. Vertical slices in this order.

---

## 1. Impact Analysis

### API

**`GET /api/blocks/[id]/usage`** — Clerk-authenticated.

Scans all team compositions' `graph.nodes` for nodes where `data.blockId === id`. Also checks tool nodes. Returns:

```json
[
  {
    "compositionId": "uuid",
    "compositionName": "onboarding",
    "nodeCount": 2,
    "environments": ["dev", "prod"]
  }
]
```

The `environments` field comes from joining with the `deployments` table to find which environments this composition is deployed to. This powers the "used in production" warning.

### UI — Block Card

The block card already shows `usedIn` count via the `usageMap` prop. No changes needed here — it already works.

### UI — Block Edit Dialog

In the block edit dialog (`components/blocks/block-list.tsx`), add a "Used in" section at the top:

- Fetch `GET /api/blocks/[id]/usage` when the edit dialog opens
- Show a list of composition names as clickable links to `/compositions/[id]`
- If any composition is deployed to prod, show a warning: "Used in N production compositions — changes take effect on next SDK sync"
- Warning styled with amber border and icon, similar to the existing "copy key" warning in settings

### Data Flow

1. Block list page already builds `usageMap` by scanning compositions client-side — this continues to power the card counts
2. Block edit dialog makes a server-side call for detailed info (composition names, deployed environments)
3. No new tables, no precomputation — scan is fast for <100 compositions

---

## 2. Prompt Diff

### Approach

The composition version history dialog already exists and shows all versions with their graphs. We add the ability to select two versions and see a side-by-side text diff.

### Diff Logic

A client-side line diff utility (`lib/diff.ts`) that takes two strings and returns an array of `{ type: "added" | "removed" | "unchanged", text: string }` lines. Simple LCS-based algorithm, no external library.

The diff input is assembled prompt text. For each selected version, call `POST /api/compositions/[id]/assemble` with the version's graph to get the assembled text server-side. Then diff the two texts client-side. This reuses the existing `assembleGraph()` function without exposing it to the client.

### UI Changes — Version History Dialog

The existing version history dialog (in `composition-editor.tsx`) currently shows a list of versions with "Restore" buttons. Changes:

1. Add a checkbox/radio on each version row for selection
2. When exactly 2 versions are selected, show a "Compare" button
3. Clicking Compare renders a diff view below the version list:
   - Side-by-side layout: left = older version (red highlights for removals), right = newer version (green highlights for additions)
   - Header showing "v3 → v5" with timestamps
   - If model config changed between versions (in metadata), show a text line: "Model: claude-haiku → claude-sonnet"
4. "Close diff" button to return to the version list

### Diff Component

New component `components/editor/version-diff.tsx`:
- Props: `leftText`, `rightText`, `leftLabel`, `rightLabel`
- Renders a split-pane with colored line highlights
- Line numbers on both sides
- Scroll sync between panes

### New Utility

`lib/diff.ts` — exports `diffLines(a: string, b: string)` returning `Array<{ type: "added" | "removed" | "unchanged", text: string }>`. Uses a simple LCS approach: split both strings by newline, compute the longest common subsequence, mark lines as added/removed/unchanged.

---

## 3. Soft Approval Gate

### Approach

When deploying to prod, instead of immediately deploying, show an expanded confirmation with a diff preview. No new tables — uses the existing audit log for review request tracking.

### UI Changes — Deploy Dialog

The existing deploy dialog (in `composition-editor.tsx`) shows three environment buttons. Changes:

1. When user clicks "prod", expand the dialog instead of deploying:
   - Show a diff between the currently deployed prod version and the version being promoted
   - To get the current prod version: fetch `GET /api/compositions/[id]/versions` and find the version that matches the latest prod deployment
   - Use the same diff component from Section 2
   - Show a warning banner: "This will affect live traffic immediately"
   - Two action buttons:
     - "Deploy to prod" (primary) — deploys as before
     - "Request Review" (outline) — logs an audit entry and shows a toast

2. "dev" and "staging" buttons continue to deploy immediately (no confirmation needed).

### Review Request

Clicking "Request Review":
1. Calls `POST /api/audit-log` (or inline in the promote endpoint) to record:
   ```json
   {
     "action": "deployment.review_requested",
     "resourceType": "composition",
     "resourceId": "uuid",
     "metadata": {
       "version": 5,
       "environment": "prod",
       "requestedBy": "user_id"
     }
   }
   ```
2. Shows toast: "Review requested — visible in the audit log"
3. Does NOT block the "Deploy to prod" button — both are independently clickable

### Audit Log Visibility

The audit log page (`/settings/audit`) already renders all audit entries. Review requests show up naturally with the action `deployment.review_requested`. No changes needed to the audit page.

---

## Files to Create or Modify

### New Files
- `lib/diff.ts` — line diff utility
- `lib/diff.test.ts` — tests for diff utility
- `components/editor/version-diff.tsx` — side-by-side diff component
- `app/api/blocks/[id]/usage/route.ts` — block usage/impact API
- `app/api/compositions/[id]/assemble/route.ts` — assemble a composition graph into text (for diff preview)

### Modified Files
- `components/blocks/block-list.tsx` — add "Used in" section to edit dialog with prod warning
- `components/compositions/composition-editor.tsx` — version compare UI in history dialog, prod deploy confirmation
- `lib/audit.ts` — possibly add a helper for review request audit entries (or inline)

---

## What's NOT in Scope

- Hard approval gate (blocking deployment without approval)
- Notification system (Slack/email — that's Batch 3 webhooks)
- Graph diff (visual diff of node positions/connections — text diff covers the need)
- Precomputed dependency table (scan is fast enough)
