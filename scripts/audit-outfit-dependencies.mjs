/** Audit installed tree and compare every vulnerable node with the pre-feature lockfile. */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
const npmCli = join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const result = spawnSync(process.execPath, [npmCli, "audit", "--json"], { encoding: "utf8", maxBuffer: 10_000_000 });
const raw = JSON.parse(result.stdout);
const production = JSON.parse(spawnSync(process.execPath, [npmCli, "audit", "--omit=dev", "--json"], { encoding: "utf8", maxBuffer: 10_000_000 }).stdout);
if (!raw.vulnerabilities) throw new Error("Registry audit unavailable");
const baseline = JSON.parse(execFileSync("git", ["show", "HEAD:package-lock.json"], { encoding: "utf8", maxBuffer: 10_000_000 }));
const installed = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages = Object.entries(raw.vulnerabilities).map(([name, v]) => ({
  name, severity: v.severity, direct: v.isDirect, fixAvailable: v.fixAvailable,
  nodes: v.nodes.map((path) => ({ path, version: installed.packages[path]?.version, devOnly: Boolean(installed.packages[path]?.dev), devOptional: Boolean(installed.packages[path]?.devOptional), baselineVersion: baseline.packages[path]?.version, newlyIntroduced: !baseline.packages[path] || baseline.packages[path].version !== installed.packages[path]?.version })),
  inheritedVia: v.via.filter((x) => typeof x === "string"),
  advisories: v.via.filter((x) => typeof x === "object").map(({ title, url, severity, range }) => ({ title, url, severity, range })),
}));
const report = { inspectedAt: new Date().toISOString(), summary: raw.metadata.vulnerabilities, productionSummary: production.metadata.vulnerabilities, productionPackages: Object.keys(production.vulnerabilities), packages };
writeFileSync("docs/outfit-research/dependency-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
