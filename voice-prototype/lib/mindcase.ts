// Mindcase LinkedIn profile pull.
// API contract: https://docs.mindcase.co/agents/linkedin/profiles
//
// 1) POST  /api/v1/agents/linkedin/profiles/run     -> { job_id, status }
// 2) GET   /api/v1/jobs/{job_id}                    -> poll for status: "completed"
// 3) GET   /api/v1/jobs/{job_id}/results            -> { data: [...] }
//
// Errors are surfaced so callers can soft-fail (build a CV-only seed).

const DEFAULT_BASE_URL = "https://api.mindcase.co";
const RUN_PATH = "/api/v1/agents/linkedin/profiles/run";
const JOB_PATH = (id: string) => `/api/v1/jobs/${id}`;
const RESULTS_PATH = (id: string) => `/api/v1/jobs/${id}/results`;

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

export interface MindcaseProfile {
  // Loose record — handed to Claude as JSON context.
  [key: string]: unknown;
}

interface RunResponse {
  job_id?: string;
  status?: string;
  data?: MindcaseProfile[];
}

interface JobResponse {
  job_id?: string;
  status?: string;
  error?: string;
}

interface ResultsResponse {
  data?: MindcaseProfile[];
}

function authHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function readError(res: Response, prefix: string): Promise<never> {
  const body = await res.text().catch(() => "");
  throw new Error(`${prefix} ${res.status}: ${body.slice(0, 300)}`);
}

export async function fetchLinkedinProfile(
  linkedinUrl: string
): Promise<MindcaseProfile> {
  const apiKey = process.env.MINDCASE_API_KEY;
  if (!apiKey) {
    throw new Error("MINDCASE_API_KEY is not set");
  }
  const base = (process.env.MINDCASE_API_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const headers = authHeaders(apiKey);

  // 1) Kick off the run.
  const runRes = await fetch(`${base}${RUN_PATH}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ params: { queries: [linkedinUrl] } }),
  });
  if (!runRes.ok) await readError(runRes, "Mindcase run");

  const run = (await runRes.json()) as RunResponse;

  // Some runs may complete synchronously; if data is already there, return it.
  if (run.status === "completed" && run.data?.length) {
    return run.data[0];
  }
  if (!run.job_id) {
    throw new Error(
      `Mindcase run returned no job_id (status=${run.status ?? "unknown"})`
    );
  }
  const jobId = run.job_id;

  // 2) Poll the job until completed / failed / timeout.
  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error(`Mindcase job ${jobId} timed out after ${POLL_TIMEOUT_MS}ms`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await fetch(`${base}${JOB_PATH(jobId)}`, { headers });
    if (!statusRes.ok) await readError(statusRes, "Mindcase status");
    const job = (await statusRes.json()) as JobResponse;

    if (job.status === "failed") {
      throw new Error(`Mindcase job ${jobId} failed: ${job.error ?? "unknown"}`);
    }
    if (job.status === "completed") break;
    // Otherwise still queued/running — keep polling.
  }

  // 3) Fetch the results.
  const resultsRes = await fetch(`${base}${RESULTS_PATH(jobId)}`, { headers });
  if (!resultsRes.ok) await readError(resultsRes, "Mindcase results");
  const results = (await resultsRes.json()) as ResultsResponse;

  if (!results.data?.length) {
    throw new Error(`Mindcase job ${jobId} completed but returned no profile data`);
  }
  return results.data[0];
}
