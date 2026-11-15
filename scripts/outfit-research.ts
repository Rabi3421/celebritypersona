/** Offline preparation only. No .env, database, API keys or network requests. */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { CLAIM_FIELDS, parseResearch } from "@/lib/outfit-research";

const args = process.argv.slice(2);
const option = (key: string) => args[args.indexOf(key) + 1];
if (args[0] !== "init" || !["--instagram", "--product", "--out"].every((key) => args.includes(key) && option(key))) {
  console.error('Usage: npm run outfit:research -- init --instagram "https://www.instagram.com/p/POST/" --product "https://retailer.com/product" --out "C:/path/to/research-folder"');
  process.exit(1);
}
const output = resolve(option("--out"));
const repo = resolve(process.cwd());
const rel = relative(repo, output);
if (!rel || (!rel.startsWith("..") && !isAbsolute(rel))) throw new Error("Research folders must be outside the website repository");
const research = parseResearch(JSON.stringify({
  schema: "cp-outfit-research/1", inputs: { instagramUrl: option("--instagram"), productUrl: option("--product") },
  researchedAt: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), sources: [],
  claims: Object.fromEntries(CLAIM_FIELDS.map((key) => [key, { value: null, status: "unknown", sourceIds: [], note: "Requires research" }])),
  seo: { keywords: [], searchIntent: "unclear", title: "", description: "", slug: "", notes: [], identification: "", faqs: [], imageAlts: [], internalLinks: [] },
  missing: ["Research the public sources; request caption or screenshots if Instagram is inaccessible."], warnings: [],
}));
for (const name of ["research.json", "prompt.md"]) if (existsSync(join(output, name))) throw new Error(`${name} already exists; existing research is never overwritten`);
mkdirSync(output, { recursive: true });
writeFileSync(join(output, "research.json"), JSON.stringify(research, null, 2) + "\n");
writeFileSync(join(output, "prompt.md"), readFileSync(join(repo, "docs/outfit-research/prompt.md"), "utf8"));
console.log(`Prepared ${output}. Open that folder in Codex and follow prompt.md. Nothing was fetched or saved to CelebrityPersona.`);
