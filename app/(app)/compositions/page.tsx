import { db } from "@/lib/db"
import { compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, GitBranch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export default async function CompositionsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/sign-in")

  const comps = await db
    .select()
    .from(compositions)
    .where(eq(compositions.teamId, orgId))
    .orderBy(desc(compositions.updatedAt))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Compositions</h1>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Composition
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {comps.map((comp) => {
          const graph = comp.graph as { nodes: any[]; edges: any[] }
          const blockCount = graph.nodes.filter((n: any) => n.type === "block").length
          const ifCount = graph.nodes.filter((n: any) => n.type?.startsWith("if")).length
          return (
            <Link key={comp.id} href={`/compositions/${comp.id}`}
              className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{comp.name}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">v{comp.version}</Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {blockCount} blocks · {ifCount} IF nodes
              </p>
            </Link>
          )
        })}
        {comps.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No compositions yet. Create your first one.
          </p>
        )}
      </div>
    </div>
  )
}
