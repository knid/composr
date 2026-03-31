# Batch 1: Core DX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all hardcoded values from application code by making `compose()` return model config, tools, and messages — plus a playground to test compositions against real LLMs from the editor.

**Architecture:** Four vertical slices built in order: (1) provider keys + model config on compositions, (2) tool block type + tool graph node, (3) SDK returns model/config/tools, (4) playground panel in composition editor. Each slice is schema → API → SDK → UI, independently shippable.

**Tech Stack:** Next.js 16, Drizzle ORM, Neon Postgres, React 19, React Flow, Monaco Editor, Anthropic SDK, OpenAI SDK, Vitest, Clerk auth.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `lib/encryption.ts` | AES-256-GCM encrypt/decrypt for provider keys |
| `app/api/provider-keys/route.ts` | List/create provider keys (Clerk-auth) |
| `app/api/provider-keys/[id]/route.ts` | Delete provider key |
| `components/settings/provider-keys.tsx` | Provider key management UI cards |
| `components/editor/nodes/tool-node.tsx` | Tool node for graph canvas (orange accent) |
| `components/blocks/tool-block-editor.tsx` | Dual-view form/JSON Schema editor for tools |
| `lib/providers/types.ts` | Provider interface + StreamEvent types |
| `lib/providers/anthropic.ts` | Anthropic SDK streaming wrapper |
| `lib/providers/openai.ts` | OpenAI SDK streaming wrapper |
| `lib/providers/index.ts` | `getProvider(name)` factory |
| `app/api/playground/run/route.ts` | Playground execution endpoint (SSE) |
| `components/editor/test-panel.tsx` | Playground UI in composition editor |
| `lib/encryption.test.ts` | Tests for encrypt/decrypt |
| `lib/providers/anthropic.test.ts` | Tests for Anthropic message formatting |
| `lib/providers/openai.test.ts` | Tests for OpenAI message formatting |

### Modified Files
| File | Changes |
|------|---------|
| `lib/schema.ts` | Add `providerKeys` table, add `kind` column to `blocks` |
| `lib/graph-engine.ts` | Collect tool blocks into `tools[]`, skip from text/messages |
| `lib/graph-engine.test.ts` | Add tests for tool block assembly |
| `sdk/src/types.ts` | Add `model`, `config`, `tools` to `ComposeResult`; add `kind` to block type in `SDKConfig` |
| `sdk/src/compose.ts` | Tool block handling + model config extraction |
| `sdk/src/compose.test.ts` | Tests for new fields |
| `sdk-go/types.go` | Add `Model`, `Config`, `Tools` fields |
| `sdk-go/compose.go` | Tool block handling + model config |
| `sdk-go/compose_test.go` | Tests for new fields |
| `sdk/python/composr/types.py` | Add fields to ComposeResult |
| `sdk/python/composr/compose.py` | Tool block handling + model config |
| `sdk/python/tests/test_compose.py` | Tests for new fields |
| `app/api/sdk/config/[env]/route.ts` | Include `kind` in block data |
| `app/api/v1/compose/route.ts` | Return `model`, `config`, `tools` |
| `app/api/blocks/route.ts` | Accept `kind` in POST |
| `app/api/blocks/[id]/route.ts` | Accept `kind` in PUT |
| `components/blocks/block-card.tsx` | Show prompt/tool badge |
| `components/blocks/block-list.tsx` | Add kind filter tabs, tool create dialog |
| `components/editor/flow-canvas.tsx` | Register tool node type + default data |
| `components/editor/node-palette.tsx` | Add Tool to palette items |
| `components/editor/properties-panel.tsx` | Add tool node properties + model config section |
| `components/compositions/composition-editor.tsx` | Add Test tab, pass compositions list |
| `app/(app)/settings/page.tsx` | Add Providers section |
| `package.json` | Add `@anthropic-ai/sdk`, `openai` |

---

### Task 1: Encryption Utility

**Files:**
- Create: `lib/encryption.ts`
- Create: `lib/encryption.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/encryption.test.ts
import { describe, it, expect } from "vitest"
import { encrypt, decrypt } from "./encryption"

describe("encryption", () => {
  const testKey = "0".repeat(64) // 32 bytes hex

  it("round-trips a string", () => {
    const plaintext = "sk-ant-api03-secret-key-value"
    const encrypted = encrypt(plaintext, testKey)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toContain(":") // iv:ciphertext:tag format
    const decrypted = decrypt(encrypted, testKey)
    expect(decrypted).toBe(plaintext)
  })

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "sk-ant-api03-same-key"
    const a = encrypt(plaintext, testKey)
    const b = encrypt(plaintext, testKey)
    expect(a).not.toBe(b)
  })

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("secret", testKey)
    const tampered = encrypted.slice(0, -2) + "ff"
    expect(() => decrypt(tampered, testKey)).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/encryption.test.ts`
Expected: FAIL — module `./encryption` not found

- [ ] **Step 3: Write the implementation**

```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16

export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex")
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`
}

export function decrypt(ciphertext: string, keyHex: string): string {
  const [ivHex, encHex, tagHex] = ciphertext.split(":")
  const key = Buffer.from(keyHex, "hex")
  const iv = Buffer.from(ivHex, "hex")
  const encrypted = Buffer.from(encHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/encryption.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/encryption.ts lib/encryption.test.ts
git commit -m "feat: add AES-256-GCM encryption utility for provider keys"
```

---

### Task 2: Provider Keys Schema + API

**Files:**
- Modify: `lib/schema.ts`
- Create: `app/api/provider-keys/route.ts`
- Create: `app/api/provider-keys/[id]/route.ts`

- [ ] **Step 1: Add providerKeys table to schema**

Add to `lib/schema.ts` after the `apiKeys` table:

```typescript
// provider_keys — LLM provider API keys (encrypted)
export const providerKeys = pgTable("provider_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  provider: text("provider").notNull(), // "anthropic" | "openai"
  encryptedKey: text("encrypted_key").notNull(),
  keyPrefix: text("key_prefix").notNull(), // "sk-ant-...4f2a"
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
```

- [ ] **Step 2: Generate and run migration**

Run: `npx drizzle-kit generate`
Expected: Creates a new migration file in `drizzle/`

Run: `npx drizzle-kit push`
Expected: Migration applied successfully

- [ ] **Step 3: Create the list/create API route**

```typescript
// app/api/provider-keys/route.ts
import { db } from "@/lib/db"
import { providerKeys } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { encrypt } from "@/lib/encryption"

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const keys = await db
    .select({
      id: providerKeys.id,
      provider: providerKeys.provider,
      keyPrefix: providerKeys.keyPrefix,
      createdAt: providerKeys.createdAt,
    })
    .from(providerKeys)
    .where(eq(providerKeys.teamId, orgId))

  return NextResponse.json(keys)
}

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { provider, apiKey } = await req.json()

  if (!provider || !apiKey) {
    return NextResponse.json({ error: "provider and apiKey are required" }, { status: 400 })
  }

  if (!["anthropic", "openai"].includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 })
  }

  const keyPrefix = apiKey.length > 8
    ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`
    : "***"

  const encryptedKey = encrypt(apiKey, ENCRYPTION_KEY)

  const [key] = await db.insert(providerKeys).values({
    teamId: orgId,
    provider,
    encryptedKey,
    keyPrefix,
  }).returning({
    id: providerKeys.id,
    provider: providerKeys.provider,
    keyPrefix: providerKeys.keyPrefix,
    createdAt: providerKeys.createdAt,
  })

  return NextResponse.json(key, { status: 201 })
}
```

- [ ] **Step 4: Create the delete API route**

```typescript
// app/api/provider-keys/[id]/route.ts
import { db } from "@/lib/db"
import { providerKeys } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  await db.delete(providerKeys).where(
    and(eq(providerKeys.id, id), eq(providerKeys.teamId, orgId))
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts app/api/provider-keys drizzle/
git commit -m "feat: add provider keys table and API routes"
```

---

### Task 3: Provider Keys UI

**Files:**
- Create: `components/settings/provider-keys.tsx`
- Modify: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Create the provider keys component**

```tsx
// components/settings/provider-keys.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface ProviderKey {
  id: string
  provider: string
  keyPrefix: string
  createdAt: string
}

const PROVIDER_INFO: Record<string, { label: string; color: string; placeholder: string }> = {
  anthropic: { label: "Anthropic", color: "bg-amber-600", placeholder: "sk-ant-..." },
  openai: { label: "OpenAI", color: "bg-emerald-600", placeholder: "sk-proj-..." },
}

export function ProviderKeysSection() {
  const [keys, setKeys] = useState<ProviderKey[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [provider, setProvider] = useState("anthropic")
  const [apiKey, setApiKey] = useState("")

  useEffect(() => {
    fetch("/api/provider-keys")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setKeys(data) })
  }, [])

  async function addKey() {
    const res = await fetch("/api/provider-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    })
    if (res.ok) {
      const key = await res.json()
      setKeys([...keys, key])
      setAddOpen(false)
      setApiKey("")
      toast.success(`${PROVIDER_INFO[provider].label} key added`)
    } else {
      const data = await res.json()
      toast.error(data.error ?? "Failed to add key")
    }
  }

  async function deleteKey(id: string) {
    await fetch(`/api/provider-keys/${id}`, { method: "DELETE" })
    setKeys(keys.filter((k) => k.id !== id))
    toast.success("Provider key deleted")
  }

  const connectedProviders = new Set(keys.map((k) => k.provider))

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-3">LLM Providers</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Add your provider API keys to use the playground and configure models per composition.
      </p>

      <div className="space-y-2 mb-4">
        {keys.map((k) => {
          const info = PROVIDER_INFO[k.provider] ?? { label: k.provider, color: "bg-gray-600" }
          return (
            <div key={k.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <div className={`h-6 w-6 rounded ${info.color} flex items-center justify-center text-[10px] font-bold text-white`}>
                {info.label[0]}
              </div>
              <span className="text-sm font-medium">{info.label}</span>
              <code className="font-mono text-xs text-muted-foreground">{k.keyPrefix}</code>
              <span className="ml-auto rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500">
                Connected
              </span>
              <Button
                size="sm" variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => deleteKey(k.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )
        })}
      </div>

      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add Provider
      </Button>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add LLM Provider</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm mt-1"
              >
                {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                  <option key={key} value={key} disabled={connectedProviders.has(key)}>
                    {info.label} {connectedProviders.has(key) ? "(already added)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">API Key</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={PROVIDER_INFO[provider]?.placeholder ?? "API key"}
                className="mt-1"
              />
            </div>
            <Button onClick={addKey} disabled={!apiKey.trim()} className="w-full">
              Add Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
```

- [ ] **Step 2: Add ProviderKeysSection to settings page**

In `app/(app)/settings/page.tsx`, add the import at the top:

```typescript
import { ProviderKeysSection } from "@/components/settings/provider-keys"
```

Add `<ProviderKeysSection />` right after the API Keys `</section>` closing tag (before the SDK Quick Start section).

- [ ] **Step 3: Verify the UI works**

Run: `npm run dev`
Navigate to Settings page. Verify:
- Provider keys section appears below API Keys
- Can add Anthropic/OpenAI keys
- Keys show masked in the list
- Can delete keys

- [ ] **Step 4: Commit**

```bash
git add components/settings/provider-keys.tsx app/(app)/settings/page.tsx
git commit -m "feat: add provider keys management UI to settings"
```

---

### Task 4: Model Config on Compositions

**Files:**
- Modify: `components/editor/properties-panel.tsx`
- Modify: `components/compositions/composition-editor.tsx`

- [ ] **Step 1: Add ModelConfigPanel to properties-panel.tsx**

Add this component at the bottom of `components/editor/properties-panel.tsx`, before the `FieldLabel` component:

```tsx
/* ─── Model Config Panel ─── */
function ModelConfigPanel({
  metadata,
  onMetadataChange,
}: {
  metadata: Record<string, any>
  onMetadataChange: (metadata: Record<string, any>) => void
}) {
  const [env, setEnv] = useState<"dev" | "staging" | "prod">("dev")
  const modelConfig = (metadata?.modelConfig ?? {}) as Record<string, any>
  const envConfig = modelConfig[env] ?? {}

  function updateEnvConfig(field: string, value: any) {
    const updated = {
      ...modelConfig,
      [env]: { ...envConfig, [field]: value },
    }
    onMetadataChange({ ...metadata, modelConfig: updated })
  }

  return (
    <div className="border-t border-border pt-3 mt-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Model Config
      </div>
      <div className="flex gap-1 mb-3">
        {(["dev", "staging", "prod"] as const).map((e) => (
          <button
            key={e}
            onClick={() => setEnv(e)}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium rounded transition-colors",
              env === e
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <FieldLabel label="Model">
          <Input
            value={envConfig.model ?? ""}
            onChange={(e) => updateEnvConfig("model", e.target.value)}
            placeholder="anthropic/claude-sonnet-4-6"
            className="h-7 text-xs"
          />
        </FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <FieldLabel label="Temperature">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={envConfig.temperature ?? ""}
              onChange={(e) => updateEnvConfig("temperature", parseFloat(e.target.value) || undefined)}
              placeholder="0.7"
              className="h-7 text-xs"
            />
          </FieldLabel>
          <FieldLabel label="Max Tokens">
            <Input
              type="number"
              value={envConfig.maxTokens ?? ""}
              onChange={(e) => updateEnvConfig("maxTokens", parseInt(e.target.value) || undefined)}
              placeholder="2048"
              className="h-7 text-xs"
            />
          </FieldLabel>
        </div>
        <FieldLabel label="Top P">
          <Input
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={envConfig.topP ?? ""}
            onChange={(e) => updateEnvConfig("topP", parseFloat(e.target.value) || undefined)}
            placeholder="1.0"
            className="h-7 text-xs"
          />
        </FieldLabel>
        <FieldLabel label="Stop Sequences">
          <Input
            value={(envConfig.stopSequences ?? []).join(", ")}
            onChange={(e) => updateEnvConfig("stopSequences", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
            placeholder="comma-separated"
            className="h-7 text-xs"
          />
        </FieldLabel>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire ModelConfigPanel into the composition editor**

In `components/compositions/composition-editor.tsx`:

1. Add `metadata` to the `CompositionEditorProps` interface:
```typescript
interface CompositionEditorProps {
  id: string
  name: string
  version: number
  initialNodes: Node[]
  initialEdges: Edge[]
  contextSchema: ContextField[]
  metadata: Record<string, any>  // add this
}
```

2. Add `metadata` state after `contextSchema` state:
```typescript
const [metadata, setMetadata] = useState<Record<string, any>>(initialMetadata ?? {})
```

3. Update destructuring to include `metadata: initialMetadata`:
```typescript
export function CompositionEditor({
  id, name, version, initialNodes, initialEdges,
  contextSchema: initialContextSchema,
  metadata: initialMetadata,  // add this
}: CompositionEditorProps) {
```

4. Include `metadata` in the save body:
```typescript
body: JSON.stringify({ graph: graphRef.current, contextSchema, metadata }),
```

5. Add `onMetadataChange` callback:
```typescript
const onMetadataChange = useCallback((m: Record<string, any>) => {
  setMetadata(m)
  setDirty(true)
}, [])
```

6. Pass `metadata` and `onMetadataChange` to `PropertiesPanel` (update both the props and the component call). The ModelConfigPanel will be shown when no node is selected — or always below the node properties.

- [ ] **Step 3: Update the composition page to pass metadata**

In `app/(app)/compositions/[id]/page.tsx`, pass `metadata={composition.metadata}` to the `CompositionEditor`.

- [ ] **Step 4: Update PUT API to persist metadata**

In `app/api/compositions/[id]/route.ts`, add `metadata` to the set clause alongside `graph` and `contextSchema`:
```typescript
metadata: metadata ?? existing.metadata,
```

- [ ] **Step 5: Verify the UI works**

Run: `npm run dev`
Open a composition editor. The properties panel should show Model Config at the bottom with env tabs and fields for model, temperature, max tokens, top P, stop sequences.

- [ ] **Step 6: Commit**

```bash
git add components/editor/properties-panel.tsx components/compositions/composition-editor.tsx app/api/compositions/[id]/route.ts app/(app)/compositions/[id]/page.tsx
git commit -m "feat: add per-environment model config to compositions"
```

---

### Task 5: Block Kind Column + Tool Blocks Schema

**Files:**
- Modify: `lib/schema.ts`
- Modify: `app/api/blocks/route.ts`
- Modify: `app/api/blocks/[id]/route.ts`

- [ ] **Step 1: Add kind column to blocks table in schema**

In `lib/schema.ts`, add to the `blocks` table definition after the `role` field:

```typescript
kind: text("kind").notNull().default("prompt"), // "prompt" | "tool"
```

- [ ] **Step 2: Generate and run migration**

Run: `npx drizzle-kit generate`
Run: `npx drizzle-kit push`

- [ ] **Step 3: Update POST /api/blocks to accept kind**

In `app/api/blocks/route.ts`, add `kind` to the destructured body and the insert values:

```typescript
const { name, description, content, tags, role, kind } = body

const [block] = await db.insert(blocks).values({
  teamId: orgId,
  name,
  description: description ?? "",
  content: content ?? "",
  role: kind === "tool" ? null : (role ?? null),
  kind: kind ?? "prompt",
  tags: tags ?? [],
}).returning()
```

- [ ] **Step 4: Update PUT /api/blocks/[id] to accept kind**

In `app/api/blocks/[id]/route.ts`, add `kind` to the destructured body and the set clause:

```typescript
const { name, description, content, tags, role, kind } = body
// In the .set() call:
kind: kind ?? existing.kind,
```

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts app/api/blocks/route.ts app/api/blocks/[id]/route.ts drizzle/
git commit -m "feat: add kind column to blocks (prompt|tool)"
```

---

### Task 6: Tool Node in Graph

**Files:**
- Create: `components/editor/nodes/tool-node.tsx`
- Modify: `components/editor/flow-canvas.tsx`
- Modify: `components/editor/node-palette.tsx`
- Modify: `components/editor/properties-panel.tsx`

- [ ] **Step 1: Create the tool node component**

```tsx
// components/editor/nodes/tool-node.tsx
"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"

export function ToolNode({ data }: NodeProps) {
  const { label, paramCount } = data as {
    label: string
    blockId: string
    paramCount?: number
  }

  return (
    <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 min-w-[130px]">
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !h-2 !w-2" />
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className="text-[9px] font-semibold text-amber-500">TOOL</div>
      </div>
      <div className="text-xs font-medium text-foreground">{label}</div>
      {paramCount !== undefined && paramCount > 0 && (
        <div className="text-[9px] font-mono text-muted-foreground mt-1">{paramCount} params</div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !h-2 !w-2" />
    </div>
  )
}
```

- [ ] **Step 2: Register tool node in flow-canvas.tsx**

In `components/editor/flow-canvas.tsx`:

Add the import:
```typescript
import { ToolNode } from "./nodes/tool-node"
```

Add to `nodeTypes` object:
```typescript
tool: ToolNode,
```

Add to `DEFAULT_NODE_DATA`:
```typescript
tool: { blockId: "", label: "New Tool", paramCount: 0 },
```

- [ ] **Step 3: Add tool to node palette**

In `components/editor/node-palette.tsx`, add the import for `Wrench` from lucide-react and add this item to the `paletteItems` array after the `block` entry:

```typescript
{
  type: "tool",
  label: "Tool",
  icon: <Wrench className="h-3.5 w-3.5" />,
  color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  description: "Function calling def",
},
```

- [ ] **Step 4: Add tool node properties to properties-panel**

In `components/editor/properties-panel.tsx`:

Add `Wrench` to the lucide imports.

Add to `NodeTypeIcon`:
```typescript
case "tool": return <Wrench className={cn(cls, "text-amber-400")} />
```

Add to `nodeTypeLabel`:
```typescript
case "tool": return "Tool"
```

Add to the `switch` in `NodeProperties`:
```typescript
case "tool":
  return <ToolProperties nodeId={node.id} data={data} blocks={blocks.filter(b => (b as any).kind === "tool")} onChange={onNodeDataChange} onBlockSaved={onBlockSaved} />
```

Add the `ToolProperties` component (reuses the same pattern as `BlockProperties` but only shows tool-kind blocks):

```tsx
/* ─── Tool Properties ─── */
function ToolProperties({
  nodeId,
  data,
  blocks,
  onChange,
  onBlockSaved,
}: {
  nodeId: string
  data: Record<string, unknown>
  blocks: BlockInfo[]
  onChange: (nodeId: string, data: Record<string, unknown>) => void
  onBlockSaved?: () => void
}) {
  const blockId = data.blockId as string
  const selectedBlock = blocks.find((b) => b.id === blockId)

  return (
    <div className="space-y-3">
      <FieldLabel label="Tool Definition">
        <select
          value={blockId || ""}
          onChange={(e) => {
            const chosen = blocks.find((b) => b.id === e.target.value)
            let paramCount = 0
            if (chosen) {
              try {
                const schema = JSON.parse(chosen.content)
                paramCount = Object.keys(schema.properties ?? {}).length
              } catch {}
            }
            onChange(nodeId, {
              blockId: e.target.value,
              label: chosen?.name ?? "New Tool",
              paramCount,
            })
          }}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
        >
          <option value="">Select a tool...</option>
          {blocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </FieldLabel>
      {selectedBlock && (
        <div className="text-[10px] text-muted-foreground">
          {selectedBlock.description ?? "No description"}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Update blocks fetch to include kind**

In `components/compositions/composition-editor.tsx`, update the `BlockInfo` interface to include `kind`:
```typescript
interface BlockInfo {
  id: string
  name: string
  content: string
  description?: string
  kind?: string
}
```

- [ ] **Step 6: Commit**

```bash
git add components/editor/nodes/tool-node.tsx components/editor/flow-canvas.tsx components/editor/node-palette.tsx components/editor/properties-panel.tsx components/compositions/composition-editor.tsx
git commit -m "feat: add tool node type to graph editor"
```

---

### Task 7: Tool Blocks in Block List UI

**Files:**
- Modify: `components/blocks/block-card.tsx`
- Modify: `components/blocks/block-list.tsx`

- [ ] **Step 1: Add kind badge to block card**

In `components/blocks/block-card.tsx`, add `kind` to the block interface:

```typescript
interface BlockCardProps {
  block: {
    id: string
    name: string
    description: string | null
    content: string
    version: number
    tags: string[]
    updatedAt: string
    kind?: string  // add this
  }
  onClick: () => void
  usedIn: string[]
}
```

In the card JSX, add a badge after the version span:

```tsx
<span className={cn(
  "rounded px-1.5 py-0.5 text-[10px] font-medium",
  block.kind === "tool"
    ? "bg-amber-500/10 text-amber-500"
    : "bg-blue-500/10 text-blue-500"
)}>
  {block.kind === "tool" ? "tool" : "prompt"}
</span>
```

- [ ] **Step 2: Add kind filter to block list**

In `components/blocks/block-list.tsx`, add `kind` to the `Block` interface:

```typescript
kind?: string
```

Add filter state and filter tabs:

```typescript
const [kindFilter, setKindFilter] = useState<"all" | "prompt" | "tool">("all")
```

Update the `filtered` logic:

```typescript
const filtered = blocks.filter((b) => {
  const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase())
  const matchesTags = activeTags.size === 0 || (b.tags ?? []).some((t) => activeTags.has(t))
  const matchesKind = kindFilter === "all" || (b.kind ?? "prompt") === kindFilter
  return matchesSearch && matchesTags && matchesKind
})
```

Add kind tabs before the search bar:

```tsx
<div className="flex gap-1 mb-3">
  {(["all", "prompt", "tool"] as const).map((k) => (
    <button
      key={k}
      onClick={() => setKindFilter(k)}
      className={cn(
        "px-3 py-1 text-xs font-medium rounded-md transition-colors",
        kindFilter === k
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      )}
    >
      {k === "all" ? "All" : k === "tool" ? "Tools" : "Prompts"}
    </button>
  ))}
</div>
```

Update the create dialog to include kind selection, and pass `kind: "tool"` when creating tool blocks.

- [ ] **Step 3: Commit**

```bash
git add components/blocks/block-card.tsx components/blocks/block-list.tsx
git commit -m "feat: add tool/prompt badges and kind filter to block list"
```

---

### Task 8: Graph Engine — Tool Block Assembly

**Files:**
- Modify: `lib/graph-engine.ts`
- Modify: `lib/graph-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/graph-engine.test.ts`:

```typescript
const toolBlocks = {
  ...blocks,
  "b-weather": { name: "get_weather", content: '{"type":"object","properties":{"location":{"type":"string"}},"required":["location"]}', kind: "tool" as const },
  "b-search": { name: "search_products", content: '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}', kind: "tool" as const },
}

// Graph with tool nodes: Start → role → tool(weather) → Output
const toolGraph = {
  nodes: [
    { id: "start", type: "start", data: {} },
    { id: "n1", type: "block", data: { blockId: "b-role" } },
    { id: "t1", type: "tool", data: { blockId: "b-weather" } },
    { id: "output", type: "promptOutput", data: {} },
  ],
  edges: [
    { id: "e1", source: "start", target: "n1" },
    { id: "e2", source: "n1", target: "t1" },
    { id: "e3", source: "t1", target: "output" },
  ],
}

describe("tool block assembly", () => {
  it("collects tool blocks into tools[] and excludes from text", () => {
    const result = assembleGraph(toolGraph.nodes, toolGraph.edges, toolBlocks, {})
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0].name).toBe("get_weather")
    expect(result.tools[0].input_schema).toEqual({
      type: "object",
      properties: { location: { type: "string" } },
      required: ["location"],
    })
    expect(result.text).not.toContain("get_weather")
    expect(result.text).toContain("senior engineer")
  })

  it("conditionally includes tools via IF gates", () => {
    const condToolGraph = {
      nodes: [
        { id: "start", type: "start", data: {} },
        { id: "if", type: "ifBoolean", data: { field: "hasWeather" } },
        { id: "t1", type: "tool", data: { blockId: "b-weather" } },
        { id: "output", type: "promptOutput", data: {} },
      ],
      edges: [
        { id: "e1", source: "start", target: "if" },
        { id: "e2", source: "if", target: "t1", sourceHandle: "true" },
        { id: "e3", source: "if", target: "output", sourceHandle: "false" },
        { id: "e4", source: "t1", target: "output" },
      ],
    }

    const withWeather = assembleGraph(condToolGraph.nodes, condToolGraph.edges, toolBlocks, { hasWeather: true })
    expect(withWeather.tools).toHaveLength(1)

    const withoutWeather = assembleGraph(condToolGraph.nodes, condToolGraph.edges, toolBlocks, { hasWeather: false })
    expect(withoutWeather.tools).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/graph-engine.test.ts`
Expected: FAIL — `tools` property doesn't exist on result

- [ ] **Step 3: Update assembleGraph to handle tool blocks**

In `lib/graph-engine.ts`:

1. Update `BlockLookup` interface:
```typescript
interface BlockLookup {
  [blockId: string]: { content: string; name: string; role?: string | null; kind?: string }
}
```

2. Add `ToolDefinition` type and add `tools` to `AssemblyResult`:
```typescript
interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, any>
}

interface AssemblyResult {
  text: string
  messages: Message[]
  blocks: string[]
  skippedBlocks: string[]
  tokenCount: number
  errors: string[]
  variantId: string | null
  tools: ToolDefinition[]  // add this
}
```

3. Add a `tools` collector at the top of `assembleGraph`:
```typescript
const tools: ToolDefinition[] = []
```

4. Add a `case "tool":` block in the switch statement inside `walk()`, right after `case "block":`:
```typescript
case "tool": {
  const blockId = node.data.blockId as string
  const block = blocks[blockId]
  if (block) {
    try {
      const inputSchema = JSON.parse(block.content)
      tools.push({
        name: block.name,
        description: block.role ?? "", // reuse description field
        input_schema: inputSchema,
      })
    } catch {
      errors.push(`Invalid tool schema for block: ${blockId}`)
    }
    resolvedBlocks.push(block.name)
  } else {
    errors.push(`Tool block not found: ${blockId}`)
  }
  break
}
```

Wait — the `description` field on blocks is stored at the API level but `BlockLookup` doesn't include it. Let me fix the approach. The block's `description` column in the DB holds the tool description. Update `BlockLookup`:

```typescript
interface BlockLookup {
  [blockId: string]: { content: string; name: string; role?: string | null; kind?: string; description?: string }
}
```

And in the tool case:
```typescript
tools.push({
  name: block.name,
  description: block.description ?? "",
  input_schema: inputSchema,
})
```

5. Add `tools` to the return value:
```typescript
return { text, messages, blocks: resolvedBlocks, skippedBlocks, tokenCount, errors, variantId, tools }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/graph-engine.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/graph-engine.ts lib/graph-engine.test.ts
git commit -m "feat: graph engine collects tool blocks into tools[]"
```

---

### Task 9: SDK — Add model, config, tools to ComposeResult

**Files:**
- Modify: `sdk/src/types.ts`
- Modify: `sdk/src/compose.ts`
- Modify: `sdk/src/compose.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `sdk/src/compose.test.ts`:

```typescript
const configWithTools: SDKConfig = {
  version: "1",
  environment: "prod",
  blocks: {
    ...mockConfig.blocks,
    "block-weather": {
      name: "get_weather",
      content: '{"type":"object","properties":{"location":{"type":"string"}},"required":["location"]}',
      version: 1,
      kind: "tool",
      description: "Get current weather",
    },
  },
  compositions: [
    {
      id: "comp-tools",
      name: "with-tools",
      version: 1,
      contextSchema: [],
      metadata: {
        modelConfig: {
          prod: { model: "anthropic/claude-sonnet-4-6", temperature: 0.3, maxTokens: 2048 },
        },
      },
      graph: {
        nodes: [
          { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
          { id: "n-role", type: "block", position: { x: 100, y: 0 }, data: { blockId: "block-role" } },
          { id: "t-weather", type: "tool", position: { x: 200, y: 0 }, data: { blockId: "block-weather" } },
          { id: "output", type: "promptOutput", position: { x: 300, y: 0 }, data: {} },
        ],
        edges: [
          { id: "e1", source: "start", target: "n-role" },
          { id: "e2", source: "n-role", target: "t-weather" },
          { id: "e3", source: "t-weather", target: "output" },
        ],
      },
    },
  ],
}

describe("SDK compose — model, config, tools", () => {
  it("returns model and config from metadata", () => {
    const result = compose(configWithTools, "with-tools", {})
    expect(result.model).toBe("anthropic/claude-sonnet-4-6")
    expect(result.config).toEqual({ temperature: 0.3, maxTokens: 2048 })
  })

  it("returns tools array from tool blocks", () => {
    const result = compose(configWithTools, "with-tools", {})
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0].name).toBe("get_weather")
    expect(result.tools[0].input_schema.required).toEqual(["location"])
  })

  it("excludes tool block content from text", () => {
    const result = compose(configWithTools, "with-tools", {})
    expect(result.text).toContain("senior engineer")
    expect(result.text).not.toContain("location")
  })

  it("returns null model when no modelConfig", () => {
    const result = compose(mockConfig, "builder", { projectType: "web", hasAuth: false })
    expect(result.model).toBeNull()
    expect(result.config).toBeNull()
    expect(result.tools).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run sdk/src/compose.test.ts`
Expected: FAIL — `model`, `config`, `tools` not on result

- [ ] **Step 3: Update SDK types**

In `sdk/src/types.ts`:

Add to the block type in `SDKConfig`:
```typescript
blocks: Record<string, { name: string; content: string; version: number; role?: string | null; kind?: string; description?: string }>
```

Add `metadata` to the composition type:
```typescript
metadata?: Record<string, any>
```

Add new interfaces and update `ComposeResult`:
```typescript
export interface ModelConfig {
  temperature?: number
  maxTokens?: number
  topP?: number
  stopSequences?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, any>
}

export interface ComposeResult {
  id: string
  text: string
  messages: Message[]
  model: string | null
  config: ModelConfig | null
  tools: ToolDefinition[]
  version: string
  variantId: string | null
  tokenCount: number
  blocks: string[]
  compositionName: string
  errors: string[]
}
```

- [ ] **Step 4: Update SDK compose logic**

In `sdk/src/compose.ts`, update the `compose` function:

1. Add a `tools` collector alongside `parts`:
```typescript
const tools: Array<{ name: string; description: string; input_schema: Record<string, any> }> = []
```

2. In the `walk` function, update the block handling to check for tool kind:
```typescript
if (node.type === "block" || node.type === "tool") {
  const block = config.blocks[node.data.blockId]
  if (block) {
    if (block.kind === "tool" || node.type === "tool") {
      try {
        const inputSchema = JSON.parse(block.content)
        tools.push({ name: block.name, description: block.description ?? "", input_schema: inputSchema })
      } catch {}
      resolvedBlocks.push(block.name)
    } else {
      // existing block logic (template rendering, role handling)
      const content = renderTemplate(block.content, renderCtx)
      parts.push(content)
      resolvedBlocks.push(block.name)
      const blockRole = block.role || "system"
      if (currentRole !== null && currentRole !== blockRole) {
        flushRole()
      }
      currentRole = blockRole
      currentRoleContent.push(content)
    }
  }
```

3. After the walk, extract model config:
```typescript
const modelConfig = comp.metadata?.modelConfig?.[config.environment] ?? null
const model = modelConfig?.model ?? null
const configResult = model ? {
  temperature: modelConfig.temperature,
  maxTokens: modelConfig.maxTokens,
  topP: modelConfig.topP,
  stopSequences: modelConfig.stopSequences,
} : null
// Remove undefined keys
if (configResult) {
  for (const key of Object.keys(configResult) as (keyof typeof configResult)[]) {
    if (configResult[key] === undefined) delete configResult[key]
  }
}
```

4. Add to return:
```typescript
return {
  id: `asm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  text,
  messages,
  model,
  config: configResult,
  tools,
  version: `v${comp.version}`,
  // ...rest unchanged
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run sdk/src/compose.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add sdk/src/types.ts sdk/src/compose.ts sdk/src/compose.test.ts
git commit -m "feat: SDK compose returns model, config, and tools"
```

---

### Task 10: Go SDK — Add model, config, tools

**Files:**
- Modify: `sdk-go/types.go`
- Modify: `sdk-go/compose.go`
- Modify: `sdk-go/compose_test.go`

- [ ] **Step 1: Update Go types**

In `sdk-go/types.go`, add new types and fields to `ComposeResult`:

```go
type ModelConfig struct {
	Temperature    *float64 `json:"temperature,omitempty"`
	MaxTokens      *int     `json:"maxTokens,omitempty"`
	TopP           *float64 `json:"topP,omitempty"`
	StopSequences  []string `json:"stopSequences,omitempty"`
}

type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
}
```

Add to `ComposeResult`:
```go
Model  string           `json:"model"`
Config *ModelConfig      `json:"config"`
Tools  []ToolDefinition  `json:"tools"`
```

Add `Kind` and `Description` fields to the block struct in `SDKConfig`.

- [ ] **Step 2: Update compose.go to handle tool blocks and model config**

Follow the same pattern as the TypeScript SDK — check `block.Kind == "tool"` or `node.Type == "tool"`, parse content as JSON into `input_schema`, collect into `tools` slice. Read model config from `composition.Metadata.ModelConfig[environment]`.

- [ ] **Step 3: Add tests to compose_test.go**

Add a test with tool blocks and model config, verify `result.Model`, `result.Config`, and `result.Tools` are populated correctly.

- [ ] **Step 4: Run tests**

Run: `cd sdk-go && go test ./...`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add sdk-go/
git commit -m "feat: Go SDK returns model, config, and tools"
```

---

### Task 11: Python SDK — Add model, config, tools

**Files:**
- Modify: `sdk/python/composr/types.py`
- Modify: `sdk/python/composr/compose.py`
- Modify: `sdk/python/tests/test_compose.py`

- [ ] **Step 1: Update Python types**

Add `ModelConfig`, `ToolDefinition` dataclasses and update `ComposeResult` with `model`, `config`, `tools` fields.

- [ ] **Step 2: Update compose.py**

Same logic as TypeScript — check `kind == "tool"`, parse content as JSON, collect into `tools` list. Read model config from composition metadata.

- [ ] **Step 3: Add tests**

Add tests verifying model, config, tools are returned and tool content is excluded from text.

- [ ] **Step 4: Run tests**

Run: `cd sdk/python && python -m pytest`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add sdk/python/
git commit -m "feat: Python SDK returns model, config, and tools"
```

---

### Task 12: Server API — Return model, config, tools

**Files:**
- Modify: `app/api/sdk/config/[env]/route.ts`
- Modify: `app/api/v1/compose/route.ts`

- [ ] **Step 1: Update config endpoint to include kind**

In `app/api/sdk/config/[env]/route.ts`, update the `blockLookup` to include `kind` and `description`:

```typescript
const blockLookup: Record<string, { name: string; content: string; version: number; role: string | null; kind: string; description: string | null }> = {}
for (const b of teamBlocks) {
  blockLookup[b.id] = { name: b.name, content: b.content, version: b.version, role: b.role, kind: b.kind, description: b.description }
}
```

- [ ] **Step 2: Update compose endpoint to return model, config, tools**

In `app/api/v1/compose/route.ts`, update the `blockLookup` to include `kind` and `description`. Then update the response to include the new fields:

```typescript
const blockLookup: Record<string, { name: string; content: string; kind: string; description: string | null }> = {}
for (const b of teamBlocks) {
  blockLookup[b.id] = { name: b.name, content: b.content, kind: b.kind, description: b.description }
}
```

After `assembleGraph`, extract model config:

```typescript
const modelConfig = (comp.metadata as any)?.modelConfig?.[apiKey.environment] ?? null
const model = modelConfig?.model ?? null
const config = model ? {
  temperature: modelConfig.temperature,
  maxTokens: modelConfig.maxTokens,
  topP: modelConfig.topP,
  stopSequences: modelConfig.stopSequences,
} : null
```

Add to response JSON:
```typescript
return NextResponse.json({
  id: assemblyId,
  text: result.text,
  messages: result.messages,
  model,
  config,
  tools: result.tools,
  version: `v${activeVersion}`,
  variantId: result.variantId,
  tokenCount: result.tokenCount,
  blocks: result.blocks,
  compositionName: comp.name,
})
```

- [ ] **Step 3: Commit**

```bash
git add app/api/sdk/config/[env]/route.ts app/api/v1/compose/route.ts
git commit -m "feat: API endpoints return model, config, and tools"
```

---

### Task 13: Provider Abstraction Layer

**Files:**
- Create: `lib/providers/types.ts`
- Create: `lib/providers/anthropic.ts`
- Create: `lib/providers/openai.ts`
- Create: `lib/providers/index.ts`

- [ ] **Step 1: Install provider SDKs**

Run: `npm install @anthropic-ai/sdk openai`

- [ ] **Step 2: Create provider types**

```typescript
// lib/providers/types.ts
export interface StreamEvent {
  type: "text_delta" | "tool_use" | "done" | "error"
  content?: string
  tool?: string
  input?: Record<string, any>
  toolUseId?: string
  cost?: number
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  error?: string
}

export interface ProviderParams {
  model: string
  messages: Array<{ role: string; content: string }>
  tools?: Array<{ name: string; description: string; input_schema: Record<string, any> }>
  config?: { temperature?: number; maxTokens?: number; topP?: number; stopSequences?: string[] }
  apiKey: string
}

export interface Provider {
  stream(params: ProviderParams): AsyncIterable<StreamEvent>
}
```

- [ ] **Step 3: Create Anthropic provider**

```typescript
// lib/providers/anthropic.ts
import Anthropic from "@anthropic-ai/sdk"
import type { Provider, ProviderParams, StreamEvent } from "./types"

export class AnthropicProvider implements Provider {
  async *stream(params: ProviderParams): AsyncIterable<StreamEvent> {
    const client = new Anthropic({ apiKey: params.apiKey })

    const systemMessages = params.messages.filter((m) => m.role === "system")
    const nonSystemMessages = params.messages.filter((m) => m.role !== "system")

    const startTime = Date.now()

    const stream = client.messages.stream({
      model: params.model,
      system: systemMessages.map((m) => ({ type: "text" as const, text: m.content })),
      messages: nonSystemMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      max_tokens: params.config?.maxTokens ?? 1024,
      temperature: params.config?.temperature,
      top_p: params.config?.topP,
      stop_sequences: params.config?.stopSequences,
      tools: params.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })),
    })

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          yield { type: "text_delta", content: event.delta.text }
        } else if (event.delta.type === "input_json_delta") {
          // partial tool input — accumulate on client side
        }
      } else if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          yield { type: "tool_use", tool: event.content_block.name, toolUseId: event.content_block.id, input: {} }
        }
      } else if (event.type === "message_stop") {
        const finalMessage = await stream.finalMessage()
        yield {
          type: "done",
          latencyMs: Date.now() - startTime,
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        }
      }
    }
  }
}
```

- [ ] **Step 4: Create OpenAI provider**

```typescript
// lib/providers/openai.ts
import OpenAI from "openai"
import type { Provider, ProviderParams, StreamEvent } from "./types"

export class OpenAIProvider implements Provider {
  async *stream(params: ProviderParams): AsyncIterable<StreamEvent> {
    const client = new OpenAI({ apiKey: params.apiKey })

    const startTime = Date.now()

    const stream = await client.chat.completions.create({
      model: params.model,
      messages: params.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
      max_tokens: params.config?.maxTokens,
      temperature: params.config?.temperature,
      top_p: params.config?.topP,
      stop: params.config?.stopSequences?.length ? params.config.stopSequences : undefined,
      tools: params.tools?.length ? params.tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })) : undefined,
      stream: true,
      stream_options: { include_usage: true },
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (delta?.content) {
        yield { type: "text_delta", content: delta.content }
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            yield { type: "tool_use", tool: tc.function.name, toolUseId: tc.id ?? "", input: {} }
          }
        }
      }
      if (chunk.usage) {
        yield {
          type: "done",
          latencyMs: Date.now() - startTime,
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
        }
      }
    }
  }
}
```

- [ ] **Step 5: Create provider factory**

```typescript
// lib/providers/index.ts
import type { Provider } from "./types"
import { AnthropicProvider } from "./anthropic"
import { OpenAIProvider } from "./openai"

const providers: Record<string, () => Provider> = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
}

export function getProvider(name: string): Provider {
  const factory = providers[name]
  if (!factory) throw new Error(`Unknown provider: ${name}`)
  return factory()
}

export type { Provider, StreamEvent, ProviderParams } from "./types"
```

- [ ] **Step 6: Commit**

```bash
git add lib/providers/ package.json package-lock.json
git commit -m "feat: add provider abstraction layer for Anthropic and OpenAI"
```

---

### Task 14: Playground API Route

**Files:**
- Create: `app/api/playground/run/route.ts`

- [ ] **Step 1: Create the playground endpoint**

```typescript
// app/api/playground/run/route.ts
import { db } from "@/lib/db"
import { compositions, blocks, providerKeys } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { assembleGraph } from "@/lib/graph-engine"
import { decrypt } from "@/lib/encryption"
import { getProvider } from "@/lib/providers"

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })

  const { compositionId, context, userMessage, environment } = await req.json()

  // Look up composition
  const [comp] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, compositionId), eq(compositions.teamId, orgId)))

  if (!comp) return new Response(JSON.stringify({ error: "Composition not found" }), { status: 404 })

  // Get model config
  const metadata = comp.metadata as Record<string, any>
  const modelConfig = metadata?.modelConfig?.[environment ?? "dev"]
  if (!modelConfig?.model) {
    return new Response(
      JSON.stringify({ error: `No model configured for ${environment ?? "dev"} environment. Set one in the Properties panel.` }),
      { status: 400 }
    )
  }

  // Parse provider from model string
  const [providerName, modelName] = modelConfig.model.split("/")
  if (!providerName || !modelName) {
    return new Response(JSON.stringify({ error: `Invalid model format: ${modelConfig.model}` }), { status: 400 })
  }

  // Fetch provider key
  const [providerKey] = await db
    .select()
    .from(providerKeys)
    .where(and(eq(providerKeys.teamId, orgId), eq(providerKeys.provider, providerName)))

  if (!providerKey) {
    return new Response(
      JSON.stringify({ error: `No API key configured for ${providerName}. Add one in Settings → Providers.` }),
      { status: 400 }
    )
  }

  const apiKey = decrypt(providerKey.encryptedKey, ENCRYPTION_KEY)

  // Get all blocks
  const teamBlocks = await db.select().from(blocks).where(eq(blocks.teamId, orgId))
  const blockLookup: Record<string, { content: string; name: string; role?: string | null; kind?: string; description?: string | null }> = {}
  for (const b of teamBlocks) {
    blockLookup[b.id] = { content: b.content, name: b.name, role: b.role, kind: b.kind, description: b.description }
  }

  // Assemble prompt
  const graph = comp.graph as { nodes: any[]; edges: any[] }
  const assembled = assembleGraph(graph.nodes, graph.edges, blockLookup, context ?? {})

  // Build messages: assembled system messages + user message
  const messages = [
    ...assembled.messages,
    ...(userMessage ? [{ role: "user", content: userMessage }] : []),
  ]

  // Stream from provider
  const provider = getProvider(providerName)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of provider.stream({
          model: modelName,
          messages,
          tools: assembled.tools,
          config: {
            temperature: modelConfig.temperature,
            maxTokens: modelConfig.maxTokens,
            topP: modelConfig.topP,
            stopSequences: modelConfig.stopSequences,
          },
          apiKey,
        })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: err instanceof Error ? err.message : "Unknown error" })}\n\n`)
        )
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/playground/run/route.ts
git commit -m "feat: add playground SSE endpoint for testing compositions"
```

---

### Task 15: Playground UI — Test Panel

**Files:**
- Create: `components/editor/test-panel.tsx`
- Modify: `components/compositions/composition-editor.tsx`

- [ ] **Step 1: Create the test panel component**

```tsx
// components/editor/test-panel.tsx
"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, Loader2 } from "lucide-react"
import type { ContextField } from "@/components/editor/context-schema-editor"

interface TestPanelProps {
  compositionId: string
  contextSchema: ContextField[]
}

function generateSkeleton(schema: ContextField[]): string {
  const obj: Record<string, any> = {}
  for (const field of schema) {
    const parts = field.name.split(".")
    let current = obj
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {}
      current = current[parts[i]]
    }
    const last = parts[parts.length - 1]
    switch (field.type) {
      case "boolean": current[last] = false; break
      case "number": current[last] = 0; break
      default: current[last] = ""
    }
  }
  return JSON.stringify(obj, null, 2)
}

interface ToolCallEvent {
  tool: string
  input: Record<string, any>
}

export function TestPanel({ compositionId, contextSchema }: TestPanelProps) {
  const [contextText, setContextText] = useState(() => generateSkeleton(contextSchema))
  const [userMessage, setUserMessage] = useState("")
  const [environment, setEnvironment] = useState("dev")
  const [running, setRunning] = useState(false)
  const [response, setResponse] = useState("")
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([])
  const [metrics, setMetrics] = useState<{ latencyMs?: number; inputTokens?: number; outputTokens?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function run() {
    setRunning(true)
    setResponse("")
    setToolCalls([])
    setMetrics(null)
    setError(null)

    let context: Record<string, any> = {}
    try {
      context = JSON.parse(contextText)
    } catch {
      setError("Invalid JSON in context")
      setRunning(false)
      return
    }

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/playground/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compositionId, context, userMessage, environment }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Request failed")
        setRunning(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const event = JSON.parse(line.slice(6))
          switch (event.type) {
            case "text_delta":
              setResponse((prev) => prev + event.content)
              break
            case "tool_use":
              setToolCalls((prev) => [...prev, { tool: event.tool, input: event.input }])
              break
            case "done":
              setMetrics({ latencyMs: event.latencyMs, inputTokens: event.inputTokens, outputTokens: event.outputTokens })
              break
            case "error":
              setError(event.error)
              break
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message)
      }
    }
    setRunning(false)
  }

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
          Context
        </label>
        <textarea
          value={contextText}
          onChange={(e) => setContextText(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground resize-none"
          rows={6}
          spellCheck={false}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
            Environment
          </label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="prod">prod</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button size="sm" onClick={run} disabled={running} className="gap-1.5">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Running..." : "Run"}
          </Button>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
          User Message
        </label>
        <Input
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder="Type a test message..."
          className="text-xs"
          onKeyDown={(e) => { if (e.key === "Enter" && !running) run() }}
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {(response || toolCalls.length > 0) && (
        <div className="border-t border-border pt-3">
          <label className="text-[10px] font-medium uppercase tracking-wider text-emerald-500 mb-1 block">
            Response
          </label>
          {response && (
            <div className="rounded-md border border-border bg-background/50 px-3 py-2 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {response}
            </div>
          )}
          {toolCalls.map((tc, i) => (
            <div key={i} className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <div className="text-[10px] font-medium text-amber-500 mb-1">Tool Call: {tc.tool}</div>
              <pre className="text-[10px] font-mono text-muted-foreground">
                {JSON.stringify(tc.input, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      {metrics && (
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          {metrics.latencyMs && <span>{(metrics.latencyMs / 1000).toFixed(1)}s</span>}
          {metrics.inputTokens && <span>In: {metrics.inputTokens}</span>}
          {metrics.outputTokens && <span>Out: {metrics.outputTokens}</span>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Test tab to composition editor**

In `components/compositions/composition-editor.tsx`:

Add the import:
```typescript
import { TestPanel } from "@/components/editor/test-panel"
```

Add `testOpen` state:
```typescript
const [testOpen, setTestOpen] = useState(false)
```

Add `FlaskConical` icon import (already imported). Add a Test button to the toolbar next to Preview:
```tsx
<Button
  size="sm"
  variant={testOpen ? "default" : "outline"}
  className="gap-1.5"
  onClick={() => setTestOpen(!testOpen)}
>
  <Play className="h-3.5 w-3.5" /> Test
</Button>
```

Add the TestPanel alongside the PreviewPanel at the bottom of the editor:
```tsx
{testOpen && (
  <div className="border-t border-border h-[300px]">
    <TestPanel compositionId={id} contextSchema={contextSchema} />
  </div>
)}
```

- [ ] **Step 3: Verify the full flow**

Run: `npm run dev`
1. Go to Settings → add an Anthropic provider key
2. Open a composition → Properties → set model config for dev (e.g. `anthropic/claude-haiku-4-5`)
3. Save the composition
4. Click Test → fill context → type a message → click Run
5. Response should stream in

- [ ] **Step 4: Commit**

```bash
git add components/editor/test-panel.tsx components/compositions/composition-editor.tsx
git commit -m "feat: add playground test panel to composition editor"
```

---

### Task 16: Final Integration Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Run: `cd sdk-go && go test ./...`
Run: `cd sdk/python && python -m pytest`
Expected: All tests PASS

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Manual end-to-end test**

1. Settings → Add Anthropic key → verify "Connected" badge
2. Blocks → Create a tool block → verify dual badge (prompt/tool filter)
3. Composition editor → drag a tool node → assign tool block → verify orange accent
4. Properties panel → set model config per env → save
5. Test panel → fill context → Run → verify streamed response
6. SDK: `compose()` returns `model`, `config`, `tools` fields

- [ ] **Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for batch 1 features"
```
