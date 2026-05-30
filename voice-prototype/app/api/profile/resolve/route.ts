import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { fetchLinkedinProfile } from "@/lib/mindcase";

export const runtime = "nodejs";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeLinkedinUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (!/linkedin\.com$/i.test(u.hostname) && !u.hostname.endsWith(".linkedin.com")) {
      return null;
    }
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { linkedinUrl } = (await req.json()) as { linkedinUrl?: string };
  if (!linkedinUrl || typeof linkedinUrl !== "string") {
    return NextResponse.json({ error: "Missing 'linkedinUrl'" }, { status: 400 });
  }

  const normalized = normalizeLinkedinUrl(linkedinUrl);
  if (!normalized) {
    return NextResponse.json({ error: "Not a valid LinkedIn URL" }, { status: 400 });
  }

  const db = getDb();

  const existing = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.linkedinUrl, normalized))
    .limit(1);

  let profile = existing[0];

  const stale =
    !profile?.mindcasePulledAt ||
    Date.now() - new Date(profile.mindcasePulledAt).getTime() > STALE_AFTER_MS;

  if (!profile) {
    const inserted = await db
      .insert(schema.profiles)
      .values({ linkedinUrl: normalized })
      .returning();
    profile = inserted[0];
  }

  if (stale && process.env.MINDCASE_API_KEY) {
    try {
      const mindcaseData = await fetchLinkedinProfile(normalized);
      const updated = await db
        .update(schema.profiles)
        .set({ mindcaseData, mindcasePulledAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.profiles.id, profile.id))
        .returning();
      profile = updated[0];
    } catch (err) {
      // Soft-fail: profile still exists, just without Mindcase data.
      console.warn("Mindcase pull failed:", err);
    }
  }

  // Pull the latest brief so returning users see it immediately in the UI,
  // and surface whether a CV is on file (for the "Replace CV" affordance).
  const latestBriefRow = (
    await db
      .select()
      .from(schema.briefs)
      .where(eq(schema.briefs.profileId, profile.id))
      .orderBy(desc(schema.briefs.createdAt))
      .limit(1)
  )[0];

  const latestCv = await db
    .select({ id: schema.cvs.id })
    .from(schema.cvs)
    .where(eq(schema.cvs.profileId, profile.id))
    .limit(1);

  return NextResponse.json({
    profile,
    hasBrief: Boolean(latestBriefRow),
    hasCv: latestCv.length > 0,
    brief: latestBriefRow?.brief ?? null,
  });
}
