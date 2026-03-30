import { db } from "@/lib/db"
import { apiKeys } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import crypto from "crypto"

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const keys = await db
    .select({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, environment: apiKeys.environment, createdAt: apiKeys.createdAt })
    .from(apiKeys)
    .where(eq(apiKeys.teamId, orgId))

  return NextResponse.json(keys)
}

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, environment } = await req.json()

  const rawKey = `pk_${environment === "prod" ? "live" : "test"}_${crypto.randomBytes(24).toString("base64url")}`
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
  const keyPrefix = rawKey.slice(0, 12) + "..."

  await db.insert(apiKeys).values({
    teamId: orgId,
    name,
    keyHash,
    keyPrefix,
    environment,
  })

  return NextResponse.json({ key: rawKey, prefix: keyPrefix }, { status: 201 })
}
