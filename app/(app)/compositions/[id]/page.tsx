import { db } from "@/lib/db"
import { compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { redirect, notFound } from "next/navigation"
import { FlowCanvas } from "@/components/editor/flow-canvas"

export const dynamic = "force-dynamic"

export default async function CompositionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { orgId } = await auth()
  if (!orgId) redirect("/")
  const { id } = await params

  const [comp] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, id), eq(compositions.teamId, orgId)))

  if (!comp) notFound()

  const graph = comp.graph as { nodes: any[]; edges: any[] }

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col -m-6">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{comp.name}</h1>
          <span className="rounded bg-success/10 px-2 py-0.5 font-mono text-[10px] text-success">
            v{comp.version}
          </span>
        </div>
      </div>
      <div className="flex-1">
        <FlowCanvas
          initialNodes={graph.nodes}
          initialEdges={graph.edges}
        />
      </div>
    </div>
  )
}
