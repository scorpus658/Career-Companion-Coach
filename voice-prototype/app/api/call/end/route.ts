import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { extractBriefFromTranscript } from "@/lib/extractBrief";
import type { CandidateBrief } from "@/lib/brief";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { callId, transcript } = (await req.json()) as {
    callId?: string;
    transcript?: string;
  };
  if (!callId || typeof transcript !== "string") {
    return NextResponse.json(
      { error: "Missing 'callId' or 'transcript'" },
      { status: 400 }
    );
  }

  const db = getDb();

  const call = (
    await db.select().from(schema.calls).where(eq(schema.calls.id, callId)).limit(1)
  )[0];
  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  // Always persist the transcript + ended_at, even if extraction fails or the
  // transcript is empty — the conversation happened, the record matters.
  await db
    .update(schema.calls)
    .set({ transcript, endedAt: new Date() })
    .where(eq(schema.calls.id, callId));

  if (!transcript.trim()) {
    return NextResponse.json({ brief: null, note: "Empty transcript — no brief extracted" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in .env.local" },
      { status: 500 }
    );
  }

  let briefIn: CandidateBrief | null = null;
  if (call.briefInId) {
    const row = (
      await db
        .select()
        .from(schema.briefs)
        .where(eq(schema.briefs.id, call.briefInId))
        .limit(1)
    )[0];
    briefIn = (row?.brief as CandidateBrief) ?? null;
  }

  try {
    const briefOut = await extractBriefFromTranscript(transcript, briefIn);

    const inserted = await db
      .insert(schema.briefs)
      .values({ profileId: call.profileId, brief: briefOut, source: "call_out", callId })
      .returning();

    await db
      .update(schema.calls)
      .set({ briefOutId: inserted[0].id })
      .where(eq(schema.calls.id, callId));

    return NextResponse.json({ brief: briefOut });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
