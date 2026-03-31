import { db } from "@/lib/db"
import { evalConfigs, compositions } from "@/lib/schema"
import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const compositionId = searchParams.get("compositionId")

  if (compositionId) {
    // Verify the composition belongs to this org
    const [comp] = await db
      .select()
      .from(compositions)
      .where(and(eq(compositions.id, compositionId), eq(compositions.teamId, orgId)))

    if (!comp) {
      return NextResponse.json({ error: "Composition not found" }, { status: 404 })
    }

    const configs = await db
      .select()
      .from(evalConfigs)
      .where(eq(evalConfigs.compositionId, compositionId))

    return NextResponse.json(configs)
  }

  // Return all eval configs for compositions belonging to this org
  const configs = await db
    .select({
      id: evalConfigs.id,
      compositionId: evalConfigs.compositionId,
      scorerName: evalConfigs.scorerName,
      type: evalConfigs.type,
      enabled: evalConfigs.enabled,
      sampleRate: evalConfigs.sampleRate,
      judgeModel: evalConfigs.judgeModel,
      judgePrompt: evalConfigs.judgePrompt,
      weight: evalConfigs.weight,
      createdAt: evalConfigs.createdAt,
      updatedAt: evalConfigs.updatedAt,
    })
    .from(evalConfigs)
    .innerJoin(compositions, eq(evalConfigs.compositionId, compositions.id))
    .where(eq(compositions.teamId, orgId))

  return NextResponse.json(configs)
}

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { compositionId, scorerName, type, sampleRate, judgeModel, judgePrompt, weight } = body

  if (!compositionId || !scorerName) {
    return NextResponse.json(
      { error: "compositionId and scorerName are required" },
      { status: 400 }
    )
  }

  // Verify the composition belongs to this org
  const [comp] = await db
    .select()
    .from(compositions)
    .where(and(eq(compositions.id, compositionId), eq(compositions.teamId, orgId)))

  if (!comp) {
    return NextResponse.json({ error: "Composition not found" }, { status: 404 })
  }

  const [config] = await db
    .insert(evalConfigs)
    .values({
      compositionId,
      scorerName,
      ...(type !== undefined ? { type } : {}),
      ...(sampleRate !== undefined ? { sampleRate } : {}),
      ...(judgeModel !== undefined ? { judgeModel } : {}),
      ...(judgePrompt !== undefined ? { judgePrompt } : {}),
      ...(weight !== undefined ? { weight } : {}),
    })
    .returning()

  return NextResponse.json(config, { status: 201 })
}
