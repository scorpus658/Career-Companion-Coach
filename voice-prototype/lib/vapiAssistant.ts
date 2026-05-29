import { buildInterviewPrompt } from "@/lib/interviewPrompt";

// Transient assistant config passed inline to vapi.start().
// The Anthropic provider key is configured in the Vapi dashboard (Provider Keys),
// not here — only the public key lives in the browser.
//
// NOTE: must be a model id Vapi's Anthropic integration accepts. Claude 4 Sonnet
// is explicitly supported by Vapi. If you later want lower latency, try a Haiku id
// — but confirm Vapi accepts it first (an unsupported id tears down the call).
const MODEL = "claude-sonnet-4-20250514";

// priorContext seeds the agent with what we already know about the candidate so it
// can pressure-test from turn one. Pass undefined for a cold call.
export function buildInterviewAssistant(priorContext?: string) {
  const hasContext = Boolean(priorContext?.trim());
  return {
    firstMessage: hasContext
      ? "Hey, good to talk again. I've got a picture of what you were after last time — I want to check what still holds and what's changed. To start, how are you feeling about the search right now?"
      : "Hey, thanks for hopping on. I'd love to understand what you're looking for in your next role. To start — what are you doing right now, and what's got you thinking about a move?",
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
    },
    model: {
      provider: "anthropic",
      model: MODEL,
      messages: [{ role: "system", content: buildInterviewPrompt(priorContext) }],
    },
    voice: {
      provider: "vapi",
      voiceId: "Elliot",
    },
  };
}
