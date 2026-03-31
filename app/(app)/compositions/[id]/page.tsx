import { db } from "@/lib/db"
import { compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { redirect, notFound } from "next/navigation"
import { CompositionEditor } from "@/components/compositions/composition-editor"

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
    <CompositionEditor
      id={comp.id}
      name={comp.name}
      version={comp.version}
      initialNodes={graph.nodes}
      initialEdges={graph.edges}
      contextSchema={comp.contextSchema as { name: string; type: "string" | "boolean" | "enum"; values?: string[] }[]}
      metadata={comp.metadata as Record<string, any>}
    />
  )
}
