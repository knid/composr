import { db } from "@/lib/db"
import { compositions, scores, assemblyLogs } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc, gte, and, isNotNull } from "drizzle-orm"
import { redirect } from "next/navigation"
import { NewCompositionButton } from "@/components/compositions/new-composition-button"
import { CompositionList } from "@/components/compositions/composition-list"

export const dynamic = "force-dynamic"

export default async function CompositionsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/")

  const comps = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))
    .orderBy(desc(compositions.updatedAt))

  const allScores = await db
    .select()
    .from(scores)
    .where(and(eq(scores.teamId, orgId), isNotNull(scores.overallScore)))

  const scoreByComp = new Map<string, number[]>()
  for (const s of allScores) {
    if (s.overallScore === null) continue
    const arr = scoreByComp.get(s.compositionId) ?? []
    arr.push(s.overallScore)
    scoreByComp.set(s.compositionId, arr)
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentAssemblies = await db
    .select()
    .from(assemblyLogs)
    .where(and(eq(assemblyLogs.teamId, orgId), gte(assemblyLogs.assembledAt, oneDayAgo)))

  const throughputByComp = new Map<string, number>()
  for (const a of recentAssemblies) {
    throughputByComp.set(a.compositionId, (throughputByComp.get(a.compositionId) ?? 0) + 1)
  }

  const compositionItems = comps.map((comp) => ({
    id: comp.id,
    name: comp.name,
    description: comp.description,
    folder: comp.folder,
    version: comp.version,
    graph: comp.graph as { nodes: any[]; edges: any[] },
    avgScore: (() => {
      const arr = scoreByComp.get(comp.id)
      return arr && arr.length > 0
        ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
        : null
    })(),
    throughput: throughputByComp.get(comp.id) ?? 0,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Compositions</h1>
        <NewCompositionButton />
      </div>
      <CompositionList compositions={compositionItems} />
    </div>
  )
}
