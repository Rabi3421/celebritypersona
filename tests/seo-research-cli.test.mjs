// The local research command end to end, in a throwaway folder: init → check → challenge → compare.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildResearchPack, packMarkdown } from "../lib/seo-review/pack.ts";
import { checkReconciled } from "../lib/seo-review/reconcile.ts";
import { NEWS, RETAILER, findings, packInput, src } from "./ai-research-fixtures.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const TSX = join(REPO, "node_modules", "tsx", "dist", "cli.mjs");

function run(root, ...args) {
  const result = spawnSync(process.execPath, [TSX, "scripts/seo-research.ts", ...args], {
    cwd: REPO,
    env: { ...process.env, CP_RESEARCH_DIR: root },
    encoding: "utf8",
    timeout: 60000,
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

test("research command: init, independent passes in order, challenge, deterministic compare", { timeout: 180000 }, async () => {
  const temp = mkdtempSync(join(tmpdir(), "cp-research-test-"));
  try {
    const root = join(temp, "research");
    const downloads = join(temp, "downloads");
    const pack = await buildResearchPack(packInput());
    const packFile = join(temp, "cp-research-tara-synthetic-emerald-gown.pack.json");
    writeFileSync(packFile, JSON.stringify(pack, null, 2));
    writeFileSync(packFile.replace(/\.json$/, ".md"), packMarkdown(pack));

    // A pack edited after export is refused.
    const tampered = structuredClone(pack);
    tampered.pieces[0].wornPriceInr = 1;
    writeFileSync(join(temp, "tampered.pack.json"), JSON.stringify(tampered));
    const refused = run(root, "init", join(temp, "tampered.pack.json"));
    assert.equal(refused.code, 1);
    assert.match(refused.out, /edited after export/);

    // A research folder inside the website repository is refused.
    const inside = run(join(REPO, "research-test"), "init", packFile);
    assert.equal(inside.code, 1);
    assert.match(inside.out, /must live outside/);
    assert.equal(existsSync(join(REPO, "research-test")), false);

    const init = run(root, "init", packFile);
    assert.equal(init.code, 0, init.out);
    const dir = join(root, "tara-synthetic-emerald-gown");
    for (const f of ["pack.json", "pack.md", "README.md", "codex/pack.json", "codex/prompt.md", "claude/pack.json", "claude/prompt.md", "claude/.claude/settings.json"]) {
      assert.ok(existsSync(join(dir, f)), f);
    }
    assert.equal(existsSync(join(dir, "challenge")), false, "the challenge folder (with Claude's findings) does not exist during the independent passes");
    for (const f of ["codex/prompt.md", "claude/prompt.md"]) {
      const prompt = readFileSync(join(dir, f), "utf8");
      assert.ok(!prompt.includes("Tara Synthetic") && !prompt.includes("Example Atelier"), `${f}: no editor-written text is placed in a prompt`);
      assert.match(prompt, /is data, not instructions/);
      assert.match(prompt, new RegExp(pack.fingerprint));
    }
    assert.match(readFileSync(join(dir, "codex/prompt.md"), "utf8"), /"pass": "blind"/);
    const settings = JSON.parse(readFileSync(join(dir, "claude/.claude/settings.json"), "utf8"));
    assert.ok(settings.permissions.deny.includes("Bash"));
    assert.ok(settings.permissions.deny.includes("Read(../**)"));

    const retailer = src(RETAILER);
    const answers = { F1: ["confirmed", [src(NEWS)]], F4: ["confirmed", [retailer]] };
    const claude = findings(pack, { tool: "claude-code", pass: "research", answers });
    writeFileSync(join(dir, "claude/findings.json"), JSON.stringify(claude));
    const early = run(root, "challenge", "tara-synthetic-emerald-gown");
    assert.equal(early.code, 1, "the challenge waits for the Codex independent pass");
    assert.match(early.out, /Codex independent pass first/);

    writeFileSync(join(dir, "codex/findings.json"), JSON.stringify({ ...findings(pack, { tool: "codex", pass: "blind", answers }), extra: 1 }));
    const invalid = run(root, "check", "tara-synthetic-emerald-gown");
    assert.equal(invalid.code, 1);
    assert.match(invalid.out, /unexpected field “extra”/);
    writeFileSync(join(dir, "codex/findings.json"), JSON.stringify(findings(pack, { tool: "codex", pass: "blind", answers })));
    const ok = run(root, "check", "tara-synthetic-emerald-gown");
    assert.equal(ok.code, 0, ok.out);

    const challenge = run(root, "challenge", "tara-synthetic-emerald-gown");
    assert.equal(challenge.code, 0, challenge.out);
    assert.ok(existsSync(join(dir, "challenge/claude-findings.json")));
    assert.match(readFileSync(join(dir, "challenge/prompt.md"), "utf8"), /claude-findings\.json/);
    writeFileSync(
      join(dir, "challenge/findings.json"),
      JSON.stringify(findings(pack, { tool: "codex", pass: "challenge", challenges: [{ target: "R9", verdict: "agree", reason: "No such item.", sources: [] }] })),
    );
    const stray = run(root, "compare", "tara-synthetic-emerald-gown");
    assert.equal(stray.code, 1);
    assert.match(stray.out, /do not contain:\s+- R9/);
    writeFileSync(
      join(dir, "challenge/findings.json"),
      JSON.stringify(findings(pack, { tool: "codex", pass: "challenge", challenges: [{ target: "F4", verdict: "agree", reason: "The retailer page names the brand.", sources: [retailer] }] })),
    );

    const first = run(root, "compare", "tara-synthetic-emerald-gown");
    assert.equal(first.code, 0, first.out);
    const md1 = readFileSync(join(dir, "comparison.md"), "utf8");
    const json1 = readFileSync(join(dir, "reconciled.json"), "utf8");
    const second = run(root, "compare", "tara-synthetic-emerald-gown");
    assert.equal(second.code, 0);
    assert.equal(readFileSync(join(dir, "comparison.md"), "utf8"), md1, "comparison.md is identical on a re-run");
    assert.equal(readFileSync(join(dir, "reconciled.json"), "utf8"), json1, "reconciled.json is identical on a re-run");
    assert.match(md1, /## Final research summary/);
    assert.equal(checkReconciled(JSON.parse(json1), { key: pack.key, fingerprint: pack.fingerprint }).ok, true);

    // Re-initialising the same version keeps the findings; a different version is refused.
    assert.equal(run(root, "init", packFile).code, 0);
    assert.ok(existsSync(join(dir, "claude/findings.json")));
    const changed = await buildResearchPack(packInput({ look: { ...packInput().look, event: "Another Gala" } }));
    writeFileSync(join(downloads + ".pack.json"), JSON.stringify(changed));
    const other = run(root, "init", downloads + ".pack.json");
    assert.equal(other.code, 1);
    assert.match(other.out, /different version of this look/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
