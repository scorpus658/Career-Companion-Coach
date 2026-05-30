import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { BRIEF_TOOL_SCHEMA, CandidateBrief } from "@/lib/brief";

const EXTRACTION_GUIDANCE = `You are analyzing a transcript of a voice career interview between an AI companion and a job seeker.

Produce a Candidate Brief by calling the save_candidate_brief tool. Be rigorous about the distinction that matters most:
- statedValue = what the candidate explicitly claimed they want.
- revealedValue = what their reactions, hesitations, energy, and tradeoff choices imply they ACTUALLY want, when it differs from or sharpens what they stated.

Pay special attention to:
- Laddering moments (the "why behind the why") -> underlyingValues.
- Forced-tradeoff answers -> tradeoffs, and what priority order they reveal.
- Any gap between stated and revealed -> contradictions (these are the highest-value findings).

Only assert a revealedValue when the transcript supports it. Cite the supporting moment in evidence. Do not invent preferences the candidate never gave signal on.`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in .env.local" },
      { status: 500 }
    );
  }

  const { transcript } = await req.json();
  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "Missing 'transcript' string" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      tools: [
        {
          name: "save_candidate_brief",
          description: "Save the structured Candidate Brief extracted from the interview.",
          input_schema: BRIEF_TOOL_SCHEMA as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "save_candidate_brief" },
      system: [
        {
          type: "text",
          text: EXTRACTION_GUIDANCE,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Here is the interview transcript:\n\n${transcript}`,
        },
      ],
    });

    const toolUse = msg.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Model did not return a brief" }, { status: 502 });
    }

    return NextResponse.json({ brief: toolUse.input as CandidateBrief });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
