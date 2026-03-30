# PromptKit Phase 4: Scale & Enterprise

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden PromptKit for production scale — audit logs, rate limiting, API usage tracking, SSE live config push, and SDK config caching.

**Architecture:** Audit logs capture every mutation. Rate limiting uses in-memory sliding window (upgradeable to Redis later). SSE endpoint enables real-time config push to SDKs. Usage tracking enables billing tiers.

**Tech Stack:** Same as Phase 1-3

**Repo:** `/home/knid/Projects/promptkit`

---

## Task 1: Audit Logs

Track every mutation (block create/update/delete, composition changes, promotions, API key creation) with who, what, when.

**Files:**
- Create: `lib/audit.ts`
- Modify: `lib/schema.ts` — add auditLogs table
- Modify: API routes — add audit logging calls
- Create: `app/(app)/settings/audit/page.tsx`

## Task 2: Rate Limiting Middleware

Protect SDK endpoints from abuse with sliding window rate limiting.

**Files:**
- Create: `lib/rate-limit.ts`
- Modify: `app/api/sdk/config/[env]/route.ts`
- Modify: `app/api/sdk/track/route.ts`
- Modify: `app/api/sdk/score/route.ts`

## Task 3: API Usage Tracking

Track API calls per team for billing/usage dashboards.

**Files:**
- Modify: `lib/schema.ts` — add usageRecords table
- Create: `lib/usage.ts`
- Create: `app/api/usage/route.ts`
- Modify: `app/(app)/settings/page.tsx` — add usage section

## Task 4: SSE Live Config Stream

Real-time config push to SDKs when compositions or blocks change.

**Files:**
- Create: `app/api/sdk/stream/[env]/route.ts`
- Create: `lib/config-events.ts`

## Task 5: SDK Config Caching

Cache assembled SDK configs to avoid DB queries on every request.

**Files:**
- Create: `lib/config-cache.ts`
- Modify: `app/api/sdk/config/[env]/route.ts`
