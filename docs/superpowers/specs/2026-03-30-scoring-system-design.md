# Sub-project D: Scoring System — Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Depends on:** Sub-project C (track/score data pipeline)

---

## Overview

Complete the scoring system: add 4 missing scorers, support custom code and composite scorers, and add a promote-winner action on experiments.

## D1: Missing scorers
Add to `DEFAULT_JUDGE_PROMPTS` in `lib/eval-runner.ts`:
- **factuality** — LLM-as-judge, grounded in context
- **hallucination** — LLM-as-judge, detects fabrication
- **toxicity** — LLM-as-judge, safety check
- **structured_output** — Deterministic, validates JSON (no LLM call)

## D2: Custom code scorers
Add `type` field to `evalConfigs` schema (`"llm_judge" | "code" | "composite"`, default `"llm_judge"`). Code scorers store a JS expression in `judgePrompt` that is evaluated server-side in a sandboxed manner. Only team admins can create code scorers.

## D3: Composite scorers
Composite scorers reference other scorers by name with weights. Stored as JSON in `judgePrompt`. Computed from already-completed individual scorer results.

## D4: Promote winner
Add a "Promote Winner" button on experiment cards linking to the composition editor with guidance to set the winner to 100%.

## Files changed
| File | Change |
|------|--------|
| `lib/eval-runner.ts` | Add 4 scorers, code scorer runner, composite scorer runner |
| `lib/schema.ts` | Add `type` field to evalConfigs |
| `app/api/eval/run/route.ts` | Handle code and composite scorer types |
| `components/experiments/experiment-card.tsx` | Add promote winner button |
| `lib/eval-runner.test.ts` | New — tests for structured_output and code scorer |
