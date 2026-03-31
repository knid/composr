# Sub-project F: Pipelines — Design Spec

**Date:** 2026-03-30
**Status:** Approved

---

## Overview

Replace the flat composition grid on the pipelines page with a real multi-composition pipeline system: data model, CRUD API, list page, and React Flow editor.

## F1: Pipeline data model
New `pipelines` table: id, teamId, name, description, graph (jsonb with nodes/edges), createdAt, updatedAt.

## F2: Pipeline CRUD API
- `GET /api/pipelines` — list for team
- `POST /api/pipelines` — create
- `GET /api/pipelines/[id]` — get
- `PUT /api/pipelines/[id]` — update graph
- `DELETE /api/pipelines/[id]` — delete

## F3: Pipeline editor
- List page with "New Pipeline" button
- Editor page at `/pipelines/[id]` with React Flow canvas
- Composition nodes showing name, version, block count
- Edges define execution order
- Save/delete toolbar

## Files
| File | Change |
|------|--------|
| `lib/schema.ts` | Add pipelines table |
| `app/api/pipelines/route.ts` | Create — list + create |
| `app/api/pipelines/[id]/route.ts` | Create — get, update, delete |
| `app/(app)/pipelines/page.tsx` | Rewrite — list view |
| `app/(app)/pipelines/[id]/page.tsx` | Create — pipeline editor |
| `components/pipelines/pipeline-editor.tsx` | Create — React Flow editor |
