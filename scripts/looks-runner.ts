/**
 * The research runner for "New look from links".
 *
 *     npm run looks:runner            keep running: check for jobs every minute
 *     npm run looks:runner -- --once  research at most one job, then stop
 *     npm run looks:runner -- --try <instagram link> <buying link> [photo file]
 *                                     research one look and save the result to a
 *                                     file, without the site: to judge quality
 *     npm run looks:runner -- --scout  run the morning trend scout now
 *                                     (otherwise it runs once a day after 08:00 IST
 *                                     while the runner is open)
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
import { istToday } from "@/lib/dates";
import { cleanCandidates } from "@/lib/look-suggestions";
import { readProducts } from "./shop-reader";

const SITE = (process.env.LOOKS_SITE_URL ?? "https://www.celebritypersona.com").replace(/\/$/, "");
const TOKEN_FILE = join(homedir(), ".celebritypersona-monitor", "looks-runner-token");
const ONCE = process.argv.includes("--once");
const IDLE_MS = 60_000;
/** One look's research; past this the run is stopped and the job marked failed. */
const CLAUDE_TIMEOUT_MS = 25 * 60_000;
const PROMPT = join(process.cwd(), "docs", "look-research", "prompt.md");
const REPO = process.cwd().split("\\").join("/");

/**
 * Claude Code's own program. npm installs it as claude.exe behind a .cmd shim;
 * starting the program itself avoids a shell, so no argument is ever re-parsed.
 */
const CLAUDE = (() => {
  const exe = join(process.env.APPDATA ?? "", "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
  return process.platform === "win32" && existsSync(exe) ? exe : "claude";
})();

/**
 * The one command Claude may run: `./shop <product link>`, which reads a product
 * page with this computer's Chrome (scripts/shop-reader.ts) and prints what it
 * says. Claude Code runs commands in Git Bash, hence a POSIX script.
 */
const SHOP_SCRIPT = `#!/bin/sh
exec node "${REPO}/node_modules/tsx/dist/cli.mjs" "${REPO}/scripts/shop-reader.ts" product "$1"
`;

type Context = { celebrities: string[]; occasions: string[]; takenSlugs: string[]; keywordsInUse: string[] };

function token(): string {
  const value = (process.env.LOOKS_RUNNER_TOKEN ?? (existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, "utf8") : "")).trim();
  if (!value) {
    console.error(`No runner token. Put it in ${TOKEN_FILE} (or LOOKS_RUNNER_TOKEN).`);
    process.exit(1);
  }
  return value;
}

const TOKEN = ["--try", "--check", "--scout-try"].some((flag) => process.argv.includes(flag)) ? "" : token();
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
    // Only the shop reader may be run; no other command, no file writing.
    "--allowedTools", "WebSearch,WebFetch,Read,Bash(./shop:*)",
    "--disallowedTools", "Write,Edit,NotebookEdit",
    "--max-turns", "80",
    ...(resume ? ["--resume", resume] : []),
  ];
  return new Promise((resolve, reject) => {
    // No shell: the arguments reach Claude exactly as written above, and the
    // prompt travels on stdin, never the command line.
    const child = spawn(CLAUDE, args, { cwd, windowsHide: true });
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
    writeFileSync(
      join(dir, "job.json"),
      JSON.stringify(
        {
          celebrity: job.celebrity ?? null,
          celebrityInstagram: job.celebrityInstagram ?? null,
          labelUrl: job.labelUrl ?? null,
          instagramUrl: job.instagramUrl,
          buyUrls: job.buyUrls,
          alternateUrls: job.alternateUrls ?? [],
          note: job.note ?? null,
        },
        null,
        2,
      ),
    );
    writeFileSync(join(dir, "context.json"), JSON.stringify(context, null, 2));
    writeFileSync(join(dir, "shop"), SHOP_SCRIPT, { mode: 0o755 });
    const alternates = job.alternateUrls ?? [];
    log(`  Reading ${job.buyUrls.length} buying link(s)${alternates.length ? ` and ${alternates.length} alternate(s)` : ""} with Chrome…`);
    // Every product page in one Chrome session; each entry says which kind of link it was.
    const read = await readProducts([...job.buyUrls, ...alternates]);
    const products = read.map((product, index) => ({ ...product, role: index < job.buyUrls.length ? "original" : "alternate" }));
    for (const product of products) {
      log(`    ${product.role === "alternate" ? "(alt) " : ""}${product.ok ? `✓ ${product.name} — ${product.currency ?? ""} ${product.price}${product.inStock === false ? " (out of stock)" : ""}` : `✗ ${product.problem}`}`);
    }
    writeFileSync(join(dir, "products.json"), JSON.stringify(products, (key, value) => (key === "image" ? undefined : value), 2));
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
    // Claude alone: the editor confirms every open check on the preview page before publishing.
    const checked = { research: result.research, by: ["claude"] };

    if (tryOut) {
      writeFileSync(tryOut.outFile, JSON.stringify(checked.research, null, 2));
      log(`  ✓ Research passed the checks (${checked.by.join(" + ")}). Saved to ${tryOut.outFile}`);
      return;
    }

    let response = await site(`/api/runner/looks/${job.id}`, { research: checked.research, by: checked.by });
    if (response.status === 422) {
      const { problems } = (await response.json()) as { problems: string[] };
      log(`  The site refused the draft (${problems.join("; ")}); asking Claude once…`);
      const fixed = check((await claude(dir, fixPrompt(problems), session)).result);
      if (!fixed.research) throw new Error(`The site refused the draft: ${problems.join("; ")}`);
      // The fix only touches what the site refused; the earlier checks still apply.
      const kept = { ...fixed.research, checks: [...new Set([...checked.research.checks, ...fixed.research.checks])].slice(0, 20) };
      response = await site(`/api/runner/looks/${job.id}`, { research: kept, by: checked.by });
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

// ------------------------------------------------------------------ morning scout

const SCOUT_PROMPT = join(process.cwd(), "docs", "look-research", "scout-prompt.md");
const SCOUT_STATE = join(homedir(), ".celebritypersona-monitor", "looks-scout-state.json");
/** The scout runs once a day, from this hour (IST) on, while the runner is open. */
const SCOUT_HOUR_IST = 8;
/** After a failed scout, wait this long before trying again the same day. */
const SCOUT_RETRY_MS = 2 * 60 * 60_000;

type ScoutState = { lastDay?: string; failedAt?: number };
const readScoutState = (): ScoutState => {
  try {
    return JSON.parse(readFileSync(SCOUT_STATE, "utf8")) as ScoutState;
  } catch {
    return {};
  }
};
const istHour = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(new Date()));

/**
 * Asks Claude for the last 48 hours' Indian celebrity fashion moments worth
 * decoding and sends them to the site as today's suggestions. Starts no
 * research: the editor queues the ones they want.
 */
async function scout(tryOnly = false) {
  let context: { today: string; coveredPosts: string[]; celebrities: string[] } = { today: istToday(), coveredPosts: [], celebrities: [] };
  if (!tryOnly) {
    const contextResponse = await fetch(`${SITE}/api/runner/looks/suggestions`, { headers: { authorization: `Bearer ${TOKEN}` } });
    if (!contextResponse.ok) throw new Error(`The site answered ${contextResponse.status} for the scout's context.`);
    context = (await contextResponse.json()) as typeof context;
  }
  const dir = mkdtempSync(join(tmpdir(), "cp-scout-"));
  try {
    writeFileSync(join(dir, "context.json"), JSON.stringify({ coveredPosts: context.coveredPosts, celebrities: context.celebrities }, null, 2));
    const prompt = readFileSync(SCOUT_PROMPT, "utf8").replace("{{TODAY}}", context.today);
    log("Scout: Claude is looking for this morning's looks (usually 5–15 minutes)…");
    const reply = await claude(dir, prompt);
    const raw = extractJson(reply.result) as { candidates?: unknown };
    if (tryOnly) {
      const cleaned = cleanCandidates(Array.isArray(raw?.candidates) ? raw.candidates : [], []);
      const outFile = join(process.cwd(), `look-scout-${Date.now()}.json`);
      writeFileSync(outFile, JSON.stringify({ raw, ...cleaned }, null, 2));
      log(`Scout (try): ${cleaned.kept.length} kept, ${cleaned.dropped.length} left out. Saved to ${outFile}; nothing sent to the site.`);
      return cleaned.kept.length;
    }
    const response = await fetch(`${SITE}/api/runner/looks/suggestions`, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ candidates: Array.isArray(raw?.candidates) ? raw.candidates : [] }),
    });
    if (!response.ok) throw new Error(`The site refused the suggestions (${response.status}).`);
    const { saved, dropped } = (await response.json()) as { saved: number; dropped: string[] };
    log(`Scout: ${saved} suggestion(s) saved${dropped.length ? `; left out: ${dropped.join("; ")}` : ""}. Queue them at ${SITE}/admin/outfits/from-links`);
    return saved;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs the scout once a day after SCOUT_HOUR_IST; never stops the runner. */
async function maybeScout() {
  const state = readScoutState();
  const today = istToday();
  if (state.lastDay === today || istHour() < SCOUT_HOUR_IST) return;
  if (state.failedAt && Date.now() - state.failedAt < SCOUT_RETRY_MS) return;
  try {
    await scout();
    writeFileSync(SCOUT_STATE, JSON.stringify({ lastDay: today }));
  } catch (error) {
    log(`Scout failed: ${error instanceof Error ? error.message : String(error)} (will try again in 2 hours)`);
    writeFileSync(SCOUT_STATE, JSON.stringify({ ...state, failedAt: Date.now() }));
  }
}

async function main() {
  if (process.argv.includes("--scout-try")) return void (await scout(true));
  if (process.argv.includes("--scout")) return void (await scout());
  if (process.argv.includes("--try")) return tryOne();
  log(`Look research runner → ${SITE}${ONCE ? " (one job)" : " (Ctrl+C to stop)"}`);
  for (;;) {
    if (!ONCE) await maybeScout();
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
