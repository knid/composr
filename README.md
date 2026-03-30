<p align="center">
  <img src="https://github.com/user-attachments/assets/placeholder-logo" alt="Composr" width="80" />
</p>

<h1 align="center">Composr</h1>

<p align="center">
  <strong>The prompt compiler for AI-first teams.</strong><br />
  Compose, version, test, and score your prompt systems — without code deploys.
</p>

<p align="center">
  <a href="https://composr.dev/docs">Docs</a> &middot;
  <a href="https://composr.dev/docs/quickstart">Quickstart</a> &middot;
  <a href="https://app.composr.dev">Dashboard</a> &middot;
  <a href="https://composr.dev/discord">Discord</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@composr/sdk"><img src="https://img.shields.io/npm/v/@composr/sdk?style=flat-square&color=7c3aed&label=npm" alt="npm" /></a>
  <a href="https://pkg.go.dev/github.com/composr/sdk-go"><img src="https://img.shields.io/badge/go-pkg.go.dev-7c3aed?style=flat-square" alt="Go" /></a>
  <a href="https://github.com/composr/composr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-7c3aed?style=flat-square" alt="License" /></a>
  <a href="https://composr.dev/discord"><img src="https://img.shields.io/badge/discord-join-7c3aed?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
</p>

<br />

<p align="center">
  <img src="https://github.com/user-attachments/assets/placeholder-screenshot" alt="Composr Editor" width="800" />
</p>

---

Existing tools treat prompts as flat documents with variable slots. **Real prompt systems are programs** — with shared blocks, conditional branches, A/B variants, and multi-step pipelines.

Composr is the first tool to treat them that way. Think **n8n for prompts** — a visual flow editor where blocks are nodes, conditions are IF gates, and experiments are percentage splits. Your SDK assembles prompts locally in <1ms from synced configs. No deploys to change a prompt. Ever.

<br />

<table>
<tr>
<td width="50%" valign="top">

<h3>I use AI in production</h3>

Stop hardcoding prompts in Go constants, Python strings, and config files. Move them to Composr and get versioning, A/B testing, and scoring for free.

**[Jump to quickstart](#quickstart)**

</td>
<td width="50%" valign="top">

<h3>I'm exploring</h3>

See why teams at AI-first companies are switching from flat prompt management to composable prompt programs.

**[Jump to how it works](#how-it-works)**

</td>
</tr>
</table>

---

## Why Composr?

Every AI company hits the same wall. You start with a few prompts hardcoded in your backend. Then you need variants for different contexts. Then conditional blocks. Then A/B testing. Suddenly you're managing a complex prompt program in raw code — and every change requires a PR, review, deploy, and pray.

| Pain | Before Composr | With Composr |
|------|-------------------|----------------|
| Changing a prompt | Code PR &rarr; review &rarr; deploy &rarr; 30 min | Edit in UI &rarr; publish &rarr; 2 seconds |
| Testing variants | Manual, no data | A/B split with statistical significance |
| Scoring quality | Guessing | LLM-as-judge auto-eval on every output |
| Conditional logic | Hardcoded if/else chains | Visual IF nodes, drag and connect |
| Multi-project types | Copy-paste with divergence | Shared blocks, composed per context |
| Rollback | Git revert and redeploy | One click |

---

## Features

| | Feature | Description |
|---|---|---|
| **Visual Flow Editor** | n8n-style canvas where blocks are nodes and conditions are IF gates. Drag, connect, compose. React Flow powered. |
| **8 Node Types** | Start, Output, Block, IF Boolean, IF Switch, IF Percentage (A/B), IF Expression, Merge |
| **Composable Blocks** | Reusable prompt fragments with version history. Share across compositions. |
| **Conditional Assembly** | Route on any parameter — context vars, user ID, country, time of day, custom expressions. |
| **A/B Testing** | Percentage IF nodes split traffic deterministically. Welch's t-test for statistical significance. |
| **Auto-Scoring** | LLM-as-judge evaluates outputs automatically. 3 built-in scorers + custom. |
| **SDK (TypeScript + Go)** | Syncs config, assembles locally in <1ms. Zero network calls on the hot path. |
| **Live Preview** | See the assembled prompt for any context — updates as you edit the flow. |
| **Environments** | dev &rarr; staging &rarr; prod with one-click promotion and instant rollback. |
| **Real-time Push** | SSE stream pushes config changes to connected SDKs instantly. |
| **Audit Log** | Every mutation tracked — who changed what, when. |
| **Rate Limiting** | Built-in sliding window protection for SDK endpoints. |

---

## Quickstart

### 1. Install the SDK

```bash
npm install @composr/sdk
```

```bash
go get github.com/composr/sdk-go
```

### 2. Three lines to assemble a prompt

**TypeScript:**

```typescript
import { Composr } from '@composr/sdk'

const pk = new Composr({ apiKey: 'pk_live_...', environment: 'prod' })

const result = await pk.compose('builder', {
  projectType: 'ecommerce',
  hasAuth: true,
  outputMode: 'chat',
})

console.log(result.text)       // fully assembled prompt
console.log(result.tokenCount) // 14200
console.log(result.blocks)     // ["role", "design-philosophy", "framework-rules", ...]
```

**Go:**

```go
pk := composr.New(composr.Config{
    APIKey:      "pk_live_...",
    Environment: "prod",
})
defer pk.Close()

result, _ := pk.Compose("builder", composr.ComposeContext{
    "projectType": "ecommerce",
    "hasAuth":     true,
    "outputMode":  "chat",
})

fmt.Println(result.Text)       // fully assembled prompt
fmt.Println(result.TokenCount) // 14200
```

### 3. Track outputs for auto-scoring

```typescript
// After your LLM responds:
await pk.track(result.id, {
  input: userPrompt,
  output: llmResponse,
  model: 'claude-sonnet-4.6',
  latencyMs: 3200,
})
// Platform auto-scores quality, relevance, instruction-following
```

That's it. Your prompts are now managed, versioned, scored, and A/B testable.

---

## How It Works

```
Your application
       |
       v
   Composr SDK (local, <1ms)
       |
       |── 1. Syncs config on startup (REST + SSE for live updates)
       |── 2. Caches compositions + blocks in memory
       |── 3. On compose(): walks the flow graph locally
       |      |
       |      |── Block nodes → append prompt text
       |      |── IF Boolean → evaluate context field, take true/false branch
       |      |── IF Switch → match context value, take matching branch
       |      |── IF Percentage → deterministic hash, select A/B variant
       |      |── IF Expression → evaluate custom expression
       |      |── Merge → rejoin branches
       |      |
       |      └── Returns assembled text + metadata (version, variant, tokens)
       |
       └── 4. track() sends LLM output for auto-scoring (async, non-blocking)
```

**Zero network calls** on the hot path. The SDK assembles prompts locally from cached config. Config syncs in the background via SSE — when you publish a change in the dashboard, connected SDKs pick it up within seconds.

---

## The Editor

The composition editor is the core product experience. It's a React Flow canvas with three areas:

**Canvas** (center) — Drag nodes from the palette, connect them, configure IF conditions. Zoomable, pannable, with minimap.

**Block Editor** (right panel) — Monaco editor for block content. Syntax highlighting, token count, version history.

**Preview** (bottom) — Live assembled prompt for test context. Toggle context values and see which blocks are included/excluded in real time.

### Node Types

| Node | Visual | Purpose |
|------|--------|---------|
| **Start** | Green circle | Entry point, receives context |
| **Block** | Green rectangle | Appends a prompt fragment |
| **IF Boolean** | Purple "IF" | True/false branch on a context field |
| **IF Switch** | Purple "SW" | Multi-branch on enum value (like `projectType`) |
| **IF Percentage** | Purple "%%" | A/B split with deterministic user hashing |
| **IF Expression** | Purple "EX" | Custom expression (`_time.hour >= 18 && _req.country == "TR"`) |
| **Merge** | Purple pill | Rejoins branches |
| **Output** | Red circle | Returns assembled text |

### IF Parameters

Every IF node can evaluate against:

| Source | Examples | How |
|--------|----------|-----|
| **Context vars** | `projectType`, `hasAuth`, `userTier` | Passed by SDK at compose time |
| **Request metadata** | `_req.ip`, `_req.country`, `_req.userId` | Auto-captured by SDK |
| **Time** | `_time.hour`, `_time.dayOfWeek` | Evaluated at assembly time |
| **Environment** | `_env.name` | dev / staging / prod |
| **Custom expressions** | `_time.hour >= 18 && _req.country == "TR"` | Full expression support |

---

## Scoring

Three layers, from zero-effort to custom:

### Layer 1: Automatic (always on)

Assembly success, token efficiency, latency, response status — tracked on every call for free.

### Layer 2: Auto-Eval (opt-in)

LLM-as-judge scores a sample of outputs automatically:

| Scorer | What it measures |
|--------|-----------------|
| Instruction Following | Does the output follow the prompt? |
| Output Quality | Coherence, completeness, professionalism |
| Relevance | Is the output relevant to the input? |

Enable per composition. Configure sample rate (default 20%). Uses your judge model of choice.

### Layer 3: Custom Scorers

Define your own evaluation criteria — JS functions or custom judge prompts.

---

## A/B Testing

Experiments are built into the flow — not a separate system.

1. Add a **Percentage IF node**: `50% → v2, 50% → v1`
2. SDK assigns users deterministically (same user always sees same variant)
3. Scores flow in via `pk.track()` — auto-eval runs automatically
4. Dashboard shows winner with **statistical significance** (Welch's t-test)
5. Promote the winner with one click

No experiment setup. No SDK changes. Just add a node and connect it.

---

## Self-Hosting

Composr is open source. Deploy it anywhere:

```bash
git clone https://github.com/composr/composr
cd composr
cp .env.example .env.local
# Edit .env.local with your Clerk + Neon credentials
npm install
npx drizzle-kit push
npm run dev
```

Or deploy to Vercel in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/composr/composr)

---

## Architecture

```
composr/
├── app/                    # Next.js 16 App Router
│   ├── (app)/              # Authenticated pages (dashboard, editor, etc.)
│   └── api/                # REST API (blocks, compositions, SDK endpoints)
├── components/
│   ├── editor/             # React Flow canvas + node components
│   ├── layout/             # Sidebar, header
│   └── ui/                 # shadcn/ui primitives
├── lib/
│   ├── schema.ts           # Drizzle ORM (PostgreSQL)
│   ├── graph-engine.ts     # Flow graph → assembled text
│   ├── expression-parser.ts # Safe expression evaluator
│   ├── statistics.ts       # Welch's t-test for experiments
│   └── eval-runner.ts      # LLM-as-judge scorer
├── sdk/                    # TypeScript SDK (@composr/sdk)
└── sdk-go/                 # Go SDK (github.com/composr/sdk-go)
```

**Tech stack:** Next.js 16 &middot; TypeScript &middot; Tailwind CSS &middot; shadcn/ui &middot; React Flow &middot; Drizzle ORM &middot; Neon Postgres &middot; Clerk

---

## SDK Reference

### TypeScript

```bash
npm install @composr/sdk
```

| Method | Description |
|--------|-------------|
| `new Composr(config)` | Initialize with API key and environment |
| `pk.compose(name, context)` | Assemble a prompt locally (<1ms) |
| `pk.track(id, payload)` | Send LLM output for auto-scoring |
| `pk.score(id, metrics)` | Send manual metrics |
| `pk.destroy()` | Stop background sync |

### Go

```bash
go get github.com/composr/sdk-go
```

| Method | Description |
|--------|-------------|
| `composr.New(config)` | Create client |
| `pk.Compose(name, ctx)` | Assemble a prompt locally (<1ms) |
| `pk.Track(id, payload)` | Send LLM output for auto-scoring |
| `pk.Score(id, metrics)` | Send manual metrics |
| `pk.Close()` | Stop background sync |

### REST API

```bash
# Compose
curl -X POST https://app.composr.dev/api/sdk/config/prod \
  -H "Authorization: Bearer pk_live_..."

# Track
curl -X POST https://app.composr.dev/api/sdk/track \
  -H "Authorization: Bearer pk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"assemblyId":"asm_...","input":"...","output":"...","model":"claude-sonnet-4.6"}'
```

---

## Comparison

| | Composr | Langfuse | Braintrust | Humanloop |
|---|---|---|---|---|
| Composable blocks | Yes | No | No | No |
| Visual flow editor | Yes (React Flow) | No | No | No |
| Conditional IF nodes | Yes (4 types) | No | No | No |
| A/B testing | Built into flow | Prompt labels | Experiments | Experiments |
| Auto-scoring | LLM-as-judge | LLM-as-judge | AutoEvals | Model evals |
| Local assembly (<1ms) | Yes | No (API call) | No (API call) | No (API call) |
| Real-time push (SSE) | Yes | No | No | No |
| Go SDK | Yes | No | No | No |
| Open source | Yes (MIT) | Yes (MIT) | No | No |
| Self-hostable | Yes | Yes | No | No |

**Composr treats prompts as programs. Everyone else treats them as documents.**

---

## Contributing

We love contributions. Check out the [Contributing Guide](CONTRIBUTING.md) for setup instructions and guidelines.

```bash
git clone https://github.com/composr/composr
cd composr
npm install
cp .env.example .env.local
npm run dev
```

---

## Community

- [Discord](https://composr.dev/discord) — Chat with the team and other users
- [GitHub Discussions](https://github.com/composr/composr/discussions) — Questions and feature requests
- [Twitter / X](https://twitter.com/composrdev) — Updates and announcements

---

## License

MIT. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Stop deploying to change a prompt.</strong>
</p>
