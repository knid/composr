# Sub-project A: Core UI Polish — Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Depends on:** Nothing (independent of Sub-project C)
**Blocks:** Sub-project B (charts need polished pages to live in)

---

## Overview

The editor and blocks pages are functional but missing key UX features from the design spec: Monaco editor for block editing, command palette with keyboard shortcuts, tag filtering, version history browsing, and rollback. This sub-project adds all of them.

---

## A1: Monaco Editor for block content editing

### Problem
Block editing uses `<Textarea>` — no syntax highlighting, no variable highlighting, no token count in the editor.

### Solution
Create a reusable `MonacoBlockEditor` component wrapping `@monaco-editor/react` (already installed).

### Component: `components/editor/monaco-block-editor.tsx`
- Dark theme matching zinc-950 aesthetic
- Custom syntax highlighting for `{{variables}}` (highlighted in primary/purple)
- Live token count displayed below the editor
- Props: `value`, `onChange`, `readOnly?`, `height?`

### Integration points
- **`components/blocks/block-list.tsx`** — Replace the `<Textarea>` in the edit dialog with `MonacoBlockEditor`
- Properties panel's block preview stays as-is (read-only snippet preview, not a full editor)

---

## A2: Cmd+K command palette

### Problem
`cmdk` and `components/ui/command.tsx` exist but no command palette is wired up.

### Solution
Create a global command palette accessible from every page.

### Component: `components/command-palette.tsx`
- Uses `CommandDialog` from shadcn command component
- Opens on `Cmd+K` (or `Ctrl+K` on non-Mac)
- Fetches compositions and blocks list on open (just names/IDs)

### Command groups
| Group | Commands |
|-------|----------|
| **Navigation** | Dashboard, Compositions, Blocks, Pipelines, Experiments, Scoring, Analytics, Logs, Usage, Settings |
| **Compositions** | Fuzzy search by name, click to navigate to `/compositions/{id}` |
| **Blocks** | Fuzzy search by name, click to navigate to `/blocks` (filtered) |
| **Actions** | Create new composition, Create new block |

### Mount point
- Added to `app/(app)/layout.tsx` so it's available on every page

---

## A3: Keyboard shortcuts (Cmd+E, Cmd+P)

### Problem
No keyboard shortcuts exist for quick navigation.

### Solution
Integrate into the command palette rather than building separate UIs:
- **Cmd+E** — Opens command palette pre-filtered to blocks search
- **Cmd+P** — Opens command palette pre-filtered to compositions search

This follows the VS Code pattern. Implemented as additional `useEffect` keyboard listeners in the `CommandPalette` component that set the initial search filter.

---

## A4: Block tag filter UI

### Problem
Blocks page has name search but no tag-based filtering, despite tags existing in the data.

### Solution
Add a clickable tag filter row in `components/blocks/block-list.tsx`.

### Implementation
- Extract all unique tags from the blocks list
- Render a row of clickable `Badge` components between the search bar and block grid
- Clicking a tag toggles it as an active filter (primary styling when active)
- Multiple tags can be active — blocks matching ANY active tag are shown
- Combined with existing name search (both filters apply: name AND tag match)
- No new components needed — inline filter logic and badge row

---

## A5: Version history UI

### Problem
Versions are created in DB (`block_versions`, `composition_versions`) but there's no UI to browse or view them.

### Solution
Add version history browsing to both blocks and compositions.

### New API routes
- **`GET /api/blocks/[id]/versions`** — Returns all versions for a block (`version`, `content`, `createdAt`, `createdBy`), ordered by version desc
- **`GET /api/compositions/[id]/versions`** — Returns all versions for a composition (`version`, `graph`, `contextSchema`, `createdAt`, `createdBy`), ordered by version desc

### Block version history
In `block-list.tsx`'s edit dialog:
- Add a "History" section below the edit area
- Dropdown showing versions (`v1, v2, v3...`) with timestamps
- Selecting a version shows its content in a read-only `MonacoBlockEditor`
- "Restore" button copies historical content into the edit field (user still must click Save)

### Composition version history
In the composition editor page (`compositions/[id]/page.tsx`):
- Add a version history button in the editor header
- Opens a dropdown/panel listing versions with timestamps
- Selecting a version loads that graph into the canvas as a preview (unsaved)
- "Restore this version" applies it as the current graph (user still must save)

---

## A6: Rollback API

### Problem
No way to programmatically revert a composition to a previous version.

### Solution
Non-destructive rollback — restoring an old version creates a new version entry.

### New API route: `POST /api/compositions/[id]/rollback`

**Request:** `{ "version": 3 }`

**Behavior:**
1. Look up the specified version from `composition_versions`
2. Update the composition's `graph` and `contextSchema` to the historical version's values
3. Increment the composition version number (rollback = new version)
4. Create a new entry in `composition_versions` for the rollback
5. Log audit event (`composition.rolledBack`)
6. Invalidate config cache
7. Notify SSE listeners

**Response:** Updated composition object

This means version history always grows forward. Rollback is just "copy old version forward as a new version."

---

## Files changed (summary)

| File | Change |
|------|--------|
| `components/editor/monaco-block-editor.tsx` | **New.** Reusable Monaco editor for blocks |
| `components/command-palette.tsx` | **New.** Global Cmd+K command palette |
| `components/blocks/block-list.tsx` | Replace Textarea with Monaco, add tag filter, add version history section |
| `app/(app)/layout.tsx` | Mount CommandPalette |
| `app/api/blocks/[id]/versions/route.ts` | **New.** Block version history API |
| `app/api/compositions/[id]/versions/route.ts` | **New.** Composition version history API |
| `app/api/compositions/[id]/rollback/route.ts` | **New.** Rollback API |
| `app/(app)/compositions/[id]/page.tsx` | Add version history UI |

---

## Out of scope

- Charts and dashboards (Sub-project B)
- Additional scorers (Sub-project D)
- Settings pages (Sub-project E)
- Pipeline chaining (Sub-project F)
- Python SDK (Sub-project G)
