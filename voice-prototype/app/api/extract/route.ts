import { NextRequest, NextResponse } from "next/server";
import { extractBriefFromTranscript } from "@/lib/extractBrief";
import type { CandidateBrief } from "@/lib/brief";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in .env.local" },
      { status: 500 }
    );
  }

  const body = (await req.json()) as {
    transcript?: unknown;
    briefIn?: CandidateBrief | null;
  };
  const { transcript, briefIn } = body;
  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "Missing 'transcript' string" }, { status: 400 });
  }

  try {
    const brief = await extractBriefFromTranscript(transcript, briefIn ?? null);
    return NextResponse.json({ brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
