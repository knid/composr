import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

export async function POST(req: Request) {
  const { orgId, userId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { action, resourceType, resourceId, metadata } = await req.json()

  await logAudit({ teamId: orgId, userId, action, resourceType, resourceId, metadata })

  return NextResponse.json({ ok: true })
}
