/**
 * The dual-AI SEO research workflow, run locally. No network, no API keys,
 * no database: it only reads and writes files in the research folder.
 *
 *   npm run seo:research -- init <path to the downloaded …pack.json>
 *   npm run seo:research -- check <slug>
 *   npm run seo:research -- challenge <slug>
 *   npm run seo:research -- compare <slug>
 *
 * Research folders live outside every repository:
 *   %USERPROFILE%\celebritypersona-research\<slug>\   (override: CP_RESEARCH_DIR)
 *
 *   <slug>/pack.json, pack.md, README.md
 *   <slug>/codex/      pack.json, prompt.md                → findings.json  (Codex, independent)
 *   <slug>/claude/     pack.json, prompt.md, .claude/       → findings.json  (Claude Code, independent)
 *   <slug>/challenge/  pack.json, claude-findings.json, prompt.md → findings.json (Codex reviews Claude)
 *   <slug>/comparison.md, reconciled.json                    ← compare
 *
 * Each AI gets its own folder holding only what that pass may see. Prompts
 * are filled in only with checked values (slug, key, fingerprint): nothing an
 * editor typed is ever placed inside a prompt.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve, isAbsolute } from "node:path";
import { checkFindings, type Findings } from "@/lib/seo-review/findings";
import { canonicalJson, factChecks, packFingerprint, PACK_SCHEMA, type ResearchPack } from "@/lib/seo-review/pack";
import { comparisonMarkdown, reconcile } from "@/lib/seo-review/reconcile";
import { parseJsonText } from "@/lib/seo-review/schema";

const REPO = resolve(process.cwd());
const DOCS = join(REPO, "docs", "seo-research");
const ROOT = resolve(process.env.CP_RESEARCH_DIR || join(homedir(), "celebritypersona-research"));
const FORBIDDEN_ROOTS = [REPO, resolve(REPO, "..", "celebritypersona-monitor"), join(homedir(), ".celebritypersona-monitor")];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const inside = (child: string, parent: string) => {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

function fail(message: string, details: string[] = []): never {
  console.error(`\n✖ ${message}`);
  for (const d of details) console.error(`  - ${d}`);
  console.error("");
  process.exit(1);
}

function guardRoot() {
  for (const forbidden of FORBIDDEN_ROOTS) {
    if (inside(ROOT, forbidden) || inside(forbidden, ROOT)) fail(`Research folders must live outside the website, the Worker and the credentials folder. ${ROOT} overlaps ${forbidden}.`);
  }
}

function readJson(path: string) {
  if (!existsSync(path)) fail(`Not found: ${path}`);
  const parsed = parseJsonText(readFileSync(path, "utf8"));
  if (!parsed.ok) fail(`${path}: ${parsed.error}`);
  return parsed.value;
}

const sha256File = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

/** The pack as exported, checked: its fingerprint and fact list must match its own content. */
async function loadPack(path: string): Promise<ResearchPack> {
  const raw = readJson(path) as ResearchPack;
  if (!raw || raw.schema !== PACK_SCHEMA) fail(`${path} is not a research pack (${PACK_SCHEMA}).`);
  if (typeof raw.key !== "string" || !/^(outfit:\d{1,9}|prepared:[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(raw.key)) fail("The pack has no valid key.");
  if (!raw.look || !Array.isArray(raw.pieces) || !Array.isArray(raw.checks)) fail("The pack is incomplete.");
  const fingerprint = await packFingerprint(raw);
  if (fingerprint !== raw.fingerprint) fail("The pack's content does not match its fingerprint — it was edited after export. Download it again from the admin.");
  if (canonicalJson(factChecks(raw.look, raw.pieces)) !== canonicalJson(raw.checks)) fail("The pack's fact list does not match its content — it was edited after export. Download it again.");
  return raw;
}

const folderName = (pack: ResearchPack) => {
  const name = pack.look.slug && SLUG.test(pack.look.slug) ? pack.look.slug : pack.key.replace(":", "-");
  if (!SLUG.test(name)) fail(`Cannot make a folder name from ${pack.key}.`);
  return name;
};

function slugArg(value: string | undefined) {
  if (!value || !SLUG.test(value)) fail("Give the research folder's name (the look's slug), e.g. npm run seo:research -- check rukmini-vasanth-black-dress");
  const dir = join(ROOT, value);
  if (!existsSync(join(dir, "pack.json"))) fail(`No research folder at ${dir}. Run init first.`);
  return dir;
}

function prompt(template: string, values: Record<string, string>) {
  let text = readFileSync(join(DOCS, template), "utf8");
  const parts: Record<string, string> = {
    RULES: readFileSync(join(DOCS, "rules.md"), "utf8"),
    FORMAT: readFileSync(join(DOCS, "format.md"), "utf8"),
  };
  for (const [k, v] of Object.entries(parts)) text = text.split(`{{${k}}}`).join(v);
  for (const [k, v] of Object.entries(values)) text = text.split(`{{${k}}}`).join(v);
  if (/\{\{[A-Z]+\}\}/.test(text)) fail(`Unfilled placeholder in ${template}.`);
  return text;
}

/** Claude Code settings for the claude/ folder: no shell, no edits outside findings.json. */
const CLAUDE_SETTINGS = {
  permissions: {
    allow: ["Read(./pack.json)", "Read(./prompt.md)", "Write(./findings.json)", "Edit(./findings.json)", "WebSearch", "WebFetch"],
    deny: [
      "Bash",
      "PowerShell",
      "NotebookEdit",
      "Read(../**)",
      "Write(../**)",
      "Edit(../**)",
      "Read(~/.celebritypersona-monitor/**)",
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Read(**/.env)",
      "Read(**/.env.*)",
    ],
  },
  enableAllProjectMcpServers: false,
};

function readme(slug: string, pack: ResearchPack) {
  return `# SEO research — ${slug}

Pack ${pack.key} · fingerprint ${pack.fingerprint} · exported ${pack.generatedAt}${pack.basis === "saved" ? "" : ` · **${pack.basis === "unsaved-edits" ? "made from UNSAVED edits" : "a look not saved yet"}**`}

Run the steps in this order. Each AI works in its own folder, which holds only what it may see.
The folders and claude/.claude/settings.json reduce what each tool sees; they are NOT a verified security
boundary — both tools can be allowed to read elsewhere on this computer. Deny any request to read outside
the folder, to run commands, or to use a connector. First run: ask Claude to read ..\\pack.md — it must refuse.
Sending pack.json to Claude or Codex shares this unpublished look with Anthropic or OpenAI under your subscription.

1. **Codex, independent** — open the \`codex\` folder in Codex (app, VS Code or CLI), with web search on and
   sandbox "workspace-write" / approval "on-request" (CLI: check \`codex --help\` for the exact flags).
   Say: "Read prompt.md and follow it exactly." → writes codex/findings.json
2. **Claude Code, independent** — open the \`claude\` folder in Claude Code (VS Code: File → Open Folder; CLI: start \`claude\` there).
   Its .claude/settings.json denies the shell and anything outside the folder. Never approve a request to read outside it.
   Say: "Read prompt.md and follow it exactly." → writes claude/findings.json
3. In the website folder: \`npm run seo:research -- check ${slug}\` — fix any problems by pasting them back to the tool.
4. \`npm run seo:research -- challenge ${slug}\` — prepares the challenge folder with Claude's findings.
5. **Codex, challenge** — open the \`challenge\` folder in Codex, same settings. Say: "Read prompt.md and follow it exactly."
6. \`npm run seo:research -- compare ${slug}\` → comparison.md (read this) and reconciled.json.
7. Admin → the look → SEO research → Keyword research → **Import findings** → choose reconciled.json, review, tick, save.
`;
}

async function init(file: string | undefined) {
  guardRoot();
  if (!file) fail("Give the path of the downloaded pack, e.g. npm run seo:research -- init \"%USERPROFILE%\\Downloads\\cp-research-<slug>.pack.json\"");
  const source = resolve(file);
  const pack = await loadPack(source);
  const slug = folderName(pack);
  const dir = join(ROOT, slug);
  if (existsSync(join(dir, "pack.json"))) {
    const existing = readJson(join(dir, "pack.json")) as ResearchPack;
    if (existing.fingerprint !== pack.fingerprint) {
      fail(`${dir} already holds research for a different version of this look. Move or rename that folder first (nothing is deleted automatically).`);
    }
  }
  const values = { SLUG: slug, TITLE: slug, KEY: pack.key, FINGERPRINT: pack.fingerprint };
  const independent = "This is an independent pass. Do not look for, open or ask for any other researcher's findings, even if you notice files elsewhere.";
  const md = source.replace(/\.json$/i, ".md");
  for (const sub of ["", "codex", "claude", join("claude", ".claude")]) mkdirSync(join(dir, sub), { recursive: true });
  for (const sub of ["", "codex", "claude"]) copyFileSync(source, join(dir, sub, "pack.json"));
  if (existsSync(md)) copyFileSync(md, join(dir, "pack.md"));
  writeFileSync(join(dir, "codex", "prompt.md"), prompt("prompt-research.md", { ...values, TOOL: "codex", PASS: "blind", SIDE: "Codex, independent research", INDEPENDENCE: independent }));
  writeFileSync(join(dir, "claude", "prompt.md"), prompt("prompt-research.md", { ...values, TOOL: "claude-code", PASS: "research", SIDE: "Claude Code, independent research", INDEPENDENCE: independent }));
  writeFileSync(join(dir, "claude", ".claude", "settings.json"), `${JSON.stringify(CLAUDE_SETTINGS, null, 2)}\n`);
  writeFileSync(join(dir, "README.md"), readme(slug, pack));
  console.log(`\n✓ Research folder ready: ${dir}`);
  console.log(`  Pack ${pack.key}, fingerprint ${pack.fingerprint.slice(0, 12)}…, ${pack.checks.length} facts to check${pack.basis === "saved" ? "" : ` — NOTE: ${pack.basis}`}.`);
  console.log(`  Next: follow ${join(dir, "README.md")} (Codex in codex\\, then Claude Code in claude\\).\n`);
}

function checkFile(path: string, pack: ResearchPack, pass: Findings["pass"]): Findings | string[] {
  if (!existsSync(path)) return [`missing — the ${pass} pass has not written ${path} yet`];
  const parsed = parseJsonText(readFileSync(path, "utf8"));
  if (!parsed.ok) return [parsed.error];
  const result = checkFindings(parsed.value, pack, pass, today());
  return result.ok ? result.value : result.errors;
}

async function check(slug: string | undefined, quiet = false) {
  guardRoot();
  const dir = slugArg(slug);
  const pack = await loadPack(join(dir, "pack.json"));
  const files = [
    { label: "Codex independent (codex/findings.json)", path: join(dir, "codex", "findings.json"), pass: "blind" as const },
    { label: "Claude independent (claude/findings.json)", path: join(dir, "claude", "findings.json"), pass: "research" as const },
    ...(existsSync(join(dir, "challenge")) ? [{ label: "Codex challenge (challenge/findings.json)", path: join(dir, "challenge", "findings.json"), pass: "challenge" as const }] : []),
  ];
  const results = files.map((f) => ({ ...f, result: checkFile(f.path, pack, f.pass) }));
  if (!quiet) {
    for (const r of results) {
      if (Array.isArray(r.result)) {
        console.log(`\n✖ ${r.label}`);
        for (const e of r.result) console.log(`  - ${e}`);
      } else console.log(`\n✓ ${r.label}: ${r.result.checks.length} facts, ${r.result.keywords.length} keywords, ${r.result.recommendations.length} recommendations, ${r.result.challenges.length} verdicts`);
    }
    console.log("");
  }
  return { dir, pack, results };
}

async function challenge(slug: string | undefined) {
  const { dir, pack, results } = await check(slug, true);
  const codex = results.find((r) => r.pass === "blind")!;
  const claude = results.find((r) => r.pass === "research")!;
  if (Array.isArray(codex.result)) fail("Run and check the Codex independent pass first, so it stays independent of Claude's findings.", codex.result);
  if (Array.isArray(claude.result)) fail("Claude's findings are not valid yet.", claude.result);
  const out = join(dir, "challenge");
  mkdirSync(out, { recursive: true });
  copyFileSync(join(dir, "pack.json"), join(out, "pack.json"));
  copyFileSync(claude.path, join(out, "claude-findings.json"));
  writeFileSync(join(out, "prompt.md"), prompt("prompt-challenge.md", { SLUG: folderName(pack), TITLE: folderName(pack), KEY: pack.key, FINGERPRINT: pack.fingerprint, TOOL: "codex", PASS: "challenge" }));
  console.log(`\n✓ Challenge folder ready: ${out}\n  Open it in Codex and say: "Read prompt.md and follow it exactly."\n`);
}

async function compare(slug: string | undefined) {
  const { dir, pack, results } = await check(slug, true);
  const bad = results.filter((r) => Array.isArray(r.result));
  if (bad.length) fail("Fix these findings first (run check for details):", bad.flatMap((r) => (r.result as string[]).slice(0, 8).map((e) => `${r.label}: ${e}`)));
  const get = (pass: string) => results.find((r) => r.pass === pass);
  const challengeRun = get("challenge");
  if (!challengeRun) console.warn("\n⚠  No challenge pass yet: Claude's findings have not been cross-checked, so nothing Claude alone raised will be pre-ticked.");
  const claudeIds = new Set([...(get("research")!.result as Findings).checks.map((c) => c.id), ...(get("research")!.result as Findings).additionalFacts.map((c) => c.id), ...(get("research")!.result as Findings).recommendations.map((r) => r.id), ...(get("research")!.result as Findings).keywords.map((k) => `K:${k.keyword}`)]);
  const stray = challengeRun ? (challengeRun.result as Findings).challenges.filter((c) => !claudeIds.has(c.target)).map((c) => c.target) : [];
  if (stray.length) fail("The challenge pass judges items Claude's findings do not contain:", stray);
  const reconciled = reconcile({
    pack,
    claude: get("research")!.result as Findings,
    codex: get("blind")!.result as Findings,
    ...(challengeRun ? { challenge: challengeRun.result as Findings } : {}),
    hashes: {
      claude: sha256File(get("research")!.path),
      codex: sha256File(get("blind")!.path),
      ...(challengeRun ? { challenge: sha256File(challengeRun.path) } : {}),
    },
  });
  writeFileSync(join(dir, "reconciled.json"), `${JSON.stringify(reconciled, null, 2)}\n`);
  writeFileSync(join(dir, "comparison.md"), comparisonMarkdown(reconciled));
  const s = reconciled.summary;
  console.log(`\n✓ Compared. Read ${join(dir, "comparison.md")}`);
  console.log(`  Primary keyword: ${s.primaryKeyword.keyword ?? "none agreed"} · facts supported ${reconciled.facts.filter((f) => f.decision === "verified").length}/${reconciled.facts.length} · ready for human review: ${s.readyForReview.ready ? "yes" : "not yet"}`);
  for (const w of s.warnings) console.log(`  ⚠ ${w}`);
  console.log(`  Import ${join(dir, "reconciled.json")} in the admin's SEO research panel.\n`);
}

const [command, arg] = process.argv.slice(2);
const run = { init: () => init(arg), check: () => check(arg).then(({ results }) => process.exit(results.some((r) => Array.isArray(r.result)) ? 1 : 0)), challenge: () => challenge(arg), compare: () => compare(arg) }[command as "init"];
if (!run) fail("Usage: npm run seo:research -- init <pack.json> | check <slug> | challenge <slug> | compare <slug>");
run().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));


