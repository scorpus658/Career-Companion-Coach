// Candidate Brief — the living record the whole product anchors on.
// In this prototype it is produced post-call by /api/extract from the transcript.

export type PreferenceSource = "stated" | "revealed" | "inferred";

export interface PreferenceDimension {
  dimension: string;
  statedValue: string | null;
  revealedValue: string | null;
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
            description: "What they explicitly said they want. Null if never stated.",
          },
          revealedValue: {
            type: ["string", "null"],
            description:
              "What their reactions/choices imply they actually want, if it differs from or sharpens the stated value. Null if no signal.",
          },
          confidence: {
            type: "number",
            description: "0..1 confidence in the revealedValue (or statedValue if no revealed).",
          },
          source: { type: "string", enum: ["stated", "revealed", "inferred"] },
          evidence: {
            type: ["string", "null"],
            description: "The moment in the conversation that supports this.",
          },
        },
        required: ["dimension", "statedValue", "revealedValue", "confidence", "source", "evidence"],
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
