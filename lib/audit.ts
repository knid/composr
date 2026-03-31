import { db } from "@/lib/db"
import { auditLogs } from "@/lib/schema"
import { fireWebhooks } from "@/lib/webhooks"

interface AuditEntry {
  teamId: string
  userId?: string | null
  action: string
  resourceType: string
  resourceId?: string
  metadata?: Record<string, any>
}

export async function logAudit(entry: AuditEntry) {
  try {
    await db.insert(auditLogs).values({
      teamId: entry.teamId,
      userId: entry.userId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ?? {},
    })

    // Fire matching webhooks (async, non-blocking)
    void fireWebhooks(entry.teamId, entry.action, {
      type: entry.resourceType,
      id: entry.resourceId,
      metadata: entry.metadata,
    })
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("Audit log failed:", error)
  }
}
