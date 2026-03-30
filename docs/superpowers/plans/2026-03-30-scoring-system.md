# Scoring System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 missing scorers, custom code/composite scorers, and promote-winner action.

**Architecture:** Extend existing eval-runner with new judge prompts, a deterministic structured_output scorer, code scorer evaluation (restricted to safe numeric expressions), and composite scorer aggregation. Add scorer type to schema. Add promote button to experiment cards.

**Tech Stack:** TypeScript, Drizzle ORM, Anthropic API, vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/eval-runner.ts` | Modify | Add judge prompts, structured_output, code scorer, composite scorer |
| `lib/eval-runner.test.ts` | Create | Tests for new scorers |
| `lib/schema.ts` | Modify | Add type field to evalConfigs |
| `app/api/eval/run/route.ts` | Modify | Handle all scorer types |
| `components/experiments/experiment-card.tsx` | Modify | Add promote winner button |

---

### Task 1: Add missing scorers and new scorer types to eval-runner

Add 3 LLM-as-judge prompts (factuality, hallucination, toxicity), plus structured_output (deterministic), code scorer, and composite scorer functions.

**Files:**
- Modify: `lib/eval-runner.ts`
- Create: `lib/eval-runner.test.ts`

The implementer should:
1. Add factuality, hallucination, toxicity prompts to DEFAULT_JUDGE_PROMPTS (same pattern as existing ones)
2. Add `runStructuredOutputEval(output: string): EvalResult` — tries JSON.parse, returns 100 if valid, 0 if not
3. Add `runCodeEval(code: string, input: string, output: string): EvalResult` — evaluates safe numeric expressions using variable substitution (outputLength, inputLength). Must validate the expression contains only safe characters (digits, operators, parens, variable names) before evaluating. Use restricted evaluation — no arbitrary code execution.
4. Add `runCompositeEval(config, autoScores): EvalResult` — weighted average of referenced scorers
5. Export all new functions
6. Create tests in `lib/eval-runner.test.ts` covering structured_output (valid/invalid JSON), code eval (length checks, unsafe input rejection), composite eval (weighted average, missing scorers)
7. Run tests, commit

### Task 2: Add scorer type to schema and update eval route

**Files:**
- Modify: `lib/schema.ts` — add `type: text("type").notNull().default("llm_judge")` to evalConfigs
- Modify: `app/api/eval/run/route.ts` — handle structured_output, code, and composite types. Run composites after other scorers.

### Task 3: Promote winner button on experiment cards

**Files:**
- Modify: `components/experiments/experiment-card.tsx` — add compositionId to destructured props, replace winner text with a Link button to `/compositions/${compositionId}`

### Task 4: Final verification — run all tests
