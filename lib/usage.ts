import { db } from "@/lib/db"
import { usageRecords } from "@/lib/schema"
import { eq, and, sql } from "drizzle-orm"

export async function trackUsage(teamId: string, endpoint: string) {
  const date = new Date().toISOString().split("T")[0]

  try {
    // Try to increment existing record
    const result = await db
      .update(usageRecords)
      .set({
        count: sql`${usageRecords.count} + 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(usageRecords.teamId, teamId),
        eq(usageRecords.endpoint, endpoint),
        eq(usageRecords.date, date)
      ))
      .returning()

    if (result.length === 0) {
      // Create new record for today
      await db.insert(usageRecords).values({
        teamId,
        endpoint,
        count: 1,
        date,
      })
    }
  } catch (error) {
    console.error("Usage tracking failed:", error)
  }
}
