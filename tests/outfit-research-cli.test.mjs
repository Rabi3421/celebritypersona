import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { parseResearch } from "../lib/outfit-research.ts";

test("research intake CLI: offline scaffold, strict URL checks, no overwrite", () => {
  const root = mkdtempSync(join(tmpdir(), "cp-outfit-cli-test-"));
  const output = join(root, "intake");
  const args = ["--import", "./tests/register.mjs", "scripts/outfit-research.ts", "init", "--instagram", "https://www.instagram.com/p/SYNTHETIC_ONLY/", "--product", "https://retailer.example/product", "--out", output];
  try {
    const result = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const original = readFileSync(join(output, "research.json"), "utf8");
    const research = parseResearch(original);
    assert.ok(Object.values(research.claims).every((c) => c.status === "unknown" && c.value === null));
    assert.match(readFileSync(join(output, "prompt.md"), "utf8"), /Never invent/);
    assert.notEqual(spawnSync(process.execPath, args, { encoding: "utf8" }).status, 0);
    assert.equal(readFileSync(join(output, "research.json"), "utf8"), original);
    const invalid = [...args]; invalid[5] = "https://instagram.com/not-a-post";
    assert.notEqual(spawnSync(process.execPath, invalid, { encoding: "utf8" }).status, 0);
  } finally {
    const target = resolve(root);
    assert.ok(relative(resolve(tmpdir()), target).startsWith("cp-outfit-cli-test-"));
    rmSync(target, { recursive: true, force: true });
  }
});
