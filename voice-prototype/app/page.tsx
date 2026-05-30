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
type Profile = { id: string; linkedinUrl: string };

const transcriptText = (ls: Line[]) =>
  ls.map((l) => `${l.role === "assistant" ? "Assistant" : "User"}: ${l.text}`).join("\n");

export default function Home() {
  const vapiRef = useRef<Vapi | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ended">("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [brief, setBrief] = useState<CandidateBrief | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasBrief, setHasBrief] = useState(false);
  const [hasCv, setHasCv] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const callIdRef = useRef<string | null>(null);
  const linesRef = useRef<Line[]>([]);
  const finalizeRef = useRef<(callId: string, transcript: string) => Promise<void>>(
    async () => {}
  );

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    if (!publicKey) return;
    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;

    vapi.on("call-start", () => setStatus("live"));
    vapi.on("call-end", () => {
      setStatus("ended");
      const callId = callIdRef.current;
      if (callId) {
        void finalizeRef.current(callId, transcriptText(linesRef.current));
      }
    });
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

  const resolveProfile = async () => {
    if (!linkedinUrl.trim()) return;
    setError(null);
    setResolving(true);
    try {
      const res = await fetch("/api/profile/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: linkedinUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Profile resolve failed");
      setProfile(data.profile);
      setHasBrief(Boolean(data.hasBrief));
      setHasCv(Boolean(data.hasCv));
      if (data.brief) setBrief(data.brief);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profile resolve failed");
    } finally {
      setResolving(false);
    }
  };

  const uploadCv = async (file: File) => {
    if (!profile) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("profileId", profile.id);
      form.append("cv", file);
      const res = await fetch("/api/cv/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setHasCv(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const buildSeed = async () => {
    if (!profile) return;
    setError(null);
    setSeeding(true);
    try {
      const res = await fetch("/api/seed-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seed failed");
      if (data.brief) setBrief(data.brief);
      setHasBrief(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const startCall = async () => {
    if (!profile) return;
    setError(null);
    setBrief(null);
    setLines([]);
    setStatus("connecting");
    try {
      const res = await fetch("/api/call/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Call start failed");
      callIdRef.current = data.callId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vapiRef.current?.start(buildInterviewAssistant(data.priorContext) as any);
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Call start failed");
    }
  };

  const endCall = () => vapiRef.current?.stop();

  const finalizeCall = async (callId: string, transcript: string) => {
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/call/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Call finalization failed");
      if (data.brief) setBrief(data.brief);
      setHasBrief(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Call finalization failed");
    } finally {
      setExtracting(false);
      callIdRef.current = null;
    }
  };

  useEffect(() => {
    finalizeRef.current = finalizeCall;
  });

  const extractSample = async () => {
    setExtracting(true);
    setError(null);
    setBrief(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: SAMPLE_TRANSCRIPT }),
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

  const canStart = Boolean(publicKey && profile && hasBrief);

  return (
    <main style={S.main}>
      <header style={S.header}>
        <h1 style={S.h1}>Career Companion — voice interview</h1>
        <p style={S.sub}>
          Talk through your next move. The agent walks in informed by your LinkedIn and CV,
          pressure-tests what we already think, and updates your Candidate Brief after every call.
        </p>
      </header>

      <div style={S.cols}>
        <section style={S.col}>
          <h3 style={S.h3}>1 · Your LinkedIn</h3>
          <div style={S.row}>
            <input
              style={S.input}
              type="url"
              placeholder="https://www.linkedin.com/in/your-handle"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              disabled={Boolean(profile) || resolving}
            />
            {!profile && (
              <button style={S.secondary} onClick={resolveProfile} disabled={resolving || !linkedinUrl.trim()}>
                {resolving ? "Loading…" : "Continue"}
              </button>
            )}
          </div>
          {profile && (
            <p style={S.muted}>
              {hasBrief
                ? "Profile loaded — Brief is on the right. Start the interview when you're set."
                : "Profile set — upload your CV next."}
            </p>
          )}

          {profile && (
            <>
              <h3 style={S.h3}>
                {hasBrief ? "2a · Replace CV (optional)" : "2 · Upload your CV (PDF or DOCX)"}
              </h3>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => e.target.files?.[0] && uploadCv(e.target.files[0])}
                disabled={uploading}
              />
              {uploading && <p style={S.muted}>Parsing CV…</p>}
              {hasCv && !uploading && <p style={S.muted}>CV on file.</p>}

              <h3 style={S.h3}>
                {hasBrief ? "2b · Rebuild Brief (optional)" : "3 · Build your initial Brief"}
              </h3>
              <button style={S.secondary} onClick={buildSeed} disabled={seeding}>
                {seeding
                  ? "Building…"
                  : hasBrief
                  ? "Rebuild Brief from profile + CV"
                  : "Build Brief from profile + CV"}
              </button>
            </>
          )}

          <h3 style={S.h3}>{profile && hasBrief ? "3" : "4"} · Talk to the companion</h3>
          <div style={S.controls}>
            {!publicKey && (
              <div style={S.warn}>
                No <code>NEXT_PUBLIC_VAPI_PUBLIC_KEY</code> set — voice is disabled. Use the
                sample-transcript button below.
              </div>
            )}
            {status !== "live" && status !== "connecting" ? (
              <button style={S.primary} onClick={startCall} disabled={!canStart}>
                ● Start interview
              </button>
            ) : (
              <button style={S.danger} onClick={endCall}>
                ■ End interview
              </button>
            )}
            <span style={S.status}>status: {status}</span>
          </div>

          <button style={S.secondary} onClick={extractSample} disabled={extracting}>
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
        </section>

        <section style={S.col}>
          <h3 style={S.h3}>Candidate Brief</h3>
          {error && <div style={S.error}>{error}</div>}
          {extracting && <p style={S.muted}>Updating brief from this call…</p>}
          {seeding && <p style={S.muted}>Synthesizing initial brief from your CV + LinkedIn…</p>}
          {brief ? (
            <BriefView brief={brief} />
          ) : profile ? (
            <span style={S.muted}>
              {hasCv
                ? "Click Build Brief to synthesize your initial Brief from CV + LinkedIn."
                : "Upload a CV, then click Build Brief."}
            </span>
          ) : (
            <span style={S.muted}>Enter your LinkedIn URL to get started.</span>
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
  row: { display: "flex", gap: 8, marginBottom: 8, alignItems: "center" },
  controls: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  primary: { background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer" },
  secondary: { background: "#fff", color: "#111", border: "1px solid #ccc", borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer", marginBottom: 16 },
  danger: { background: "#c0392b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer" },
  status: { color: "#888", fontSize: 13 },
  input: { flex: 1, border: "1px solid #ccc", borderRadius: 8, padding: 10, fontSize: 13, fontFamily: "system-ui, sans-serif" },
  transcript: { border: "1px solid #eee", borderRadius: 8, padding: 12, minHeight: 160, maxHeight: 360, overflowY: "auto", background: "#fafafa", marginBottom: 12 },
  asstLine: { margin: "6px 0", color: "#222" },
  userLine: { margin: "6px 0", color: "#0a7d3a" },
  h3: { fontSize: 15, marginTop: 16, marginBottom: 8 },
  muted: { color: "#999", fontSize: 14 },
  warn: { background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8, padding: 10, fontSize: 13, width: "100%" },
  error: { background: "#fdecea", border: "1px solid #f5c6cb", borderRadius: 8, padding: 10, fontSize: 13, color: "#a00", marginBottom: 12 },
};
