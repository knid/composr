import { db } from "@/lib/db"
import { auditLogs } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc } from "drizzle-orm"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function AuditLogPage() {
  const { orgId } = await auth()
  if (!orgId) redirect("/")

  const logs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.teamId, orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50)

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Audit Log</h1>
      {logs.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No audit entries yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Resource</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-card/50">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 font-medium">{log.action}</td>
                  <td className="px-3 py-2 text-muted-foreground">{log.resourceType}{log.resourceId ? `: ${log.resourceId.slice(0, 8)}...` : ""}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{JSON.stringify(log.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
