import { db } from "@/lib/db"
import { usageRecords } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, desc, and, gte } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const records = await db
    .select()
    .from(usageRecords)
    .where(and(
      eq(usageRecords.teamId, orgId),
      gte(usageRecords.date, thirtyDaysAgo)
    ))
    .orderBy(desc(usageRecords.date))

  return NextResponse.json(records)
}
