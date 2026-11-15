import { CLAIM_FIELDS, type ImportProvenance } from "@/lib/outfit-research";
import s from "./outfit-research.module.css";

/** Retains the original evidence for manual completion of a saved draft. */
export function OutfitResearchEvidence({ provenance }: { provenance: ImportProvenance }) {
  return <details className={s.panel}>
    <summary>Imported research evidence and manual completion</summary>
    <p>Imported {provenance.importedAt}{provenance.approvedBy ? ` by ${provenance.approvedBy}` : ""}. Approved groups: {provenance.approvedFields.join(", ")}. This is the original research, which may differ from later manual edits. Recheck changed claims before publishing.</p>
    <p><a href={provenance.instagramUrl} target="_blank" rel="noreferrer">Instagram source</a> · <a href={provenance.productUrl} target="_blank" rel="noreferrer">Product source</a></p>
    <div className={s.claims}>{CLAIM_FIELDS.map((key) => {
      const claim = provenance.research.claims[key];
      return <article key={key}><strong>{key}</strong><span className={s.badge}>{claim.status}</span><p>{claim.value ?? "Unknown"}</p><p>{claim.note}</p>
        {claim.sourceIds.map((id) => { const source = provenance.research.sources.find((s) => s.id === id); return source ? <p key={id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> ({source.accessedAt})<br /><q>{source.quote}</q></p> : null; })}
      </article>;
    })}</div>
    <ul>{[...provenance.research.missing, ...provenance.research.warnings].map((note, i) => <li key={i}>{note}</li>)}</ul>
    <p>Upload permitted images, inspect and describe each photograph, confirm credits and original product identity, recheck prices and stock, resolve SEO blockers, then publish manually.</p>
  </details>;
}
