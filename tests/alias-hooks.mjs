// Test-only module resolution, registered by tests/register.mjs (see package.json "test").
//
// The app imports through the "@/..." alias from tsconfig.json, with no file
// extension, which Next resolves and plain Node does not. This maps "@/x" to
// the repository's x.ts / x.tsx / x/index.ts, and stubs "server-only" (a Next
// marker package that throws outside a server bundle). Nothing else changes.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const base = path.join(ROOT, specifier.slice(2));
    for (const ext of EXTENSIONS) {
      const file = base + ext;
      if (existsSync(file) && (ext !== "" || path.extname(file))) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
