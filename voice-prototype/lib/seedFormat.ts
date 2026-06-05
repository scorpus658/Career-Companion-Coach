import type { CandidateBrief } from "@/lib/brief";

// Render a CandidateBrief into the markdown block that buildInterviewPrompt
// expects under "What we already know about this candidate".
export function formatBriefForPrompt(brief: CandidateBrief): string {
  const lines: string[] = [];

  if (brief.summary?.trim()) {
    lines.push(`Summary: ${brief.summary.trim()}`);
    lines.push("");
  }

  if (brief.dimensions?.length) {
    lines.push("Preferences (stated → revealed → hard floor):");
    for (const d of brief.dimensions) {
      const stated = d.statedValue ?? "—";
      const revealed = d.revealedValue ?? "—";
      const floor = d.operativeConstraint ?? null;
      const conf = (d.confidence * 100).toFixed(0);
      lines.push(
        `- ${d.dimension} — stated: ${stated} | revealed: ${revealed} | confidence: ${conf}% (${d.source})`
      );
      if (floor) lines.push(`  ⚠ hard floor: ${floor}`);
      if (d.evidence) lines.push(`  evidence: ${d.evidence}`);
    }
    lines.push("");
  }

  if (brief.underlyingValues?.length) {
    lines.push("Underlying values (the 'why' behind stated prefs):");
    for (const v of brief.underlyingValues) lines.push(`- ${v}`);
    lines.push("");
  }

  if (brief.tradeoffs?.length) {
    lines.push("Tradeoffs revealed in past calls:");
    for (const t of brief.tradeoffs) {
      lines.push(`- Q: ${t.question}`);
      lines.push(`  picked: ${t.choice} → reveals: ${t.reveals}`);
    }
    lines.push("");
  }

  if (brief.contradictions?.length) {
    lines.push("Open contradictions (stated vs revealed gaps to pressure-test):");
    for (const c of brief.contradictions) lines.push(`- ${c}`);
    lines.push("");
  }

  if (brief.openQuestions?.length) {
    lines.push("Open questions to resolve this call:");
    for (const q of brief.openQuestions) lines.push(`- ${q}`);
  }

  return lines.join("\n").trim();
}
