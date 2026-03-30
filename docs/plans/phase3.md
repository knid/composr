# PromptKit Phase 3: Advanced Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IF Expression nodes, LLM-as-judge auto-eval, custom scorers, logs explorer, and pipeline view — completing the core product vision.

**Architecture:** Expression nodes use a safe manual parser (NO use of eval or Function constructor — all expressions are parsed and interpreted character by character for security). Auto-eval uses Anthropic API for LLM-as-judge calls. Custom scorers are user-defined judge prompts stored in evalConfigs. Pipeline view uses React Flow to visualize multi-composition chains. Logs explorer provides searchable assembly history.

**Tech Stack:** Same as Phase 1-2

**Spec:** `docs/superpowers/specs/2026-03-30-promptkit-design.md`

**Repo:** `/home/knid/Projects/promptkit`

---

## Task 1: IF Expression Node

Create a safe expression evaluator that manually parses expressions (comparisons, AND/OR/NOT, nested paths) without using any form of dynamic code execution. Add the IF Expression node to the flow editor and graph engine.

**Files:**
- Create: `lib/expression-parser.ts` — Safe expression parser (manual tokenization, no dynamic code execution)
- Create: `lib/expression-parser.test.ts`
- Create: `components/editor/nodes/if-expression-node.tsx`
- Modify: `components/editor/flow-canvas.tsx` — register ifExpression
- Modify: `lib/graph-engine.ts` — add ifExpression case
- Modify: `sdk/src/compose.ts` — add ifExpression case
- Copy: `lib/expression-parser.ts` → `sdk/src/expression-parser.ts`

## Task 2: LLM-as-Judge Auto-Eval Runner

Create the eval runner that sends LLM outputs to a judge model and parses structured scores.

**Files:**
- Create: `lib/eval-runner.ts`
- Create: `app/api/eval/run/route.ts`

## Task 3: Custom Scorer Management API

CRUD for eval configs (per-composition scorer settings).

**Files:**
- Create: `app/api/eval-configs/route.ts`
- Create: `app/api/eval-configs/[id]/route.ts`

## Task 4: Logs Explorer Page

Searchable table of assembly logs with time, composition, version, variant, model, latency, score, eval status.

**Files:**
- Create: `app/(app)/logs/page.tsx`
- Modify: `components/layout/sidebar.tsx`

## Task 5: Pipeline View Page

React Flow canvas showing compositions as draggable nodes for visual pipeline overview.

**Files:**
- Create: `app/(app)/pipelines/page.tsx`
- Modify: `components/layout/sidebar.tsx`
