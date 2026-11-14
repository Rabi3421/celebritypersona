"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReviewContext } from "@/lib/seo-review/audit";
import { evidenceProblems, type Evidence } from "@/lib/seo-review/evidence";
import type { OutfitSnapshot } from "@/lib/outfit-form-snapshot";
import { buildResearchPack, packMarkdown, type ResearchPack } from "@/lib/seo-review/pack";
import { checkReconciled, type Reconciled, type ReconciledFact, type ReconciledKeyword, type ReconciledRecommendation } from "@/lib/seo-review/reconcile";
import type { Review } from "@/lib/seo-review/review";
import { MAX_FILE_BYTES, parseJsonText } from "@/lib/seo-review/schema";
import { LIMITS, type AiReview, type AiReviewItem, type Candidate, type CandidateRole } from "@/lib/seo-review/store";
import { SuggestionBox, type Research } from "./SeoResearch";
import s from "./research.module.css";

/**
 * Dual-AI research, by hand: download this look as a research pack, run
 * Claude Code and Codex on it in your own subscriptions (docs/seo-research),
 * compare locally, and import the comparison here.
 *
 * The import only fills the research on screen. Facts, keywords and
 * suggestions are each ticked or not by the editor; nothing edits the look,
 * nothing is saved until Save research, and nothing is ever published.
 */

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9-]/g, "").slice(0, 36);
const DECISION_LABEL: Record<string, string> = {
  // "Supported", not "true": a primary source was cited by both tools. Open it before relying on it.
  verified: "Supported — both agree, primary source cited",
  "verified-contradiction": "Contradicted — both agree, primary source cited",
  unverified: "Not verified",
  disputed: "Disputed",
  "single-tool": "One tool only",
  "recommended-primary": "Both chose as primary",
  "agreed-supporting": "Both support",
  rejected: "Both rejected",
};
const PUTTABLE = new Set(["seoTitle", "seoDescription", "primaryKeyword"]);
const BYTE_LIMIT_KB = Math.round(MAX_FILE_BYTES / 1024);

type Preview = {
  data: Reconciled;
  facts: Record<string, boolean>;
  keywords: Record<string, { on: boolean; role: CandidateRole; checked: Record<number, boolean> }>;
  recs: Record<string, boolean>;
};

export function AiResearch({
  research,
  snapshot,
  reviewContext,
  review,
  today,
  formId,
}: {
  research: Research;
  snapshot: OutfitSnapshot;
  reviewContext: ReviewContext;
  review: Review;
  today: string;
  formId: string;
}) {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  // The fingerprint when the page opened: a later difference means unsaved edits.
  const [baseline, setBaseline] = useState<string | null>(null);
  const [typed, setTyped] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; list?: string[] } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const key = research.key;

  // The fingerprint of the look as the form holds it now — the same value the pack carries.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      // Only key, look and pieces enter the fingerprint; the rest is left empty here.
      const { fingerprint: value } = await buildResearchPack({ key, basis: "saved", generatedAt: "", look: snapshot, research: { candidates: [], serp: [] }, review: { readiness: review.readiness, blockers: [], recommendations: [] }, others: [], celebrities: [], occasions: [] });
      if (cancelled) return;
      setBaseline((current) => current ?? value);
      setFingerprint(value);
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key, snapshot, review.readiness]);

  // Any edit to the outfit form since the page opened.
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const edited = () => setTyped(true);
    form.addEventListener("input", edited);
    form.addEventListener("change", edited);
    return () => {
      form.removeEventListener("input", edited);
      form.removeEventListener("change", edited);
    };
  }, [formId]);

  const unsaved = typed || (baseline !== null && fingerprint !== null && fingerprint !== baseline);
  const basis: ResearchPack["basis"] = reviewContext.id === undefined ? "not-saved" : unsaved ? "unsaved-edits" : "saved";

  async function download() {
    if (!key) return;
    setBusy(true);
    try {
      const pack = await buildResearchPack({
        key,
        basis,
        generatedAt: new Date().toISOString().slice(0, 19) + "Z",
        look: snapshot,
        research: { candidates: research.candidates, serp: research.serp },
        review,
        others: reviewContext.others,
        celebrities: reviewContext.celebrities,
        occasions: reviewContext.occasions,
      });
      const name = `cp-research-${(pack.look.slug || key.replace(":", "-")).slice(0, 80)}.pack`;
      save(`${name}.json`, `${JSON.stringify(pack, null, 2)}\n`, "application/json");
      save(`${name}.md`, packMarkdown(pack), "text/markdown");
      setMessage({ kind: "ok", text: `Downloaded ${name}.json and ${name}.md (fingerprint ${pack.fingerprint.slice(0, 12)}…). Next: npm run seo:research -- init "<Downloads>\\${name}.json"` });
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setPreview(null);
    if (file.size > MAX_FILE_BYTES) return setMessage({ kind: "error", text: `That file is ${Math.round(file.size / 1024)} KB; the limit is ${BYTE_LIMIT_KB} KB. Nothing was imported.` });
    const parsed = parseJsonText(await file.text());
    if (!parsed.ok) return setMessage({ kind: "error", text: `${parsed.error} Nothing was imported.` });
    const checked = checkReconciled(parsed.value, { key, fingerprint });
    if (!checked.ok) return setMessage({ kind: "error", text: "This file cannot be imported:", list: checked.errors });
    const data = checked.value;
    setPreview({
      data,
      facts: Object.fromEntries(data.facts.map((f) => [f.id, f.preselected])),
      keywords: Object.fromEntries(data.keywords.map((k) => [k.id, { on: k.preselected, role: k.suggestedRole, checked: {} }])),
      recs: Object.fromEntries(data.recommendations.map((r) => [r.id, r.preselected])),
    });
  }

  function apply() {
    if (!preview) return;
    const { data } = preview;
    const notes: string[] = [];
    const existing = new Map(research.candidates.map((c) => [c.keyword, c]));
    const hasPrimary = research.candidates.some((c) => c.role === "primary");
    const added: Candidate[] = [];
    for (const k of data.keywords) {
      const choice = preview.keywords[k.id];
      if (!choice?.on) continue;
      if (existing.has(k.keyword)) {
        notes.push(`“${k.keyword}” is already in your research — kept as it was.`);
        continue;
      }
      if (research.candidates.length + added.length >= LIMITS.candidates) {
        notes.push(`“${k.keyword}” not added: the research holds at most ${LIMITS.candidates} candidates.`);
        continue;
      }
      let role = choice.role;
      if (role === "primary" && (hasPrimary || added.some((c) => c.role === "primary"))) {
        role = "secondary";
        notes.push(`“${k.keyword}” added as secondary: the research already has a primary keyword.`);
      }
      const evidence: Evidence[] = k.demand
        .filter((_, i) => choice.checked[i])
        .map((d) => ({
          id: newId(),
          source: "other" as const,
          value: d.value,
          period: d.period,
          market: d.market,
          collectedAt: d.collectedAt,
          url: d.url,
          note: `Reported by ${d.by === "claude" ? "Claude" : "Codex"} from ${d.sourceName}; source opened and checked by the editor on ${today}.`.slice(0, 500),
        }))
        .filter((e) => evidenceProblems(e, today).length === 0)
        .slice(0, LIMITS.evidence);
      const who = [k.claude ? `Claude: ${k.claude.role}` : "", k.codex ? `Codex: ${k.codex.role}` : ""].filter(Boolean).join(", ");
      added.push({ keyword: k.keyword, role, note: `AI research ${data.comparedFrom} (${who}). ${k.claude?.rationale ?? k.codex?.rationale ?? ""}`.slice(0, 500), evidence });
    }

    const accepted: AiReviewItem[] = [];
    const rejected: string[] = [];
    const urls = (list: { url: string }[]) => [...new Set(list.map((x) => x.url))].slice(0, LIMITS.aiSources);
    for (const f of data.facts) {
      if (preview.facts[f.id]) accepted.push({ id: f.id, kind: "fact", text: factLine(f).slice(0, LIMITS.aiText), decision: f.decision, sources: urls(f.sources) });
      else rejected.push(f.id);
    }
    for (const k of data.keywords) {
      if (preview.keywords[k.id]?.on) accepted.push({ id: k.id.slice(0, 90), kind: "keyword", text: k.keyword, decision: k.decision, sources: urls(k.demand) });
      else rejected.push(k.id.slice(0, 90));
    }
    for (const r of data.recommendations) {
      if (preview.recs[r.id]) accepted.push({ id: r.id, kind: "recommendation", text: `${r.issue} — ${r.fix}`.slice(0, LIMITS.aiText), decision: r.severity, ...(r.copy ? { field: r.copy.field, copy: r.copy.text } : {}), sources: urls(r.sources) });
      else rejected.push(r.id);
    }
    if (accepted.length > LIMITS.aiItems) notes.push(`Only the first ${LIMITS.aiItems} accepted items are recorded in the import history; the rest are still added above where they apply.`);
    const entry: AiReview = { importedAt: today, fingerprint: data.pack.fingerprint, comparedFrom: data.comparedFrom, accepted: accepted.slice(0, LIMITS.aiItems), rejected: rejected.slice(0, LIMITS.aiRejected) };
    const history = [...research.aiReviews, entry];
    if (history.length > LIMITS.aiReviews) notes.push(`Only the last ${LIMITS.aiReviews} imports are kept; the oldest record is dropped when you save.`);
    if (added.length) research.setCandidates((list) => [...list, ...added]);
    research.setAiReviews(() => history.slice(-LIMITS.aiReviews));
    setPreview(null);
    setMessage({
      kind: "ok",
      text: `Added to the research on screen: ${added.length} keyword(s), ${accepted.filter((a) => a.kind === "fact").length} fact(s), ${accepted.filter((a) => a.kind === "recommendation").length} suggestion(s). Nothing is saved until you press Save research — and the look itself is not changed.`,
      list: notes,
    });
  }

  const latest = research.aiReviews.at(-1);
  // Identical copy from both tools is shown once.
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return (latest?.accepted ?? []).filter((a) => a.kind === "recommendation" && a.copy && !seen.has(`${a.field}|${a.copy}`) && seen.add(`${a.field}|${a.copy}`));
  }, [latest]);

  return (
    <div className={s.block}>
      <h3 className={s.groupHead}>
        AI research <span>Claude Code + Codex, run by you, compared locally</span>
      </h3>
      <p className={s.muted}>
        Download this look as a research pack, run the prompts in <code>docs/seo-research</code> in your own Claude Code and Codex, then import the comparison. Imported findings only fill the research below; you tick what to keep, and Save research saves it. The look is never edited or published from here.
      </p>

      <div className={s.aiActions}>
        <button type="button" className={s.saveButton} disabled={!key || busy} onClick={download}>
          Download research pack
        </button>
        <button type="button" className={s.secondaryButton} disabled={!key || !fingerprint} onClick={() => fileInput.current?.click()}>
          Import findings…
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {!key ? <p className={s.muted}>Set a slug in the form first: research is matched to the look by it.</p> : null}
      {key && basis !== "saved" ? (
        <p className={s.warnLine} role="status">
          {basis === "not-saved" ? "This look is not saved yet: the pack describes the form as it is now." : "The form has unsaved edits: the pack will describe them, and findings can only be imported while the look still matches."}
        </p>
      ) : null}
      <details className={s.details}>
        <summary>What the pack contains, and what it never contains</summary>
        <p>
          <b>Included:</b> this look’s celebrity, event, date, occasions, slug and status; title, description and keywords; About text and FAQs; photo credit and alt text; each piece’s name, category, colours, brands, prices and product links (tracking and affiliate parameters removed); the research saved here; the content review; titles and keywords of <i>published</i> looks; hub names.
        </p>
        <p>
          <b>Never included:</b> affiliate links and networks, piece and editor ids, photo storage addresses, editor emails, other drafts, subscribers, clicks, price reports, requests, credentials. Sending the pack to Claude or Codex shares this unpublished look with Anthropic or OpenAI — only when you choose to.
        </p>
      </details>

      {message ? (
        <div className={message.kind === "error" ? s.errorBox : s.okBox} role={message.kind === "error" ? "alert" : "status"}>
          <strong>{message.text}</strong>
          {message.list?.length ? (
            <ul>
              {message.list.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {preview ? <ImportPreview preview={preview} setPreview={setPreview} onApply={apply} onCancel={() => setPreview(null)} /> : null}

      {research.aiReviews.length ? (
        <div className={s.aiHistory}>
          <span className={s.kicker}>Imported research ({research.aiReviews.length})</span>
          <ul>
            {[...research.aiReviews].reverse().map((r) => (
              <li key={`${r.fingerprint}-${r.importedAt}-${r.accepted.length}-${r.rejected.length}`}>
                {r.importedAt}: compared {r.comparedFrom} — accepted {r.accepted.length}, rejected {r.rejected.length}
                {r.fingerprint !== fingerprint ? " · made from an earlier version of the look" : ""}
              </li>
            ))}
          </ul>
          {latest?.accepted.some((a) => a.kind === "fact") ? (
            <details className={s.details}>
              <summary>Facts accepted in the latest import</summary>
              <ul>
                {latest.accepted
                  .filter((a) => a.kind === "fact")
                  .map((a) => (
                    <li key={a.id}>
                      {a.text} {a.sources.length ? <span className={s.muted}>({a.sources.length} source{a.sources.length === 1 ? "" : "s"})</span> : null}
                    </li>
                  ))}
              </ul>
            </details>
          ) : null}
          {suggestions.length ? (
            <div className={s.suggestions}>
              {suggestions.map((a) => (
                <SuggestionBox
                  key={a.id}
                  formId={formId}
                  suggestion={{ label: `${a.id} · ${a.field}`, text: a.copy!, ...(a.field && PUTTABLE.has(a.field) ? { field: a.field as "seoTitle" | "seoDescription" | "primaryKeyword" } : {}) }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function factLine(f: ReconciledFact) {
  const corrected = f.claude?.correctedValue ?? f.codex?.correctedValue;
  return `${f.id}: ${f.statement}${f.decision === "verified-contradiction" && corrected ? ` → sources show: ${corrected}` : ""}`;
}

function ImportPreview({
  preview,
  setPreview,
  onApply,
  onCancel,
}: {
  preview: Preview;
  setPreview: (fn: (p: Preview | null) => Preview | null) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const { data } = preview;
  const s2 = data.summary;
  const toggle = (group: "facts" | "recs", id: string) => setPreview((p) => (p ? { ...p, [group]: { ...p[group], [id]: !p[group][id] } } : p));
  const setKeyword = (id: string, change: Partial<Preview["keywords"][string]>) =>
    setPreview((p) => (p ? { ...p, keywords: { ...p.keywords, [id]: { ...p.keywords[id], ...change } } } : p));
  const chosen = Object.values(preview.facts).filter(Boolean).length + Object.values(preview.keywords).filter((k) => k.on).length + Object.values(preview.recs).filter(Boolean).length;

  return (
    <div className={s.preview} role="region" aria-label="Review imported findings">
      <h4>Review before adding — compared {data.comparedFrom}</h4>
      {s2.warnings.map((w) => (
        <p key={w} className={s.warnLine}>{w}</p>
      ))}
      <ul className={s.summaryList}>
        <li>
          <b>Primary keyword:</b> {s2.primaryKeyword.keyword ? `“${s2.primaryKeyword.keyword}”` : "none agreed"} — {s2.primaryKeyword.status}
        </li>
        <li>
          <b>Search intent:</b> {s2.intent.agreed ? s2.intent.claude : `Claude ${s2.intent.claude} / Codex ${s2.intent.codex}`}
        </li>
        <li>
          <b>Demand:</b> {s2.demand.length ? s2.demand.map((d) => `“${d.keyword}”: ${d.status}`).join(" · ") : "unknown"}
        </li>
        <li>
          <b>Ready for human publication review:</b> {s2.readyForReview.ready ? "yes" : `not yet — ${s2.readyForReview.reasons.join("; ")}`}
        </li>
      </ul>
      <p className={s.muted}>Pre-ticked: only items both tools agree on with a primary source (facts), that both propose and that fit the look (keywords), or that both raise and the challenge did not dispute (suggestions). Agreement between two AIs is not proof — check before you keep anything.</p>

      <h5>Facts ({data.facts.length})</h5>
      <ul className={s.pickList}>
        {data.facts.map((f) => (
          <li key={f.id} data-decision={f.decision}>
            <label>
              <input type="checkbox" checked={Boolean(preview.facts[f.id])} onChange={() => toggle("facts", f.id)} />
              <span>
                <b>{f.id}</b> {f.statement}
              </span>
            </label>
            <small>
              {DECISION_LABEL[f.decision]} · grade {f.grade} · Claude {f.claude?.status ?? "—"} · Codex {f.codex?.status ?? "—"}
              {f.challenge ? ` · challenge: ${f.challenge.verdict}` : ""}
            </small>
            {f.claude?.correctedValue || f.codex?.correctedValue ? <small className={s.bad}>Sources show: {f.claude?.correctedValue ?? f.codex?.correctedValue}</small> : null}
            <Sources list={f.sources} />
          </li>
        ))}
      </ul>

      <h5>Keywords ({data.keywords.length})</h5>
      <ul className={s.pickList}>
        {data.keywords.map((k: ReconciledKeyword) => {
          const choice = preview.keywords[k.id];
          return (
            <li key={k.id} data-decision={k.decision}>
              <label>
                <input type="checkbox" checked={choice.on} onChange={() => setKeyword(k.id, { on: !choice.on })} />
                <span>
                  <b>“{k.keyword}”</b> — {DECISION_LABEL[k.decision]}
                </span>
              </label>
              <small>
                Claude {k.claude?.role ?? "—"} · Codex {k.codex?.role ?? "—"}
                {k.challenge ? ` · challenge: ${k.challenge.verdict}` : ""}
                {[...k.mismatches, ...k.overlaps].length ? ` · ${[...k.mismatches, ...k.overlaps].join("; ")}` : ""}
              </small>
              <div className={s.inlineRow}>
                <label>
                  Add as{" "}
                  <select value={choice.role} onChange={(e) => setKeyword(k.id, { role: e.target.value as CandidateRole })}>
                    <option value="primary">primary</option>
                    <option value="secondary">secondary</option>
                    <option value="related">related</option>
                  </select>
                </label>
              </div>
              {k.demand.length ? (
                k.demand.map((d, i) => (
                  <label key={`${d.url}-${i}`} className={s.demandCheck}>
                    <input type="checkbox" checked={Boolean(choice.checked[i])} onChange={() => setKeyword(k.id, { checked: { ...choice.checked, [i]: !choice.checked[i] } })} />
                    <span>
                      {d.by === "claude" ? "Claude" : "Codex"} reports {d.value} ({d.period}, {d.market}) from {d.sourceName}, {d.collectedAt}:{" "}
                      <a href={d.url} target="_blank" rel="noreferrer noopener">
                        open source ↗
                      </a>{" "}
                      — tick only after you have opened it and seen this figure. Recorded as “other”, low confidence.
                    </span>
                  </label>
                ))
              ) : (
                <small className={s.unknown}>Demand: unknown — no evidence (not zero)</small>
              )}
            </li>
          );
        })}
      </ul>

      <h5>Suggestions ({data.recommendations.length})</h5>
      <ul className={s.pickList}>
        {data.recommendations.map((r: ReconciledRecommendation) => (
          <li key={r.id}>
            <label>
              <input type="checkbox" checked={Boolean(preview.recs[r.id])} onChange={() => toggle("recs", r.id)} />
              <span>
                <b>{r.id}</b> [{r.severity}, {r.area}] {r.issue}
              </span>
            </label>
            <small>Fix: {r.fix}</small>
            {r.copy ? <code className={s.copyText}>{r.copy.text}</code> : null}
            <small>
              {r.bothRaisedArea ? "Both tools raised this area" : "One tool only"}
              {r.challenge ? ` · challenge: ${r.challenge.verdict} — ${r.challenge.reason}` : ""}
            </small>
            {r.flags.length ? <small className={s.bad}>{r.flags.join(" · ")}</small> : null}
            <Sources list={r.sources} />
          </li>
        ))}
      </ul>

      {data.gaps.length ? (
        <details className={s.details}>
          <summary>Gaps the tools reported ({data.gaps.length})</summary>
          <ul>
            {data.gaps.map((g, i) => (
              <li key={i}>
                {g.by} · {g.area}: {g.note}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className={s.aiActions}>
        <button type="button" className={s.saveButton} onClick={onApply}>
          Add {chosen} selected to research
        </button>
        <button type="button" className={s.linkButton} onClick={onCancel}>
          Cancel — import nothing
        </button>
      </div>
    </div>
  );
}

function Sources({ list }: { list: { url: string; by: string; kind: string; accessedAt: string }[] }) {
  if (!list.length) return <small className={s.muted}>No sources cited.</small>;
  return (
    <small className={s.sourceList}>
      {list.slice(0, 6).map((src, i) => (
        <a key={`${src.url}-${i}`} href={src.url} target="_blank" rel="noreferrer noopener" title={`${src.by}, ${src.kind}, accessed ${src.accessedAt}`}>
          {src.kind === "primary" ? "● " : "○ "}
          {hostname(src.url)}
        </a>
      ))}
    </small>
  );
}

const hostname = (raw: string) => {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
};
