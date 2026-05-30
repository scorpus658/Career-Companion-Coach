import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { synthesizeSeedBrief } from "@/lib/extractBrief";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { profileId } = (await req.json()) as { profileId?: string };
  if (!profileId) {
    return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in .env.local" },
      { status: 500 }
    );
  }

  const db = getDb();

  const profile = (
    await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).limit(1)
  )[0];
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const latestCv = (
    await db
      .select()
      .from(schema.cvs)
      .where(eq(schema.cvs.profileId, profileId))
      .orderBy(desc(schema.cvs.uploadedAt))
      .limit(1)
  )[0];

  try {
    const brief = await synthesizeSeedBrief({
      cvText: latestCv?.extractedText ?? null,
      mindcaseData: profile.mindcaseData ?? null,
    });

    await db.insert(schema.briefs).values({ profileId, brief, source: "seed" });

    return NextResponse.json({ brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Seed synthesis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
