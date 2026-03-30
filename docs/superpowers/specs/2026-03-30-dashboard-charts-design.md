# Sub-project B: Dashboard & Charts — Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Depends on:** Sub-project C (assemblyLogs data pipeline)

---

## Overview

Wire real data into dashboard stats, add Recharts trend charts to analytics/scoring/experiments/dashboard, and add cost estimation to analytics.

---

## B1: Wire real dashboard stats

Replace hardcoded placeholders in `app/(app)/page.tsx` with real queries:
- **Assemblies/24h:** Count from `assemblyLogs` where `assembledAt >= 24h ago`
- **Avg Score:** Average `overallScore` from `scores` (non-null only)
- **Active Experiments:** Count of distinct `compositionId` values in `scores` with non-null `variantId`
- **Recent Changes:** Last 5 entries from `auditLogs`

## B2: Recharts trend charts

Create reusable chart components and add them to 4 pages:

| Page | Chart type | Data source |
|------|-----------|-------------|
| Dashboard | Area chart — assemblies over time (7 days) | `assemblyLogs` grouped by date |
| Analytics | Line chart — token usage over time (30 days) | `scores` summing `inputTokens + outputTokens` by date |
| Scoring | Line chart — score trends over time (30 days) | `scores` averaging `overallScore` by date |
| Experiments | Bar chart — mean score per variant | `scores` grouped by `variantId` |

## B3: Cost estimation

Add cost estimation to analytics page:
- Lookup table with per-token rates for common models
- Compute estimated cost from `scores` table
- Display as StatCard

---

## Files changed

| File | Change |
|------|--------|
| `components/charts/area-chart.tsx` | New — reusable area chart |
| `components/charts/line-chart.tsx` | New — reusable line chart |
| `components/charts/bar-chart.tsx` | New — reusable bar chart |
| `lib/model-costs.ts` | New — model cost lookup |
| `app/(app)/page.tsx` | Wire real stats, add assemblies chart, recent changes |
| `app/(app)/analytics/page.tsx` | Add token usage chart, cost estimation |
| `app/(app)/scoring/page.tsx` | Add score trends chart |
| `app/(app)/experiments/page.tsx` | Add variant score bar chart |
