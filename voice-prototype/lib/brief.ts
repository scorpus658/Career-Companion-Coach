// Candidate Brief — the living record the whole product anchors on.
// In this prototype it is produced post-call by /api/extract from the transcript.
//
// Three-layer preference model:
//   statedValue        — what they explicitly claimed they want (the headline)
//   revealedValue      — what energy/corrections/choices imply they actually want
//   operativeConstraint — the hard floor / deal-breaker: what makes a placement
//                         fall through. Usually surfaces as a subordinate clause
//                         ("because...", "unless...", "as long as...") rather than
//                         a direct answer. Null if no hard constraint detected.

export type PreferenceSource = "stated" | "revealed" | "inferred";

export interface PreferenceDimension {
  dimension: string;
  statedValue: string | null;
  revealedValue: string | null;
  operativeConstraint: string | null; // the non-negotiable hard floor
  confidence: number; // 0..1
  source: PreferenceSource;
  evidence: string | null; // the moment in the call that supports this
}

export interface Tradeoff {
  question: string; // the tradeoff posed
  choice: string; // what they picked
  reveals: string; // the underlying priority it exposes
}

export interface CandidateBrief {
  summary: string; // 2-3 sentence read of who this person is and what they're really after
  dimensions: PreferenceDimension[];
  underlyingValues: string[]; // from laddering — the "why" behind stated prefs
  tradeoffs: Tradeoff[];
  contradictions: string[]; // stated vs revealed divergences worth pressure-testing
  openQuestions: string[]; // what a follow-up call should resolve
}

// The seven dimensions from E1 (Clarify Intent) onboarding fields.
export const CORE_DIMENSIONS = [
  "location",
  "work_mode",
  "compensation",
  "company_stage",
  "domain",
  "role",
  "experience_level",
] as const;

// JSON schema for Claude tool-based structured extraction.
export const BRIEF_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    summary: {
      type: "string",
      description:
        "2-3 sentence read of who this candidate is and what they are really after.",
    },
    dimensions: {
      type: "array",
      description: `One entry per preference dimension you have evidence for. Cover these where possible: ${CORE_DIMENSIONS.join(", ")}.`,
      items: {
        type: "object",
        properties: {
          dimension: { type: "string" },
          statedValue: {
            type: ["string", "null"],
            description: "What they explicitly said they want (the headline answer). Null if never stated.",
          },
          revealedValue: {
            type: ["string", "null"],
            description:
              "What their reactions, hesitations, self-corrections, energy, and tradeoff choices imply they ACTUALLY want — especially when it differs from the stated value. Watch for: the second number after an anchor ('but I'd go as low as...'), self-corrections mid-sentence, the word 'actually' or 'honestly', topics they lit up vs. went flat on. Null if no signal.",
          },
          operativeConstraint: {
            type: ["string", "null"],
            description:
              "The hard floor / deal-breaker for this dimension — what would make them walk away from an otherwise good offer. This is NOT the stated preference; it is the non-negotiable minimum. It almost always surfaces as a subordinate clause rather than a direct answer: 'because...', 'unless...', 'as long as...', 'I know I'm eventually going to...', 'the reason I need...' — parse those qualifiers, not just the headline. Examples: comp floor they'd accept if role is right; visa requirement; a specific work-hours ceiling. Null if no hard constraint detected.",
          },
          confidence: {
            type: "number",
            description: "0..1 confidence in the revealedValue (or statedValue if no revealed).",
          },
          source: { type: "string", enum: ["stated", "revealed", "inferred"] },
          evidence: {
            type: ["string", "null"],
            description: "The specific moment in the conversation — preferably a direct quote or close paraphrase — that supports this. Prioritise subordinate clauses and self-corrections over direct answers, as they carry the most signal.",
          },
        },
        required: ["dimension", "statedValue", "revealedValue", "operativeConstraint", "confidence", "source", "evidence"],
      },
    },
    underlyingValues: {
      type: "array",
      description: "The deeper 'why' behind their stated preferences, surfaced via laddering.",
      items: { type: "string" },
    },
    tradeoffs: {
      type: "array",
      description: "Forced-tradeoff moments and what they revealed about priority order.",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          choice: { type: "string" },
          reveals: { type: "string" },
        },
        required: ["question", "choice", "reveals"],
      },
    },
    contradictions: {
      type: "array",
      description:
        "Divergences between what they stated and what they revealed — the things worth pressure-testing on a follow-up.",
      items: { type: "string" },
    },
    openQuestions: {
      type: "array",
      description: "What a follow-up conversation should resolve.",
      items: { type: "string" },
    },
  },
  required: [
    "summary",
    "dimensions",
    "underlyingValues",
    "tradeoffs",
    "contradictions",
    "openQuestions",
  ],
};
