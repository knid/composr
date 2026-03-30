import { db } from "@/lib/db"
import { teams } from "@/lib/schema"
import { eq } from "drizzle-orm"

/**
 * Ensures a team row exists for the given Clerk orgId.
 * Creates one if missing. The team id IS the Clerk orgId.
 */
export async function ensureTeam(orgId: string, orgName?: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, orgId))

  if (existing) return existing.id

  const [created] = await db.insert(teams).values({
    id: orgId,
    name: orgName ?? "My Team",
  }).returning()

  return created.id
}
