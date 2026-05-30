import Anthropic from "@anthropic-ai/sdk";
import { BRIEF_TOOL_SCHEMA, CandidateBrief, CORE_DIMENSIONS } from "@/lib/brief";

const MODEL = "claude-sonnet-4-6";

const EXTRACTION_GUIDANCE = `You are analyzing a transcript of a voice career interview between an AI companion and a job seeker.

Produce a Candidate Brief by calling the save_candidate_brief tool. Be rigorous about the distinction that matters most:
- statedValue = what the candidate explicitly claimed they want.
- revealedValue = what their reactions, hesitations, energy, and tradeoff choices imply they ACTUALLY want, when it differs from or sharpens what they stated.

Pay special attention to:
- Laddering moments (the "why behind the why") -> underlyingValues.
- Forced-tradeoff answers -> tradeoffs, and what priority order they reveal.
- Any gap between stated and revealed -> contradictions (these are the highest-value findings).

Only assert a revealedValue when the transcript supports it. Cite the supporting moment in evidence. Do not invent preferences the candidate never gave signal on.`;

const EVOLUTION_GUIDANCE = `You are also given the Brief that seeded this call (the candidate's working profile coming in). Treat it as hypothesis, not settled fact. Your job in this call is to evolve it:
- Confirm dimensions the conversation reinforced (raise confidence).
- Update dimensions the conversation shifted (rewrite statedValue/revealedValue with the new signal).
- Drop dimensions the conversation broke.
- Surface NEW contradictions the conversation introduced.
- Preserve evidence pointers from the prior brief unless this call explicitly contradicts them.
The output is the candidate's NEW working profile after this call.`;

const SEED_GUIDANCE = `You are building the INITIAL Candidate Brief for a job seeker, BEFORE they have spoken to the companion. Your inputs are their CV text and/or a structured LinkedIn profile pull. Produce hypotheses to be confirmed or broken on the upcoming call.

Rules:
- Every dimension you assert is source: "stated". revealedValue must be null — we have no conversational signal yet.
- Cap confidence at 0.5 for everything. These are document-derived hypotheses, not interview-tested facts.
- evidence should cite the CV line or LinkedIn field that supports the hypothesis (e.g. "CV: 'led growth team at Razorpay, 2021-2024'").
- tradeoffs and contradictions arrays should be empty — no call has happened yet.
- underlyingValues may be empty or speculative (mark them as hypotheses in the text).
- openQuestions is the most valuable field here: list dimensions the documents DON'T cover that the call should resolve. Use the standard dimensions as a checklist: ${CORE_DIMENSIONS.join(", ")}.`;

export async function extractBriefFromTranscript(
  transcript: string,
  briefIn?: CandidateBrief | null
): Promise<CandidateBrief> {
  const client = new Anthropic();

  const systemText = briefIn
    ? `${EXTRACTION_GUIDANCE}\n\n${EVOLUTION_GUIDANCE}`
    : EXTRACTION_GUIDANCE;

  const userParts: string[] = [];
  if (briefIn) {
    userParts.push(
      `Here is the Brief that seeded this call (the candidate's prior working profile):\n\n${JSON.stringify(
        briefIn,
        null,
        2
      )}`
    );
  }
  userParts.push(`Here is the interview transcript:\n\n${transcript}`);

  const msg = await client.messages.create({
    model: MODEL,
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
      { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userParts.join("\n\n") }],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a brief");
  }
  return toolUse.input as CandidateBrief;
}

export async function synthesizeSeedBrief(args: {
  cvText: string | null;
  mindcaseData: unknown | null;
}): Promise<CandidateBrief> {
  const { cvText, mindcaseData } = args;
  if (!cvText && !mindcaseData) {
    throw new Error("Need at least a CV or a LinkedIn profile to build a seed brief");
  }

  const client = new Anthropic();

  const parts: string[] = [];
  if (cvText) {
    parts.push(`CV TEXT:\n${cvText.slice(0, 24_000)}`);
  }
  if (mindcaseData) {
    parts.push(
      `LINKEDIN PROFILE (Mindcase JSON):\n${JSON.stringify(mindcaseData).slice(0, 24_000)}`
    );
  }

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    tools: [
      {
        name: "save_candidate_brief",
        description: "Save the initial Candidate Brief synthesized from CV and LinkedIn.",
        input_schema: BRIEF_TOOL_SCHEMA as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "save_candidate_brief" },
    system: [
      { type: "text", text: SEED_GUIDANCE, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: parts.join("\n\n---\n\n") }],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a seed brief");
  }
  return toolUse.input as CandidateBrief;
}
