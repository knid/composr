import { db } from "@/lib/db"
import { providerKeys } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { encrypt } from "@/lib/encryption"

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const keys = await db
    .select({
      id: providerKeys.id,
      provider: providerKeys.provider,
      keyPrefix: providerKeys.keyPrefix,
      createdAt: providerKeys.createdAt,
    })
    .from(providerKeys)
    .where(eq(providerKeys.teamId, orgId))

  return NextResponse.json(keys)
}

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { provider, apiKey } = await req.json()

  if (!provider || !apiKey) {
    return NextResponse.json({ error: "provider and apiKey are required" }, { status: 400 })
  }

  if (!["anthropic", "openai"].includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 })
  }

  const keyPrefix = apiKey.length > 8
    ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`
    : "***"

  const encryptedKey = encrypt(apiKey, ENCRYPTION_KEY)

  const [key] = await db.insert(providerKeys).values({
    teamId: orgId,
    provider,
    encryptedKey,
    keyPrefix,
  }).returning({
    id: providerKeys.id,
    provider: providerKeys.provider,
    keyPrefix: providerKeys.keyPrefix,
    createdAt: providerKeys.createdAt,
  })

  return NextResponse.json(key, { status: 201 })
}
