"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Vapi from "@vapi-ai/web";
import { buildInterviewAssistant } from "@/lib/vapiAssistant";
import { SAMPLE_TRANSCRIPT } from "@/lib/sampleTranscript";
import type { CandidateBrief } from "@/lib/brief";
import { BriefView } from "./BriefView";

type Line = { role: "assistant" | "user"; text: string };
type VapiMessage = {
  type?: string;
  role?: string;
  transcript?: string;
  transcriptType?: string;
};

export default function Home() {
  const vapiRef = useRef<Vapi | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ended">("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [brief, setBrief] = useState<CandidateBrief | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorContext, setPriorContext] = useState("");

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

  useEffect(() => {
    if (!publicKey) return;
    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;

    vapi.on("call-start", () => setStatus("live"));
    vapi.on("call-end", () => setStatus("ended"));
    vapi.on("error", (e: unknown) =>
      setError(e instanceof Error ? e.message : JSON.stringify(e))
    );
    vapi.on("message", (msg: VapiMessage) => {
      if (msg.type === "transcript" && msg.transcriptType === "final" && msg.transcript) {
        setLines((prev) => [
          ...prev,
          { role: msg.role === "user" ? "user" : "assistant", text: msg.transcript! },
        ]);
      }
    });

    return () => {
      vapi.stop();
    };
  }, [publicKey]);

  const startCall = () => {
    setError(null);
    setBrief(null);
    setLines([]);
    setStatus("connecting");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vapiRef.current?.start(buildInterviewAssistant(priorContext) as any);
  };

  const endCall = () => vapiRef.current?.stop();

  const transcriptText = (ls: Line[]) =>
    ls.map((l) => `${l.role === "assistant" ? "Assistant" : "User"}: ${l.text}`).join("\n");

  const extract = async (transcript: string) => {
    setExtracting(true);
    setError(null);
    setBrief(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setBrief(data.brief);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <main style={S.main}>
      <header style={S.header}>
        <h1 style={S.h1}>Career Companion — voice interview</h1>
        <p style={S.sub}>
          Talk through your next move. At the end, we extract a Candidate Brief that separates
          what you said from what you revealed.
        </p>
      </header>

      <div style={S.cols}>
        <section style={S.col}>
          <label style={S.label}>
            What we already know about this candidate (optional — paste a prior Brief or
            onboarding notes; the agent will pressure-test it from the first turn)
          </label>
          <textarea
            style={S.textarea}
            placeholder="e.g. Says wants early-stage Chief of Staff role for learning. But last call, leaned toward a stabler growth-stage role when forced to choose. Real driver seems to be proximity to decisions, not stage."
            value={priorContext}
            onChange={(e) => setPriorContext(e.target.value)}
            rows={4}
          />

          <div style={S.controls}>
            {!publicKey && (
              <div style={S.warn}>
                No <code>NEXT_PUBLIC_VAPI_PUBLIC_KEY</code> set — voice is disabled. Use the
                sample-transcript button below, or add the key (Phase 4) to enable the call.
              </div>
            )}
            {status !== "live" && status !== "connecting" ? (
              <button style={S.primary} onClick={startCall} disabled={!publicKey}>
                ● Start interview
              </button>
            ) : (
              <button style={S.danger} onClick={endCall}>
                ■ End interview
              </button>
            )}
            <span style={S.status}>status: {status}</span>
          </div>

          <button
            style={S.secondary}
            onClick={() => extract(SAMPLE_TRANSCRIPT)}
            disabled={extracting}
          >
            {extracting ? "Extracting…" : "Test extraction (sample transcript)"}
          </button>

          <h3 style={S.h3}>Transcript</h3>
          <div style={S.transcript}>
            {lines.length === 0 ? (
              <span style={S.muted}>No conversation yet.</span>
            ) : (
              lines.map((l, i) => (
                <p key={i} style={l.role === "user" ? S.userLine : S.asstLine}>
                  <b>{l.role === "user" ? "You" : "Companion"}:</b> {l.text}
                </p>
              ))
            )}
          </div>

          {status === "ended" && lines.length > 0 && (
            <button
              style={S.primary}
              onClick={() => extract(transcriptText(lines))}
              disabled={extracting}
            >
              {extracting ? "Extracting…" : "Extract Candidate Brief"}
            </button>
          )}
        </section>

        <section style={S.col}>
          <h3 style={S.h3}>Candidate Brief</h3>
          {error && <div style={S.error}>{error}</div>}
          {brief ? (
            <BriefView brief={brief} />
          ) : (
            <span style={S.muted}>The Brief appears here after extraction.</span>
          )}
        </section>
      </div>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  main: { maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: "system-ui, sans-serif" },
  header: { marginBottom: 24 },
  h1: { fontSize: 24, margin: 0 },
  sub: { color: "#555", marginTop: 8, maxWidth: 640 },
  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" },
  col: { minWidth: 0 },
  controls: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  primary: { background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer" },
  secondary: { background: "#fff", color: "#111", border: "1px solid #ccc", borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer", marginBottom: 16 },
  danger: { background: "#c0392b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer" },
  status: { color: "#888", fontSize: 13 },
  label: { display: "block", fontSize: 12, color: "#777", marginBottom: 6 },
  textarea: { width: "100%", boxSizing: "border-box", border: "1px solid #ccc", borderRadius: 8, padding: 10, fontSize: 13, fontFamily: "system-ui, sans-serif", marginBottom: 16, resize: "vertical" },
  transcript: { border: "1px solid #eee", borderRadius: 8, padding: 12, minHeight: 160, maxHeight: 360, overflowY: "auto", background: "#fafafa", marginBottom: 12 },
  asstLine: { margin: "6px 0", color: "#222" },
  userLine: { margin: "6px 0", color: "#0a7d3a" },
  h3: { fontSize: 15, marginTop: 8 },
  muted: { color: "#999", fontSize: 14 },
  warn: { background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8, padding: 10, fontSize: 13, width: "100%" },
  error: { background: "#fdecea", border: "1px solid #f5c6cb", borderRadius: 8, padding: 10, fontSize: 13, color: "#a00", marginBottom: 12 },
};
