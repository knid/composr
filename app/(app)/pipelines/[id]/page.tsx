import { db } from "@/lib/db"
import { pipelines, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { redirect, notFound } from "next/navigation"
import { PipelineEditor } from "@/components/pipelines/pipeline-editor"

export const dynamic = "force-dynamic"

export default async function PipelineEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { orgId } = await auth()
  if (!orgId) redirect("/")
  const { id } = await params

  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.teamId, orgId)))

  if (!pipeline) notFound()

  const teamComps = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))

  const graph = pipeline.graph as { nodes: any[]; edges: any[] }

  return (
    <PipelineEditor
      id={pipeline.id}
      name={pipeline.name}
      initialNodes={graph.nodes}
      initialEdges={graph.edges}
      compositions={teamComps.map((c) => ({
        id: c.id,
        name: c.name,
        version: c.version,
        blockCount: ((c.graph as any)?.nodes ?? []).filter((n: any) => n.type === "block").length,
      }))}
    />
  )
}
