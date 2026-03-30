import { db } from "@/lib/db"
import { apiKeys } from "@/lib/schema"
import { eq } from "drizzle-orm"
import crypto from "crypto"

export async function authenticateSDK(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const key = authHeader.slice(7)
  const hash = crypto.createHash("sha256").update(key).digest("hex")

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))

  return apiKey ?? null
}
