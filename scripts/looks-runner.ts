/**
 * The research runner for "New look from links".
 *
 *     npm run looks:runner            keep running: check for jobs every minute
 *     npm run looks:runner -- --once  research at most one job, then stop
 *     npm run looks:runner -- --try <instagram link> <buying link> [photo file]
 *                                     research one look and save the result to a
 *                                     file, without the site: to judge quality
 *
 * Runs on the editor's own computer because that is where Claude Code is
 * signed in to the editor's Claude subscription. For each job it:
 *   1. claims it from the site (POST /api/runner/looks/claim);
 *   2. downloads the real photo and writes the job and site context to a
 *      private temporary folder;
 *   3. runs `claude -p` there with web search, web fetch and file reading only
 *      (no shell, no file writing), following docs/look-research/prompt.md;
 *   4. checks the JSON it returns against the same rules the site uses, and
 *      asks Claude to fix it once if it does not pass;
 *   5. sends it to the site, which validates it again and saves a DRAFT.
 * Nothing it does can publish a look.
 *
 * Settings (optional):
 *   LOOKS_SITE_URL      default https://www.celebritypersona.com
 *   LOOKS_RUNNER_TOKEN  default: read from %USERPROFILE%\.celebritypersona-monitor\looks-runner-token
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { extractJson, researchProblems, researchSchema, type LookResearch } from "@/lib/look-research";
import type { LookJob } from "@/lib/look-jobs";
import { PIECE_CATEGORIES, PIECE_COLOUR_NAMES } from "@/lib/taxonomy";

const SITE = (process.env.LOOKS_SITE_URL ?? "https://www.celebritypersona.com").replace(/\/$/, "");
const TOKEN_FILE = join(homedir(), ".celebritypersona-monitor", "looks-runner-token");
const ONCE = process.argv.includes("--once");
const IDLE_MS = 60_000;
/** One look's research; past this the run is stopped and the job marked failed. */
const CLAUDE_TIMEOUT_MS = 25 * 60_000;
const PROMPT = join(process.cwd(), "docs", "look-research", "prompt.md");

type Context = { celebrities: string[]; occasions: string[]; takenSlugs: string[]; keywordsInUse: string[] };

function token(): string {
  const value = (process.env.LOOKS_RUNNER_TOKEN ?? (existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, "utf8") : "")).trim();
  if (!value) {
    console.error(`No runner token. Put it in ${TOKEN_FILE} (or LOOKS_RUNNER_TOKEN).`);
    process.exit(1);
  }
  return value;
}

const TOKEN = process.argv.includes("--try") ? "" : token();
const stamp = () => new Date().toLocaleTimeString("en-IN", { hour12: false });
const log = (message: string) => console.log(`${stamp()}  ${message}`);

async function site(path: string, body?: unknown) {
  const response = await fetch(`${SITE}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 404) throw new Error(`${path} answered 404: the token is wrong, or LOOKS_RUNNER_TOKEN is not set on the site.`);
  return response;
}

/** Runs `claude -p` in `cwd` with the prompt on stdin; returns its JSON envelope. */
function claude(cwd: string, prompt: string, resume?: string): Promise<{ result: string; session_id: string; is_error?: boolean; total_cost_usd?: number }> {
  const args = [
    "-p",
    "--output-format", "json",
    "--allowedTools", "WebSearch,WebFetch,Read",
    "--disallowedTools", "Bash,Write,Edit,NotebookEdit",
    "--max-turns", "80",
    ...(resume ? ["--resume", resume] : []),
  ];
  return new Promise((resolve, reject) => {
    // shell: npm installs claude as a .cmd/.ps1 shim on Windows. Every argument
    // above is a fixed word; the prompt travels on stdin, never the command line.
    const child = spawn("claude", args, { cwd, shell: true, windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Claude did not finish within ${CLAUDE_TIMEOUT_MS / 60000} minutes.`));
    }, CLAUDE_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const envelope = JSON.parse(out.slice(out.indexOf("{")));
        if (envelope.is_error) reject(new Error(`Claude stopped: ${String(envelope.result ?? "").slice(0, 300)}`));
        else resolve(envelope);
      } catch {
        reject(new Error(`Claude exited ${code}: ${(err || out).trim().split(/\r?\n/).slice(-3).join(" ").slice(0, 300)}`));
      }
    });
    child.stdin.end(prompt);
  });
}

/** Parses and checks a reply; returns the research or the problems. */
function check(reply: string): { research?: LookResearch; problems?: string[] } {
  let raw: unknown;
  try {
    raw = extractJson(reply);
  } catch (error) {
    return { problems: [error instanceof Error ? error.message : "No JSON in the reply."] };
  }
  const parsed = researchSchema.safeParse(raw);
  return parsed.success ? { research: parsed.data } : { problems: researchProblems(parsed.error) };
}

const fixPrompt = (problems: string[]) =>
  `Your JSON did not pass the site's checks:\n- ${problems.join("\n- ")}\n\n` +
  "Fix exactly these problems (look things up again if you need to; never invent facts — use null plus a check instead) " +
  "and reply with the complete corrected JSON object only.";

async function research(job: LookJob, context: Context, tryOut?: { photoFile?: string; outFile: string }) {
  const dir = mkdtempSync(join(tmpdir(), "cp-look-"));
  try {
    writeFileSync(join(dir, "job.json"), JSON.stringify({ instagramUrl: job.instagramUrl, buyUrls: job.buyUrls, note: job.note ?? null }, null, 2));
    writeFileSync(join(dir, "context.json"), JSON.stringify(context, null, 2));
    if (tryOut?.photoFile) {
      const ext = tryOut.photoFile.split(".").pop() ?? "jpg";
      writeFileSync(join(dir, `photo.${ext}`), readFileSync(tryOut.photoFile));
    } else if (job.photo) {
      const response = await fetch(job.photo.url);
      if (!response.ok) throw new Error(`Could not download the job's photo (${response.status}).`);
      const ext = job.photo.path.split(".").pop() ?? "webp";
      writeFileSync(join(dir, `photo.${ext}`), Buffer.from(await response.arrayBuffer()));
    }
    const prompt = readFileSync(PROMPT, "utf8")
      .replace("{{CATEGORIES}}", PIECE_CATEGORIES.join(", "))
      .replace("{{COLOURS}}", PIECE_COLOUR_NAMES.join(", "));

    log("  Claude is researching (this usually takes 3–10 minutes)…");
    const first = await claude(dir, prompt);
    let session = first.session_id;
    let result = check(first.result);
    if (result.problems) {
      log(`  The reply needs fixing (${result.problems.length} problem(s)); asking Claude once…`);
      const second = await claude(dir, fixPrompt(result.problems), session);
      session = second.session_id;
      result = check(second.result);
    }
    if (!result.research) throw new Error(`Research did not pass the checks: ${result.problems!.join("; ")}`);

    if (tryOut) {
      writeFileSync(tryOut.outFile, JSON.stringify(result.research, null, 2));
      log(`  ✓ Research passed the checks. Saved to ${tryOut.outFile}`);
      return;
    }

    let response = await site(`/api/runner/looks/${job.id}`, { research: result.research, by: ["claude"] });
    if (response.status === 422) {
      const { problems } = (await response.json()) as { problems: string[] };
      log(`  The site refused the draft (${problems.join("; ")}); asking Claude once…`);
      const fixed = check((await claude(dir, fixPrompt(problems), session)).result);
      if (!fixed.research) throw new Error(`The site refused the draft: ${problems.join("; ")}`);
      response = await site(`/api/runner/looks/${job.id}`, { research: fixed.research, by: ["claude"] });
    }
    if (response.status === 409) {
      log("  The job was cancelled while it was being researched; nothing saved.");
      return;
    }
    if (!response.ok) throw new Error(`The site answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const { outfitId } = (await response.json()) as { outfitId: number };
    log(`  ✓ Draft saved. Review it: ${SITE}/admin/preview/${outfitId}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function tryOne() {
  const [instagramUrl, buyUrl, photoFile] = process.argv.slice(process.argv.indexOf("--try") + 1);
  if (!instagramUrl || !buyUrl) throw new Error("Usage: npm run looks:runner -- --try <instagram link> <buying link> [photo file]");
  const outFile = join(process.cwd(), `look-try-${Date.now()}.json`);
  const job = { id: "try", instagramUrl, buyUrls: [buyUrl] } as LookJob;
  log(`Trying ${instagramUrl} (nothing is sent to the site)`);
  await research(job, { celebrities: [], occasions: [], takenSlugs: [], keywordsInUse: [] }, { photoFile, outFile });
}

async function main() {
  if (process.argv.includes("--try")) return tryOne();
  log(`Look research runner → ${SITE}${ONCE ? " (one job)" : " (Ctrl+C to stop)"}`);
  for (;;) {
    const response = await site("/api/runner/looks/claim");
    if (response.status === 204) {
      if (ONCE) return log("Nothing waiting.");
      await new Promise((resolve) => setTimeout(resolve, IDLE_MS));
      continue;
    }
    if (!response.ok) throw new Error(`Claim failed: ${response.status}`);
    const { job, context } = (await response.json()) as { job: LookJob; context: Context };
    log(`Researching ${job.instagramUrl} (job ${job.id})`);
    try {
      await research(job, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`  ✗ ${message}`);
      await site(`/api/runner/looks/${job.id}`, { failed: message }).catch(() => {});
    }
    if (ONCE) return;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
