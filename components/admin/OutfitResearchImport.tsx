"use client";

import { useMemo, useState } from "react";
import { CLAIM_FIELDS, IMPORT_FIELDS, mergeResearch, parseResearch, proposedFields, researchDuplicates, RESEARCH_LIMIT, type DuplicateLook, type ImportField, type OutfitResearch } from "@/lib/outfit-research";
import { readOutfitDraft, type OutfitDraft } from "@/lib/outfit-form-fields";
import s from "./outfit-research.module.css";

/** This component has no action, fetch or database capability. */
export function OutfitResearchImport({ formId, outfits, onApply, restorePending }: {
  formId: string; outfits: DuplicateLook[]; onApply: (draft: OutfitDraft) => void; restorePending: boolean;
}) {
  const [text, setText] = useState("");
  const [research, setResearch] = useState<OutfitResearch | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<ImportField[]>([]);
  const [inferred, setInferred] = useState(false);
  const [approved, setApproved] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(true);
  const proposals = useMemo(() => research ? proposedFields(research, inferred) : {}, [research, inferred]);
  const duplicates = research ? researchDuplicates(research, outfits) : [];
  const blocked = duplicates.some((d) => d.blocked);
  function preview(raw: string) {
    setError(""); setMessage(""); setResearch(null); setSelected([]); setApproved(false); setInferred(false); setReviewOpen(true);
    try { setResearch(parseResearch(raw)); } catch (e) { setError(e instanceof Error ? e.message : "Invalid research JSON"); }
  }
  function apply() {
    if (!research || !approved || blocked || restorePending || !selected.length) return;
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement) || new FormData(form).get("id")) return;
    const current = readOutfitDraft(new FormData(form));
    const next = mergeResearch(current, proposals, selected);
    next.researchImport = JSON.stringify({ research, approvedFields: selected });
    onApply(next);
    setReviewOpen(false);
    setMessage("Approved fields applied to the unsaved form. Nothing was saved. Complete missing fields, then explicitly Save as Draft.");
    setApproved(false);
  }
  return <section className={s.panel} aria-labelledby="research-import-title">
    <h2 id="research-import-title">Import outfit research</h2>
    <p>Start with the Instagram post and retailer product URLs in the research prompt. Paste Codex’s structured JSON here or choose its file. Review the evidence before selecting fields.</p>
    <label className={s.label}>Research JSON file
      <input type="file" accept="application/json,.json" onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > RESEARCH_LIMIT) { setError("Research must be under 100 KB"); setResearch(null); return; }
        const raw = await file.text(); setText(raw); preview(raw);
      }} />
    </label>
    <label className={s.label}>Or paste research JSON
      <textarea rows={5} value={text} onChange={(e) => { setText(e.target.value); setResearch(null); setApproved(false); }} spellCheck={false} />
    </label>
    <button type="button" onClick={() => preview(text)}>Preview research</button>
    {error ? <p role="alert" className={s.error}>{error}</p> : null}
    {message ? <p role="status" className={s.success}>{message}</p> : null}
    {research ? <details className={s.review} open={reviewOpen} onToggle={(e) => setReviewOpen(e.currentTarget.open)}>
      <summary>Review proposed fields and source evidence</summary>
      <h3>Source evidence and uncertainty</h3>
      <p><a href={research.inputs.instagramUrl} target="_blank" rel="noreferrer">Instagram post</a> · <a href={research.inputs.productUrl} target="_blank" rel="noreferrer">Retailer product</a> · Researched {research.researchedAt}</p>
      <p>“Verified” records the researcher’s evidence claim; the importer cannot establish that a quotation or product match is true. Review the linked sources. A post date is never assumed to be the outfit date.</p>
      <div className={s.claims}>{CLAIM_FIELDS.map((key) => {
        const c = research.claims[key];
        return <article key={key}><strong>{key}</strong><span className={s.badge}>{c.status}</span><p>{c.value ?? "Unknown"}</p><p>{c.note}</p>
          {c.sourceIds.map((id) => { const source = research.sources.find((x) => x.id === id)!; return <p key={id}><a href={source.url} target="_blank" rel="noreferrer">{id}: {source.title}</a> ({source.accessedAt})<br /><q>{source.quote}</q></p>; })}
        </article>;
      })}</div>
      <h3>Duplicate review</h3>
      <p>Checks include drafts and published looks. Historical Instagram URLs were not stored; those matches cannot be detected. Reused products can be legitimate and require review.</p>
      {duplicates.length ? <ul>{duplicates.map((d) => <li key={d.id}><a href={`/admin/outfits/${d.id}`} target="_blank" rel="noreferrer">Look {d.id}</a>: {d.reasons.join("; ")}{d.blocked ? " — import blocked" : " — review before saving"}</li>)}</ul> : <p>No candidates found in the loaded catalog. Checks run again when saving.</p>}
      <h3>Missing information and warnings</h3>
      <ul>{[...research.missing, ...research.warnings].map((x, i) => <li key={i}>{x}</li>)}</ul>
      <p>Only a verified exact product match can populate original brand, retailer and buying link. Price also needs verified INR and a positive whole rupee amount. Stock status remains evidence for manual review; links start unverified. Images and hotspots are never imported.</p>
      <h3>SEO proposals</h3>
      <p>Intent: {research.seo.searchIntent}. Keyword demand: unknown. Existing SEO publishing checks remain in effect.</p>
      <ul>{research.seo.keywords.map((k, i) => <li key={i}>{k.role}: {k.keyword} — {k.rationale}; demand unknown</li>)}</ul>
      <p>{research.seo.identification}</p>
      <details><summary>Suggested image alt text and internal links</summary><ul>{research.seo.imageAlts.map((alt, i) => <li key={i}>{alt}</li>)}{research.seo.internalLinks.map((link, i) => <li key={`l${i}`}>{link.path}: {link.reason}</li>)}</ul><p>Apply alt text only after inspecting each uploaded photograph. Confirm that suggested internal pages exist.</p></details>
      <h3>Select fields to apply</h3>
      <label className={s.check}><input type="checkbox" checked={inferred} onChange={(e) => { setInferred(e.target.checked); setSelected([]); setApproved(false); }} />I have confirmed inferred field values and want them offered below. Unverified prices and product matches remain excluded.</label>
      <p>Checked groups replace their current form values, including all piece rows or FAQs when selected. Unchecked fields and all uploaded photos are preserved. Review and save existing keyword research before changing the slug or content.</p>
      <div className={s.claims}>{IMPORT_FIELDS.map((key) => <label className={s.choice} key={key}>
        <span><input type="checkbox" aria-label={`Apply ${key}`} checked={selected.includes(key)} onChange={(e) => { setSelected((prev) => e.target.checked ? [...prev, key] : prev.filter((x) => x !== key)); setApproved(false); }} /> {key}</span>
        <pre>{typeof proposals[key] === "string" ? proposals[key] || "Missing — complete manually" : JSON.stringify(proposals[key], null, 2)}</pre>
      </label>)}</div>
      <label className={s.check}><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />I reviewed the evidence, duplicate candidates and replacement fields. Apply only the checked groups to this new draft.</label>
      {restorePending ? <p role="alert">Restore or discard the browser’s existing unsaved draft before applying research.</p> : null}
      <button type="button" disabled={!approved || !selected.length || blocked || restorePending} onClick={apply}>Apply approved fields to form</button>
    </details> : null}
  </section>;
}
