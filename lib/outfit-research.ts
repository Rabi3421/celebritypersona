/** Reviewed outfit research. Pure and shared by browser, server and tests. */
import { z } from "zod";
import { outfitSchema } from "@/lib/validation";
import { type OutfitDraft } from "@/lib/outfit-form-fields";
import { outfitSlug, nameSlug } from "@/lib/slugs";
import { pieceLink, type Outfit } from "@/lib/types";
import { inventedMetric } from "@/lib/seo-review/findings";

export const RESEARCH_LIMIT = 100_000;
export const CLAIM_FIELDS = ["celebrity", "instagramPostDate", "outfitDate", "event", "occasion", "brand", "retailer", "productName", "category", "colours", "fabric", "productDescription", "price", "currency", "availability", "productMatch", "photoCredit"] as const;
const day = z.iso.date();
const publicUrl = z.string().max(2000).refine((value) => {
  try {
    const u = new URL(value);
    return !/[\s\\]/.test(value) && u.protocol === "https:" && !u.username && !u.password && !u.port &&
      !/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(u.hostname) &&
      !/^[\d.]+$|:|\[|\]/.test(u.hostname) && u.hostname.includes(".");
  } catch { return false; }
}, "Use a public HTTPS URL without credentials or a port");
export function instagramPost(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(u.hostname) || u.port || u.username || u.password) return null;
    const match = u.pathname.match(/^\/(?:p|reel)\/([A-Za-z0-9_-]{3,100})\/?$/);
    return match ? `https://www.instagram.com/p/${match[1]}/` : null;
  } catch { return null; }
}
export function canonicalProduct(value: string): string {
  const u = new URL(value);
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|igsh|ref$)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  u.hostname = u.hostname.replace(/^www\./, "");
  u.pathname = u.pathname.replace(/\/$/, "") || "/";
  return u.href;
}
const claim = z.strictObject({
  value: z.string().trim().min(1).max(1600).nullable(),
  status: z.enum(["verified", "inferred", "unknown"]),
  sourceIds: z.array(z.string().regex(/^S\d{1,3}$/)).max(8),
  note: z.string().max(600),
}).superRefine((c, ctx) => {
  if (c.status === "unknown" && c.value !== null) ctx.addIssue({ code: "custom", message: "Unknown claims must have a null value" });
  if (c.status !== "unknown" && !c.value) ctx.addIssue({ code: "custom", message: "Known claims need a value" });
  if (c.status === "verified" && !c.sourceIds.length) ctx.addIssue({ code: "custom", message: "Verified claims need evidence" });
});
export const researchSchema = z.strictObject({
  schema: z.literal("cp-outfit-research/1"),
  inputs: z.strictObject({ instagramUrl: publicUrl.refine((u) => Boolean(instagramPost(u)), "Use an Instagram post or reel URL"), productUrl: publicUrl.refine((u) => { try { return !/(^|\.)instagram\.com$/i.test(new URL(u).hostname); } catch { return false; } }, "Use a retailer product page") }),
  researchedAt: day,
  sources: z.array(z.strictObject({ id: z.string().regex(/^S\d{1,3}$/), url: publicUrl, accessedAt: day, title: z.string().min(1).max(200), quote: z.string().max(300) })).max(40),
  claims: z.strictObject(Object.fromEntries(CLAIM_FIELDS.map((key) => [key, claim])) as Record<(typeof CLAIM_FIELDS)[number], typeof claim>),
  seo: z.strictObject({
    keywords: z.array(z.strictObject({ keyword: z.string().trim().min(1).max(80), role: z.enum(["primary", "secondary", "related"]), rationale: z.string().max(600), demand: z.literal("unknown") })).max(20),
    searchIntent: z.enum(["identify-outfit", "buy", "style-inspiration", "celebrity-news", "unclear"]),
    title: z.string().max(60), description: z.string().max(160), slug: z.string().max(200).regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/),
    notes: z.array(z.string().min(1).max(2000)).max(20),
    identification: z.string().max(1200),
    faqs: z.array(z.strictObject({ question: z.string().min(1).max(200), answer: z.string().min(1).max(1200) })).max(10),
    imageAlts: z.array(z.string().max(160)).max(20),
    internalLinks: z.array(z.strictObject({ path: z.string().max(300).regex(/^\/(?!\/)[a-z0-9/-]*$/), reason: z.string().max(400) })).max(20),
  }),
  missing: z.array(z.string().max(400)).max(40), warnings: z.array(z.string().max(400)).max(40),
}).superRefine((r, ctx) => {
  const ids = r.sources.map((s) => s.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Duplicate source IDs" });
  for (const [key, c] of Object.entries(r.claims)) for (const id of c.sourceIds) if (!ids.includes(id)) ctx.addIssue({ code: "custom", path: ["claims", key], message: `Unknown source ${id}` });
  for (const key of ["instagramPostDate", "outfitDate"] as const) if (r.claims[key].value && !day.safeParse(r.claims[key].value).success) ctx.addIssue({ code: "custom", path: ["claims", key], message: "Use a real YYYY-MM-DD date" });
  if (r.seo.keywords.filter((k) => k.role === "primary").length > 1) ctx.addIssue({ code: "custom", message: "Choose at most one primary keyword" });
  if (r.seo.keywords.filter((k) => k.role === "secondary").length > 5) ctx.addIssue({ code: "custom", message: "Choose at most five secondary keywords" });
  if (new Set(r.seo.keywords.map((k) => k.keyword.toLowerCase())).size !== r.seo.keywords.length) ctx.addIssue({ code: "custom", message: "Keyword candidates must be unique" });
  if (inventedMetric(JSON.stringify(r.seo))) ctx.addIssue({ code: "custom", path: ["seo"], message: "SEO proposals must not state invented demand, difficulty, ranking or traffic metrics. Use the existing evidence workflow for observed demand." });
});
export type OutfitResearch = z.infer<typeof researchSchema>;
export function parseResearch(text: string, today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })) {
  if (new TextEncoder().encode(text).length > RESEARCH_LIMIT) throw new Error("Research must be under 100 KB");
  const raw: unknown = JSON.parse(text, (key, value) => {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Unsafe JSON key");
    return value;
  });
  // Bound work before schema validation (including errors) on untrusted files.
  const stack = [{ value: raw, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (++nodes > 2000 || depth > 12 || (Array.isArray(value) && value.length > 40)) throw new Error("Research JSON is too complex or has an oversized collection");
    if (value && typeof value === "object") for (const child of Object.values(value)) stack.push({ value: child, depth: depth + 1 });
  }
  const checked = researchSchema.safeParse(raw);
  if (!checked.success) throw new Error(checked.error.issues.slice(0, 12).map((i) => `${i.path.join(".")}: ${i.message.slice(0, 300)}`).join("\n"));
  const parsed = checked.data;
  if (parsed.researchedAt > today || parsed.sources.some((s) => s.accessedAt > today)) throw new Error("Research dates cannot be in the future");
  return parsed;
}
export const IMPORT_FIELDS = ["celebrity", "event", "occasion", "date", "slug", "seoTitle", "seoDescription", "primaryKeyword", "secondaryKeywords", "notes", "photoCredit", "items", "faqs"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export function proposedFields(r: OutfitResearch, allowInferred: boolean): Partial<OutfitDraft> {
  const value = (key: (typeof CLAIM_FIELDS)[number]) => {
    const c = r.claims[key];
    return c.status === "verified" || (allowInferred && c.status === "inferred") ? c.value ?? "" : "";
  };
  const exact = r.claims.productMatch.status === "verified" && r.claims.productMatch.value === "exact";
  const price = r.claims.price;
  const inr = r.claims.currency.status === "verified" && r.claims.currency.value === "INR";
  const item = {
    name: value("productName"), category: value("category"), colours: value("colours"),
    wornBrand: exact ? value("brand") : "", wornUrl: exact ? r.inputs.productUrl : "",
    wornRetailer: exact ? value("retailer") : "", wornStatus: "unverified", wornNetwork: "none",
    swapStatus: "unverified", swapNetwork: "none",
    worn: exact && inr && price.status === "verified" && /^[1-9]\d*$/.test(price.value ?? "") && Number.isSafeInteger(Number(price.value)) ? price.value! : "",
    // Link reachability and a stock claim are separate. Imported links stay unverified.
    note: "", leadPiece: "on",
  };
  return {
    celebrity: value("celebrity"), event: value("event"), occasion: value("occasion"), date: value("outfitDate"),
    slug: r.seo.slug, seoTitle: r.seo.title, seoDescription: r.seo.description,
    primaryKeyword: r.seo.keywords.find((k) => k.role === "primary")?.keyword ?? "",
    secondaryKeywords: r.seo.keywords.filter((k) => k.role === "secondary").slice(0, 5).map((k) => k.keyword).join(", "),
    notes: r.seo.notes.join("\n"), photoCredit: value("photoCredit"), items: item.name ? [item] : [], faqs: r.seo.faqs,
  };
}
/** Merge only explicitly checked groups into a fresh snapshot, including all photos. */
export function mergeResearch(current: OutfitDraft, proposed: Partial<OutfitDraft>, selected: readonly ImportField[]): OutfitDraft {
  const next = { ...current };
  for (const key of selected) if (proposed[key] !== undefined) Object.assign(next, { [key]: proposed[key] });
  next.status = "draft";
  if (selected.includes("items")) next.leadPiece = next.items.length ? "0" : "";
  return next;
}
export function validateDraft(draft: OutfitDraft) {
  return outfitSchema.safeParse({ ...draft, notes: draft.notes.split("\n").map((s) => s.trim()).filter(Boolean), occasions: draft.occasions.split(",").filter(Boolean), secondaryKeywords: draft.secondaryKeywords.split(",").map((s) => s.trim()).filter(Boolean) });
}
export type DuplicateLook = Pick<Outfit, "id" | "celebrity" | "event" | "date" | "slug" | "items"> & { researchImport?: Pick<ImportProvenance, "instagramUrl" | "productUrl"> };
export type ImportProvenance = { instagramUrl: string; productUrl: string; research: OutfitResearch; approvedFields: ImportField[]; importedAt: string; approvedBy?: string };
export function researchDuplicates(r: OutfitResearch, outfits: DuplicateLook[]) {
  const post = instagramPost(r.inputs.instagramUrl);
  const product = canonicalProduct(r.inputs.productUrl);
  const celebrity = nameSlug(r.claims.celebrity.value ?? "");
  return outfits.flatMap((o) => {
    const reasons: string[] = [];
    if (o.researchImport && instagramPost(o.researchImport.instagramUrl) === post) reasons.push("Same Instagram post");
    if ((o.researchImport && canonicalProduct(o.researchImport.productUrl) === product) || o.items.some((i) => {
      const url = pieceLink(i, "original")?.url;
      try { return url && canonicalProduct(url) === product; } catch { return false; }
    })) reasons.push("Same retailer product");
    if (r.seo.slug && outfitSlug(o) === r.seo.slug) reasons.push("Slug already in use");
    if (celebrity && nameSlug(o.celebrity) === celebrity && o.items.some((i) => i.category && i.category === r.claims.category.value)) reasons.push("Same celebrity and garment category");
    return reasons.length ? [{ id: o.id, slug: outfitSlug(o), reasons, blocked: reasons.includes("Same Instagram post") }] : [];
  });
}
