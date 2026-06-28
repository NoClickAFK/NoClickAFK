import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BASE_VERSION = "4.2.5";
const BASE_COMMIT = "d3d86f22ce9d260b07efa8550594038537871e52";
const COMPARE_URL = `https://api.github.com/repos/NoClickAFK/NoClickAFK/compare/${BASE_COMMIT}...main`;
const CACHE_TTL_MS = 60_000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

let cached: Record<string, unknown> | null = null;
let cachedAt = 0;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return json(cached);

  try {
    const github = await fetch(COMPARE_URL, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "bogatka-version-resolver",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!github.ok) throw new Error(`GitHub compare returned ${github.status}`);

    const data = await github.json();
    const ahead = Number.isInteger(data?.ahead_by) && data.ahead_by >= 0 ? data.ahead_by : 0;
    const [major, minor, patch] = BASE_VERSION.split(".").map(Number);
    const version = `${major}.${minor}.${patch + ahead}`;
    const sourceCommit = data?.commits?.at?.(-1)?.sha || data?.head_commit?.sha || BASE_COMMIT;

    cached = {
      version,
      versionToken: version.replace(/\D/g, ""),
      sourceCommit,
      ahead,
      baseVersion: BASE_VERSION,
      baseCommit: BASE_COMMIT,
      resolvedAt: new Date().toISOString(),
    };
    cachedAt = now;
    return json(cached);
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : String(error),
      version: BASE_VERSION,
      versionToken: BASE_VERSION.replace(/\D/g, ""),
      sourceCommit: BASE_COMMIT,
      ahead: 0,
      fallback: true,
    });
  }
});
