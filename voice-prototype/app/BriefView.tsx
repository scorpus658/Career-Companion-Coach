"use client";

import { type CSSProperties } from "react";
import type { CandidateBrief } from "@/lib/brief";

export function BriefView({ brief }: { brief: CandidateBrief }) {
  return (
    <div style={s.wrap}>
      <p style={s.summary}>{brief.summary}</p>

      {brief.contradictions.length > 0 && (
        <Section title="⚡ Stated vs revealed — pressure-test these">
          <ul style={s.ul}>
            {brief.contradictions.map((c, i) => (
              <li key={i} style={s.contradiction}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Preferences">
        <div style={s.dimGrid}>
          {brief.dimensions.map((d, i) => (
            <div key={i} style={s.dimCard}>
              <div style={s.dimName}>{d.dimension}</div>
              <div style={s.row}>
                <span style={s.tagStated}>stated</span>
                <span>{d.statedValue ?? "—"}</span>
              </div>
              <div style={s.row}>
                <span style={s.tagRevealed}>revealed</span>
                <span>{d.revealedValue ?? "—"}</span>
              </div>
              <div style={s.meta}>
                conf {Math.round(d.confidence * 100)}% · {d.source}
                {d.evidence ? ` · ${d.evidence}` : ""}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {brief.underlyingValues.length > 0 && (
        <Section title="Underlying values (the why)">
          <ul style={s.ul}>
            {brief.underlyingValues.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </Section>
      )}

      {brief.tradeoffs.length > 0 && (
        <Section title="Tradeoffs revealed">
          {brief.tradeoffs.map((t, i) => (
            <div key={i} style={s.tradeoff}>
              <div><b>Q:</b> {t.question}</div>
              <div><b>Chose:</b> {t.choice}</div>
              <div style={s.reveals}><b>Reveals:</b> {t.reveals}</div>
            </div>
          ))}
        </Section>
      )}

      {brief.openQuestions.length > 0 && (
        <Section title="Open questions for follow-up">
          <ul style={s.ul}>
            {brief.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.section}>
      <h4 style={s.sectionTitle}>{title}</h4>
      {children}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { border: "1px solid #eee", borderRadius: 10, padding: 16, background: "#fff" },
  summary: { fontSize: 15, lineHeight: 1.5, margin: "0 0 8px", color: "#222" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "#777", margin: "0 0 8px" },
  ul: { margin: 0, paddingLeft: 18, lineHeight: 1.6 },
  contradiction: { color: "#b8430f", fontWeight: 500 },
  dimGrid: { display: "grid", gap: 8 },
  dimCard: { border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" },
  dimName: { fontWeight: 600, textTransform: "capitalize", marginBottom: 4 },
  row: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 14, margin: "2px 0" },
  tagStated: { fontSize: 11, background: "#eef", color: "#446", borderRadius: 4, padding: "1px 6px", minWidth: 56, textAlign: "center" },
  tagRevealed: { fontSize: 11, background: "#efe", color: "#264", borderRadius: 4, padding: "1px 6px", minWidth: 56, textAlign: "center" },
  meta: { fontSize: 12, color: "#999", marginTop: 4 },
  tradeoff: { border: "1px solid #eee", borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 14, lineHeight: 1.5 },
  reveals: { color: "#264e8a", marginTop: 2 },
};
