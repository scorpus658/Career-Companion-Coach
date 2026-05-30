import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { formatBriefForPrompt } from "@/lib/seedFormat";
import type { CandidateBrief } from "@/lib/brief";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { profileId } = (await req.json()) as { profileId?: string };
  if (!profileId) {
    return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
  }

  const db = getDb();

  const latestBrief = (
    await db
      .select()
      .from(schema.briefs)
      .where(eq(schema.briefs.profileId, profileId))
      .orderBy(desc(schema.briefs.createdAt))
      .limit(1)
  )[0];

  const briefInId = latestBrief?.id ?? null;
  const priorContext = latestBrief
    ? formatBriefForPrompt(latestBrief.brief as CandidateBrief)
    : "";

  const inserted = await db
    .insert(schema.calls)
    .values({ profileId, briefInId })
    .returning();

  return NextResponse.json({ callId: inserted[0].id, priorContext });
}
