import { db } from "@/lib/db"
import { pipelines } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Workflow } from "lucide-react"
import { NewPipelineButton } from "@/components/pipelines/new-pipeline-button"

export const dynamic = "force-dynamic"

export default async function PipelinesPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/")

  const teamPipelines = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.teamId, orgId))
    .orderBy(desc(pipelines.updatedAt))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold tracking-tight">Pipelines</h1>
        </div>
        <NewPipelineButton />
      </div>

      {teamPipelines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Workflow className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <div className="text-sm font-medium text-muted-foreground">No pipelines yet</div>
          <div className="mt-1 text-[11px] text-muted-foreground/70">
            Create a pipeline to chain compositions together.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teamPipelines.map((pipeline) => {
            const graph = pipeline.graph as { nodes: any[]; edges: any[] }
            const nodeCount = graph.nodes?.length ?? 0
            const edgeCount = graph.edges?.length ?? 0
            return (
              <Link
                key={pipeline.id}
                href={`/pipelines/${pipeline.id}`}
                className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30"
              >
                <div className="flex items-center gap-2">
                  <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{pipeline.name}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {nodeCount} compositions · {edgeCount} connections
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
