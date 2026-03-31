# Batch 1: Core DX — Model Config, Tool Blocks, SDK Ergonomics, Playground

**Date:** 2026-03-31
**Status:** Approved
**Scope:** 4 tightly-coupled features that make Composr a complete prompt builder — eliminating all hardcoded values from application code.

## Problem

When developers use Composr today, they get messages from `compose()` but still hardcode model selection, temperature, max_tokens, and tool definitions in their application code. This means a deploy is still required to change these values — defeating half the promise of remote prompt management.

## Solution Overview

Four features, built as vertical slices in this order:

1. **Model & Provider Config** — per-composition, per-environment model settings
2. **Tool / Function Calling Blocks** — new block type for tool definitions
3. **SDK Ergonomics** — `compose()` returns model, config, and tools alongside messages
4. **Playground** — test compositions against real LLMs from the composition editor

## Implementation Approach

Vertical slices — each feature is built end-to-end (schema → API → SDK → UI) before starting the next. Each slice is independently shippable.

---

## 1. Model & Provider Config

### Provider Keys

Team admins add LLM provider API keys in Settings → Providers. Keys are encrypted at rest and displayed masked (`sk-ant-...4f2a`). Supported providers at launch: Anthropic and OpenAI.

**New table: `provider_keys`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| teamId | text | FK → teams.id |
| provider | text | `"anthropic"` or `"openai"` |
| encryptedKey | text | AES-256-GCM encrypted API key (encryption key from `ENCRYPTION_KEY` env var) |
| keyPrefix | text | Display prefix, e.g. `"sk-ant-...4f2a"` |
| createdAt | timestamp | Creation time |

**UI:** Settings page gets a new "Providers" section with cards per provider (icon, name, masked key, connection status) and an "Add Provider" button.

**API Routes:**
- `GET /api/provider-keys` — list provider keys (masked)
- `POST /api/provider-keys` — add a provider key (encrypts before storage)
- `DELETE /api/provider-keys/[id]` — remove a provider key

### Model Config on Compositions

Each composition stores model configuration per environment in its existing `metadata` jsonb field. No schema migration required.

**Metadata schema:**

```json
{
  "modelConfig": {
    "dev": {
      "model": "anthropic/claude-haiku-4-5",
      "temperature": 0.8,
      "maxTokens": 1024,
      "topP": 1.0,
      "stopSequences": []
    },
    "staging": {
      "model": "anthropic/claude-sonnet-4-6",
      "temperature": 0.5,
      "maxTokens": 2048
    },
    "prod": {
      "model": "anthropic/claude-sonnet-4-6",
      "temperature": 0.3,
      "maxTokens": 2048
    }
  }
}
```

**Model string format:** `"provider/model-name"` (e.g. `"anthropic/claude-sonnet-4-6"`, `"openai/gpt-4o"`). The SDK consumer splits on `/` to route to the correct provider client.

**Config fields:** `model` (required), `temperature`, `maxTokens`, `topP`, `stopSequences`. All optional fields except model — omitted fields mean "use provider defaults."

**UI:** Composition editor properties panel gets a "Model Config" section with environment tabs (dev/staging/prod). Each tab has a model dropdown (populated from known models for connected providers), temperature input, max tokens input, top P input, and stop sequences input.

### Single provider per composition

A composition's model config points to one model per environment. No fallback chain. Fallback logic is an execution concern that belongs in application code.

---

## 2. Tool / Function Calling Blocks

### Block Kind

The `blocks` table gets a new `kind` column:

```sql
ALTER TABLE blocks ADD COLUMN kind text NOT NULL DEFAULT 'prompt';
```

Values: `"prompt"` (existing behavior) or `"tool"`.

For tool blocks, the existing columns are reused:
- `name` → tool function name (e.g. `"get_weather"`)
- `description` → tool description for the LLM
- `content` → JSON string of the `input_schema` (JSON Schema format)
- `role` → null (not applicable for tools)

This avoids creating a separate table while keeping versioning, tags, and all existing block infrastructure.

### Tool Block Editor

Dual-view editor for tool blocks:

**Form View** (default) — structured form with:
- Tool name input
- Description input
- Parameters list: each row has name, type dropdown (string, number, boolean, enum, object, array), required checkbox, remove button
- "Add Parameter" button
- For enum types: comma-separated values input
- For object types: nested parameter list (same UI, indented)

**JSON Schema View** — Monaco editor with JSON Schema validation, for complex nested schemas or pasting existing definitions.

Both views stay in sync — editing one updates the other. The form view generates valid JSON Schema. The JSON Schema view parses back into the form when possible (falls back to JSON-only for schemas too complex for the form).

### Tool Node in Composition Graph

New `tool` node type in the graph editor:
- Orange accent color (distinct from blue prompt blocks)
- Displays tool name and parameter count
- Available in the node palette alongside existing node types
- Can be placed after IF/switch/percentage gates (conditionally included tools)

**Assembly behavior:** During graph walking, tool nodes are collected into a separate `tools[]` array. They are NOT concatenated into the prompt text. This is the key distinction from prompt blocks.

### Blocks Page

The blocks list page shows tool blocks with an orange "tool" badge (vs blue "prompt" badge). Filter/tab to show all, prompt-only, or tool-only blocks.

---

## 3. SDK Ergonomics

### ComposeResult Changes

`compose()` returns three new fields:

```typescript
interface ComposeResult {
  // Existing fields (unchanged)
  id: string
  text: string
  messages: Message[]
  version: string
  variantId: string | null
  tokenCount: number
  blocks: string[]
  compositionName: string
  errors: string[]

  // New fields
  model: string | null         // "anthropic/claude-sonnet-4-6"
  config: ModelConfig | null   // { temperature, maxTokens, topP, stopSequences }
  tools: ToolDefinition[]      // [{ name, description, input_schema }]
}

interface ModelConfig {
  temperature?: number
  maxTokens?: number
  topP?: number
  stopSequences?: string[]
}

interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, any>  // JSON Schema object
}
```

`model` and `config` are null if the composition has no modelConfig in its metadata. `tools` is an empty array if no tool nodes are on the resolved path.

### Assembly Logic Changes

In `compose.ts` (SDK) and `graph-engine.ts` (server):

1. When walking the graph and encountering a `block` node where `kind === "tool"`:
   - Parse `content` as JSON (the input_schema)
   - Push `{ name, description, input_schema }` into a `tools[]` collector
   - Do NOT push content into `parts[]` or `messages[]`

2. After walking, read `composition.metadata.modelConfig[environment]` to get `model` and `config`.

3. Return both in the ComposeResult.

### Config Endpoint Changes

`GET /api/sdk/config/{env}` response changes:
- Blocks include `kind` field: `{ name, content, version, role, kind }`
- Compositions include full `metadata` (already returned, but now clients use `metadata.modelConfig`)

### All 3 SDKs

The same logic changes apply to:
- **TypeScript** (`sdk/src/types.ts`, `sdk/src/compose.ts`)
- **Go** (`sdk-go/types.go`, `sdk-go/compose.go`)
- **Python** (`sdk/python/composr/types.py`, `sdk/python/composr/compose.py`)

### REST API

`POST /api/v1/compose` response also includes `model`, `config`, and `tools`.

### Backward Compatibility

All new fields are additive. Existing SDK consumers that don't read `model`, `config`, or `tools` are unaffected. The `text` and `messages` fields continue to work identically — tool blocks are excluded from them.

---

## 4. Playground

### Location

The playground is a "Test" tab in the composition editor's right panel, alongside existing Preview, Properties, and Eval tabs.

### UI Components

**Test Panel** (`components/editor/test-panel.tsx`):

1. **Context input** — Monaco editor pre-populated with skeleton JSON from the composition's `contextSchema`. Validates required fields before running.

2. **Context presets** — save/load named context snapshots per composition. Stored in localStorage. "Load preset" dropdown with save/delete.

3. **Environment selector** — dropdown (dev/staging/prod) that determines which model config to use.

4. **User message input** — text input for the test user message.

5. **Run button** — triggers the playground API call.

6. **Assembled prompt display** — shows the system messages that were assembled, with role badges and token count. Collapsible.

7. **Response display** — streams the LLM response in real-time via SSE. Shows:
   - Response text (streamed)
   - Tool calls (if LLM returns `tool_use` — displayed as JSON, not executed)
   - Metrics bar: model used, latency, cost estimate, input/output token counts

### API Route

**`POST /api/playground/run`** — Clerk-authenticated (not SDK key), requires team membership.

Request:
```json
{
  "compositionId": "uuid",
  "context": { "user": { "name": "Alice" } },
  "userMessage": "How do I set up my workspace?",
  "environment": "dev"
}
```

Flow:
1. Look up composition by ID, verify team ownership
2. Assemble prompt via `assembleGraph()` using provided context
3. Read model config from `composition.metadata.modelConfig[environment]`
4. Parse provider from model string (e.g. `"anthropic"` from `"anthropic/claude-sonnet-4-6"`)
5. Fetch team's provider key for that provider from `provider_keys`
6. Call the LLM provider API with assembled messages, tools, and config
7. Stream response back via SSE

Response (SSE events):
- `event: text_delta` → `{ content: "Welcome..." }`
- `event: tool_use` → `{ tool: "get_weather", input: { location: "SF" } }`
- `event: done` → `{ cost: 0.0003, latencyMs: 820, inputTokens: 142, outputTokens: 89 }`

### Provider Abstraction

A thin provider abstraction layer (`lib/providers/`) handles the difference between Anthropic and OpenAI APIs:

```
lib/providers/
  index.ts        — factory: getProvider(providerName) → Provider
  types.ts        — shared Provider interface
  anthropic.ts    — Anthropic SDK wrapper
  openai.ts       — OpenAI SDK wrapper
```

The `Provider` interface:
```typescript
interface Provider {
  stream(params: {
    model: string
    messages: Message[]
    tools?: ToolDefinition[]
    config?: ModelConfig
    apiKey: string
  }): AsyncIterable<StreamEvent>
}
```

Each provider translates from Composr's format to the provider's native format (e.g. Anthropic uses `max_tokens`, OpenAI uses `max_tokens` with different message formatting).

### Tool Calls in Playground

When the LLM responds with a tool call, the playground displays the tool name and input JSON. It does NOT execute the tool. The user sees what the LLM would call, which is sufficient for testing that the tool definitions and prompt are configured correctly.

### Error Handling

- Missing provider key → "No API key configured for Anthropic. Add one in Settings → Providers."
- Missing model config → "No model configured for dev environment. Set one in the Properties panel."
- Provider API error → Display the error message from the provider (rate limit, invalid key, etc.)
- Context validation failure → Highlight missing required fields before allowing Run.

---

## Schema Migrations Summary

**Migration 1:** Add `provider_keys` table
**Migration 2:** Add `kind` column to `blocks` table (`text NOT NULL DEFAULT 'prompt'`)

No changes to `compositions` table — model config uses the existing `metadata` jsonb field.

---

## Files to Create or Modify

### New Files
- `lib/providers/index.ts` — provider factory
- `lib/providers/types.ts` — Provider interface
- `lib/providers/anthropic.ts` — Anthropic wrapper
- `lib/providers/openai.ts` — OpenAI wrapper
- `lib/encryption.ts` — AES-256-GCM encrypt/decrypt for provider keys
- `app/api/provider-keys/route.ts` — list/create provider keys
- `app/api/provider-keys/[id]/route.ts` — delete provider key
- `app/api/playground/run/route.ts` — playground execution endpoint
- `components/editor/test-panel.tsx` — playground UI
- `components/settings/provider-keys.tsx` — provider key management UI
- `components/editor/nodes/tool-node.tsx` — tool node for graph canvas
- `components/blocks/tool-block-editor.tsx` — dual-view tool editor
- `drizzle/0008_provider_keys.sql` — migration for provider_keys table
- `drizzle/0009_block_kind.sql` — migration for blocks.kind column

### Modified Files
- `lib/schema.ts` — add `kind` to blocks, add `providerKeys` table
- `lib/graph-engine.ts` — collect tool blocks into tools[], skip them from text/messages
- `sdk/src/types.ts` — add model, config, tools to ComposeResult and SDKConfig
- `sdk/src/compose.ts` — assembly logic for tool blocks and model config
- `sdk-go/types.go` — add Model, Config, Tools to ComposeResult
- `sdk-go/compose.go` — same assembly logic changes
- `sdk/python/composr/types.py` — add fields to ComposeResult
- `sdk/python/composr/compose.py` — same assembly logic changes
- `app/api/sdk/config/[env]/route.ts` — include kind in block data
- `app/api/v1/compose/route.ts` — return model, config, tools in response
- `app/api/blocks/route.ts` — support kind field in create/list
- `app/api/blocks/[id]/route.ts` — support kind field in update
- `components/blocks/block-card.tsx` — show prompt/tool badge
- `components/blocks/block-list.tsx` — filter by kind
- `components/editor/flow-canvas.tsx` — register tool node type
- `components/editor/node-palette.tsx` — add tool node to palette
- `components/editor/properties-panel.tsx` — add model config section
- `components/compositions/composition-editor.tsx` — add Test tab
- `components/editor/monaco-block-editor.tsx` — dual-view for tool blocks
- `app/(app)/settings/page.tsx` — add Providers section
- `package.json` — add @anthropic-ai/sdk, openai dependencies

---

## Future Batches (Not In Scope)

**Batch 2 — Safety & Trust:** Impact analysis, prompt diff, approval workflow
**Batch 3 — Scale & Operations:** Migration CLI, webhooks, folders & search
