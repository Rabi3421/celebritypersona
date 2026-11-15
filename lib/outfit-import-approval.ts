import { IMPORT_FIELDS, parseResearch, type ImportField, type ImportProvenance } from "@/lib/outfit-research";

export function importApproval(raw: string, { id, status, confirmed }: { id: number; status: string; confirmed: boolean }): ImportProvenance {
  if (id !== 0 || status !== "draft" || !confirmed) throw new Error("Research imports can only create a new draft after explicit confirmation.");
  if (new TextEncoder().encode(raw).length > 110_000) throw new Error("Import is too large");
  const envelope = JSON.parse(raw);
  if (!envelope || Object.keys(envelope).sort().join(",") !== "approvedFields,research" || !Array.isArray(envelope.approvedFields) || !envelope.approvedFields.length || envelope.approvedFields.length > IMPORT_FIELDS.length || !envelope.approvedFields.every((key: unknown) => IMPORT_FIELDS.includes(key as ImportField))) throw new Error("Invalid approved field selection");
  const research = parseResearch(JSON.stringify(envelope.research));
  return { instagramUrl: research.inputs.instagramUrl, productUrl: research.inputs.productUrl, research, approvedFields: [...new Set(envelope.approvedFields)] as ImportField[], importedAt: new Date().toISOString() };
}
