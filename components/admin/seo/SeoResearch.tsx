"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { attachPreparedSeoReview, loadSeoReview, saveSeoReview } from "@/app/admin/(panel)/outfits/seo-review-actions";
import { useAdminSession } from "@/components/admin/session/AdminSession";
import { AREA_LABEL, type Finding, type Suggestion } from "@/lib/seo-review/audit";
import { EVIDENCE_SOURCES, SOURCE_INFO, demandSummary, evidenceProblems, type Evidence, type EvidenceSource } from "@/lib/seo-review/evidence";
import { analyseKeyword, buildReview, READINESS_DISCLAIMER } from "@/lib/seo-review/review";
import type { SeoSiteContext } from "@/lib/seo-review/site-context";
import {
  CANDIDATE_ROLES,
  SERP_FEATURES,
  SERP_MATCH,
  SERP_RESULT_LABEL,
  SERP_RESULT_TYPES,
  reviewKey,
  serpObservations,
  type Candidate,
  type CandidateRole,
  type AiReview,
  type SeoReviewDoc,
  type SerpReview,
} from "@/lib/seo-review/store";
import { AiResearch } from "./AiResearch";
import { fillField, useOutfitSeo } from "./OutfitSeoContext";
import s from "./research.module.css";

/** Today in India, where the archive is written: evidence dates are compared with it. */
const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9-]/g, "").slice(0, 36);

const NO_EVIDENCE: Evidence[] = [];
const ROLE_LABEL: Record<CandidateRole, string> = { primary: "Primary", secondary: "Secondary", related: "Related", rejected: "Rejected" };
const STATUS_ICON = { match: "✓", partial: "◐", absent: "–", mismatch: "✕" } as const;

type SaveState = { kind: "idle" | "loading" | "saving" | "saved" | "error"; message?: string; errors?: string[] };

/**
 * The SEO research and review panel under the outfit form.
 *
 * Content review reads the form live, exactly like the checklist beside it.
 * Keyword research is saved separately (`seoReviews`) with its own button:
 * it never changes the look, never saves the outfit form, and never publishes.
 * Suggestions are copied or put into a field only when the editor clicks.
 */
export function SeoResearch({ context }: { context: SeoSiteContext }) {
  const { snapshot, owners, outfitId, formId } = useOutfitSeo();
  const [tab, setTab] = useState<"review" | "keywords">("review");
  const today = useMemo(() => istToday(), []);

  const reviewContext = useMemo(
    () => ({ id: outfitId, owners, others: context.others, celebrities: context.celebrities, occasions: context.occasions, saved: context.saved, today }),
    [outfitId, owners, context, today],
  );

  const research = useResearch(outfitId, snapshot?.slug ?? "", context.saved?.slug);
  const primaryKeyword = snapshot?.primaryKeyword?.trim().toLowerCase() ?? "";
  const primaryEvidence = research.candidates.find((c) => c.keyword === primaryKeyword)?.evidence ?? NO_EVIDENCE;
  const review = useMemo(() => (snapshot ? buildReview(snapshot, reviewContext, primaryEvidence) : null), [snapshot, reviewContext, primaryEvidence]);

  if (!snapshot || !review) return <section className={s.research} aria-busy="true" />;

  return (
    <section className={s.research} id="seo-research" aria-labelledby="seo-research-heading">
      <header className={s.head}>
        <h2 id="seo-research-heading">SEO research and review</h2>
        <p>Advice only. Nothing here edits the look, saves the form or publishes — every change is yours to make.</p>
      </header>

      <div className={s.summary}>
        <div className={s.card}>
          <span className={s.kicker}>Content readiness</span>
          <strong className={s.big}>{review.readiness.percent}%</strong>
          <span>
            {review.readiness.passed} of {review.readiness.total} checks pass
            {review.readiness.blockers ? (
              <b className={s.bad}> · {review.readiness.blockers} blocking publication</b>
            ) : (
              <b className={s.good}> · nothing blocks publishing</b>
            )}
          </span>
          <small className={s.disclaimer}>{READINESS_DISCLAIMER}</small>
        </div>
        <div className={s.card}>
          <span className={s.kicker}>Keyword demand evidence</span>
          {review.primary ? (
            <>
              <strong className={s.keyword}>“{review.primary.keyword}”</strong>
              <DemandLine summary={review.primary.demand} />
            </>
          ) : (
            <span>No primary keyword yet. Research candidates in the Keyword research tab.</span>
          )}
          <small className={s.disclaimer}>Recorded observations only, with their sources. No volume, difficulty or traffic is estimated.</small>
        </div>
      </div>

      <div className={s.tabs} role="tablist" aria-label="SEO panel sections">
        <button type="button" role="tab" aria-selected={tab === "review"} onClick={() => setTab("review")}>
          Content review <span>{review.blockers.length + review.recommendations.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "keywords"} onClick={() => setTab("keywords")}>
          Keyword research <span>{research.candidates.length}</span>
        </button>
      </div>

      {tab === "review" ? (
        <ContentReview review={review} formId={formId} />
      ) : (
        <KeywordResearch
          research={research}
          review={review}
          snapshot={snapshot}
          reviewContext={reviewContext}
          formId={formId}
          today={today}
        />
      )}
    </section>
  );
}

// ------------------------------------------------------------------ research state

type Offer = { slug: string; review: SeoReviewDoc };

/**
 * The research for this look and where it is stored.
 *
 * A saved look's research is keyed by its id; a look not saved yet keeps it
 * under its intended slug. A revision belongs to the key it was loaded from,
 * so if the slug changes after editing has begun, the save goes to the new key
 * as a first save — which the server refuses if research is already there,
 * rather than overwriting another draft's.
 *
 * Research prepared under a slug is never attached to a saved look silently:
 * the look's edit page offers it (matched on the look's *saved* slug) and the
 * editor decides.
 */
function useResearch(outfitId: number | undefined, slug: string, savedSlug: string | undefined) {
  const { ensureSignedIn } = useAdminSession();
  const key = reviewKey(outfitId, slug);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [serp, setSerp] = useState<SerpReview[]>([]);
  const [aiReviews, setAiReviews] = useState<AiReview[]>([]);
  const [loaded, setLoaded] = useState<{ key: string; revision: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [offer, setOffer] = useState<Offer | null>(null);

  // Editing waits until the saved research for this key is on screen, so a
  // late load can never replace what was typed (and vice versa).
  const loading = Boolean(key) && loaded?.key !== key && !dirty && state.kind !== "error";

  // Load when the key settles (a prepared look's slug may still be being typed).
  useEffect(() => {
    if (!key || loaded?.key === key || dirty) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let result = await loadSeoReview(key);
      if (!result.ok && result.sessionExpired && (await ensureSignedIn({ force: true }))) result = await loadSeoReview(key);
      if (cancelled) return;
      if (!result.ok) return setState({ kind: "error", message: `Saved research could not be loaded: ${result.error}` });
      const doc = result.review;
      let found: Offer | null = null;
      if (!doc && outfitId !== undefined && savedSlug) {
        const prepared = await loadSeoReview(`prepared:${savedSlug}`);
        if (cancelled) return;
        if (prepared.ok && prepared.review) found = { slug: savedSlug, review: prepared.review };
      }
      setCandidates(doc?.candidates ?? []);
      setSerp(doc?.serp ?? []);
      setAiReviews(doc?.aiReviews ?? []);
      setLoaded({ key, revision: doc?.revision ?? 0 });
      setOffer(found);
      setState({ kind: "idle", message: doc ? "Saved research loaded." : undefined });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key, loaded, dirty, outfitId, savedSlug, ensureSignedIn]);

  // Unsaved research is not part of the outfit form, so it needs its own warning.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const change = useCallback(<T,>(set: (fn: (v: T) => T) => void) => (fn: (v: T) => T) => {
    set(fn);
    setDirty(true);
  }, []);

  /** Research was loaded for a different slug than the one the save will use. */
  const movedFrom = dirty && loaded && key && loaded.key !== key ? loaded.key : null;

  const save = useCallback(async () => {
    if (!key) return;
    setState({ kind: "saving" });
    const payload = { key, revision: loaded?.key === key ? loaded.revision : 0, candidates, serp, aiReviews };
    let result = await saveSeoReview(payload);
    if (!result.ok && result.sessionExpired && (await ensureSignedIn({ force: true }))) result = await saveSeoReview(payload);
    if (!result.ok) return setState({ kind: "error", message: result.error, errors: result.errors });
    setLoaded({ key, revision: result.review.revision });
    setDirty(false);
    setOffer(null);
    setState({ kind: "saved", message: `Saved ${new Date(result.review.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.` });
  }, [key, loaded, candidates, serp, aiReviews, ensureSignedIn]);

  const attach = useCallback(async () => {
    if (!offer || outfitId === undefined || dirty) return;
    setState({ kind: "saving" });
    const call = () => attachPreparedSeoReview(outfitId, offer.slug, offer.review.revision);
    let result = await call();
    if (!result.ok && result.sessionExpired && (await ensureSignedIn({ force: true }))) result = await call();
    if (!result.ok) return setState({ kind: "error", message: result.error });
    setCandidates(result.review.candidates);
    setSerp(result.review.serp);
    setAiReviews(result.review.aiReviews ?? []);
    setLoaded({ key: result.review.key, revision: result.review.revision });
    setOffer(null);
    setState({ kind: "saved", message: `Attached research prepared under “${offer.slug}”.` });
  }, [offer, outfitId, dirty, ensureSignedIn]);

  const reload = useCallback(() => {
    setDirty(false);
    setLoaded(null);
    setState({ kind: "idle" });
  }, []);

  return {
    key,
    candidates,
    serp,
    dirty,
    loading,
    movedFrom,
    state,
    offer,
    aiReviews,
    setCandidates: change<Candidate[]>(setCandidates),
    setAiReviews: change<AiReview[]>(setAiReviews),
    setSerp: change<SerpReview[]>(setSerp),
    save,
    attach,
    dismissOffer: () => setOffer(null),
    reload,
  };
}

export type Research = ReturnType<typeof useResearch>;
type ReviewData = ReturnType<typeof buildReview>;

// ------------------------------------------------------------------ content review

function ContentReview({ review, formId }: { review: ReviewData; formId: string }) {
  const bySeverity = (severity: Finding["severity"]) => review.recommendations.filter((f) => f.severity === severity);
  return (
    <div className={s.panel} role="tabpanel">
      <h3 className={s.groupHead}>
        Technical blockers <span>must pass before a new look can be published</span>
      </h3>
      {review.blockers.length ? (
        <ul className={s.findings}>
          {review.blockers.map((f) => (
            <FindingCard key={f.id} finding={f} formId={formId} />
          ))}
        </ul>
      ) : (
        <p className={s.empty}>None. The checklist allows publishing — whether to publish is still your decision.</p>
      )}

      <h3 className={s.groupHead}>
        Editorial recommendations <span>never block publishing</span>
      </h3>
      {review.recommendations.length ? (
        (["high", "medium", "low"] as const).map((severity) =>
          bySeverity(severity).length ? (
            <div key={severity}>
              <h4 className={s.severityHead} data-severity={severity}>
                {severity === "high" ? "High" : severity === "medium" ? "Medium" : "Low"} priority · {bySeverity(severity).length}
              </h4>
              <ul className={s.findings}>
                {bySeverity(severity).map((f) => (
                  <FindingCard key={f.id} finding={f} formId={formId} />
                ))}
              </ul>
            </div>
          ) : null,
        )
      ) : (
        <p className={s.empty}>No recommendations.</p>
      )}

      <details className={s.passed}>
        <summary>Passing checks ({review.passed.length})</summary>
        <ul>
          {review.passed.map((f) => (
            <li key={f.id}>
              <span className={s.good}>✓</span> {f.title} <small>{AREA_LABEL[f.area]}</small>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function FindingCard({ finding, formId }: { finding: Finding; formId: string }) {
  return (
    <li className={s.finding} data-severity={finding.kind === "blocker" ? "blocker" : finding.severity}>
      <div className={s.findingHead}>
        <strong>{finding.title}</strong>
        <span className={s.area}>{AREA_LABEL[finding.area]}</span>
      </div>
      <p>{finding.explanation}</p>
      {finding.fix ? (
        <p className={s.fix}>
          <b>Fix:</b> {finding.fix}
        </p>
      ) : null}
      {finding.suggestions?.map((suggestion, i) => (
        <SuggestionBox key={`${suggestion.label}-${i}`} suggestion={suggestion} formId={formId} />
      ))}
    </li>
  );
}

export function SuggestionBox({ suggestion, formId }: { suggestion: Suggestion; formId: string }) {
  const [copied, setCopied] = useState(false);
  const [placed, setPlaced] = useState(false);
  return (
    <div className={s.suggestion}>
      <span className={s.kicker}>{suggestion.label}</span>
      <code>{suggestion.text}</code>
      <div className={s.actions}>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(suggestion.text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {suggestion.field ? (
          <button
            type="button"
            title="Puts the text in the form field. Nothing is saved until you save the look."
            onClick={() => {
              fillField(formId, suggestion.field!, suggestion.text);
              setPlaced(true);
            }}
          >
            {placed ? "In the field — not saved yet" : "Put in the field"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DemandLine({ summary }: { summary: ReturnType<typeof demandSummary> }) {
  return summary.status === "none" ? (
    <span className={s.unknown}>Unknown — no evidence recorded (not zero)</span>
  ) : (
    <span>
      <b className={s[`conf_${summary.strongest}`]}>{summary.strongest} confidence</b> · {summary.statement}
    </span>
  );
}

// ------------------------------------------------------------------ keyword research

function KeywordResearch({
  research,
  review,
  snapshot,
  reviewContext,
  formId,
  today,
}: {
  research: Research;
  review: ReviewData;
  snapshot: NonNullable<ReturnType<typeof useOutfitSeo>["snapshot"]>;
  reviewContext: Parameters<typeof buildReview>[1];
  formId: string;
  today: string;
}) {
  const [draft, setDraft] = useState("");
  const existing = new Set(research.candidates.map((c) => c.keyword));
  const addCandidate = (keyword: string) => {
    const clean = keyword.trim().toLowerCase().replace(/\s+/g, " ");
    if (!clean || existing.has(clean)) return;
    research.setCandidates((list) => [...list, { keyword: clean, role: list.length ? "related" : "primary", evidence: [] }]);
  };
  const primary = review.primary;

  return (
    <div className={s.panel} role="tabpanel">
      <ResearchStatus research={research} />
      <AiResearch research={research} snapshot={snapshot} reviewContext={reviewContext} review={review} today={today} formId={formId} />
      <fieldset className={s.lock} disabled={research.loading || research.state.kind === "saving"} aria-busy={research.loading}>
      {primary ? (
        <div className={s.block}>
          <h3 className={s.groupHead}>
            Current primary keyword <span>“{primary.keyword}”</span>
          </h3>
          <KeywordAnalysis analysis={primary} />
          {!existing.has(primary.keyword) ? (
            <button type="button" className={s.linkButton} onClick={() => addCandidate(primary.keyword)}>
              + Add it to the candidates to record evidence
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={s.block}>
        <h3 className={s.groupHead}>
          Candidate keywords <span>research each before choosing</span>
        </h3>
        {review.ideas.length ? (
          <div className={s.ideas}>
            <span className={s.kicker}>Ideas from this look’s own details — no demand data</span>
            {review.ideas.map((idea) => (
              <button key={idea} type="button" disabled={existing.has(idea)} onClick={() => addCandidate(idea)}>
                + {idea}
              </button>
            ))}
          </div>
        ) : null}
        <div className={s.addRow}>
          <input
            aria-label="New candidate keyword"
            value={draft}
            placeholder="Type a candidate keyword, e.g. rukmini vasanth black dress"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCandidate(draft);
                setDraft("");
              }
            }}
          />
          <button type="button" onClick={() => (addCandidate(draft), setDraft(""))}>
            Add candidate
          </button>
        </div>
        {research.candidates.length ? (
          <ul className={s.candidates}>
            {research.candidates.map((candidate, index) => (
              <CandidateCard
                key={candidate.keyword}
                candidate={candidate}
                analysis={analyseKeyword(candidate.keyword, snapshot, reviewContext, candidate.evidence)}
                isPrimaryInForm={candidate.keyword === primary?.keyword}
                today={today}
                onChange={(next) => research.setCandidates((list) => list.map((c, i) => (i === index ? next : next.role === "primary" && c.role === "primary" ? { ...c, role: "secondary" } : c)))}
                onRemove={() => research.setCandidates((list) => list.filter((_, i) => i !== index))}
                onUse={() => fillField(formId, "primaryKeyword", candidate.keyword)}
              />
            ))}
          </ul>
        ) : (
          <p className={s.empty}>No candidates yet. Add a few, then record what you find for each.</p>
        )}
      </div>

      <SerpReviews research={research} keywords={[...new Set([primary?.keyword, ...research.candidates.map((c) => c.keyword)].filter((k): k is string => Boolean(k)))]} today={today} />

      <div className={s.saveBar}>
        <button type="button" className={s.saveButton} disabled={!research.key || research.state.kind === "saving" || !research.dirty} onClick={research.save}>
          {research.state.kind === "saving" ? "Saving…" : "Save research"}
        </button>
        <span className={s.saveNote} aria-live="polite">
          {!research.key
            ? "Set a slug in the form to save research for a look that is not saved yet."
            : research.loading
              ? "Loading saved research…"
              : research.dirty
                ? research.movedFrom
                  ? `Unsaved research changes. The slug changed since this research was loaded; saving stores it under “${research.key.replace(/^prepared:/, "")}” (refused if research is already saved there). Research under “${research.movedFrom.replace(/^prepared:/, "")}” stays as it was.`
                  : "Unsaved research changes — leaving the page will ask first."
                : research.state.message ?? (research.key.startsWith("prepared:") ? `Nothing saved yet for the slug “${research.key.slice(9)}”.` : "Nothing saved yet for this look.")}
          {" "}Saved separately from the look: it does not save the outfit or publish anything.
        </span>
        {research.state.kind === "error" ? (
          <div className={s.errorBox} role="alert">
            <strong>{research.state.message}</strong>
            {research.state.errors?.length ? (
              <ul>
                {research.state.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              className={s.linkButton}
              onClick={() => {
                if (!research.dirty || window.confirm("Discard the research changes on screen and load what is saved?")) research.reload();
              }}
            >
              {research.dirty ? "Discard my changes and reload saved research" : "Reload saved research"}
            </button>
          </div>
        ) : null}
      </div>
      </fieldset>
    </div>
  );
}

/** Loading, and research prepared under this look's slug before it was saved — offered, never applied silently. */
function ResearchStatus({ research }: { research: Research }) {
  if (research.loading) return <p className={s.statusLine} role="status">Loading saved research…</p>;
  const offer = research.offer;
  if (!offer) return null;
  const keywords = offer.review.candidates.map((c) => c.keyword);
  return (
    <div className={s.offer} role="region" aria-label="Research prepared under this slug">
      <strong>Research was prepared under the slug “{offer.slug}” before this look was saved.</strong>
      <p>
        {keywords.length} candidate keyword{keywords.length === 1 ? "" : "s"}
        {keywords.length ? `: ${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? "…" : ""}` : ""}
        {offer.review.serp.length ? ` · ${offer.review.serp.length} result-page review${offer.review.serp.length === 1 ? "" : "s"}` : ""}
        {" "}· last saved {offer.review.updatedAt.slice(0, 10)}.
      </p>
      <p>Attach it only if it was researched for this look. Attaching moves it here; it is not copied to any other look.</p>
      <div className={s.offerActions}>
        <button type="button" className={s.saveButton} disabled={research.dirty || research.state.kind === "saving"} onClick={research.attach}>
          Attach to this look
        </button>
        <button type="button" className={s.linkButton} onClick={research.dismissOffer}>
          Not for this look
        </button>
      </div>
      {research.dirty ? <small>You have unsaved research here; save or reload it before attaching.</small> : null}
    </div>
  );
}

function KeywordAnalysis({ analysis }: { analysis: ReturnType<typeof analyseKeyword> }) {
  const facets = [
    ["Celebrity", analysis.relevance.celebrity],
    ["Garment", analysis.relevance.garment],
    ["Colour", analysis.relevance.colour],
    ["Brand", analysis.relevance.brand],
    ["Occasion", analysis.relevance.occasion],
  ] as const;
  return (
    <div className={s.analysis}>
      <p>
        <span className={s.intent} data-fits={analysis.intent.fitsPage}>
          {analysis.intent.label}
        </span>{" "}
        {analysis.intent.explanation}
        {analysis.intent.signals.length ? <small> Signals: {analysis.intent.signals.join(", ")}.</small> : null}
      </p>
      <ul className={s.facets}>
        {facets.map(([label, facet]) => (
          <li key={label} data-status={facet.status}>
            <i aria-hidden="true">{STATUS_ICON[facet.status]}</i>
            <b>{label}</b> {facet.detail}
          </li>
        ))}
      </ul>
      {analysis.overlaps.length ? (
        <div className={s.overlaps}>
          <b>Overlaps with other looks</b>
          <ul>
            {analysis.overlaps.map((o) => (
              <li key={`${o.id}-${o.kind}`}>
                {o.kind === "same-keyword" ? "Same keyword" : o.kind === "similar-keyword" ? "Similar keyword" : "Title already covers it"}: “{o.title}” — /outfits/{o.slug} {o.published ? "(live)" : "(draft)"}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={s.muted}>No other look targets this or a very similar keyword.</p>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  analysis,
  isPrimaryInForm,
  today,
  onChange,
  onRemove,
  onUse,
}: {
  candidate: Candidate;
  analysis: ReturnType<typeof analyseKeyword>;
  isPrimaryInForm: boolean;
  today: string;
  onChange: (next: Candidate) => void;
  onRemove: () => void;
  onUse: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className={s.candidate} data-role={candidate.role}>
      <div className={s.candidateHead}>
        <button type="button" className={s.disclose} aria-expanded={open} onClick={() => setOpen(!open)}>
          <span aria-hidden="true">{open ? "▾" : "▸"}</span> <strong>{candidate.keyword}</strong>
        </button>
        <span className={s.intent} data-fits={analysis.intent.fitsPage}>
          {analysis.intent.label}
        </span>
        {analysis.relevance.mismatches.length ? <span className={s.badTag}>doesn’t match the look</span> : null}
        {analysis.overlaps.some((o) => o.kind !== "similar-title") ? <span className={s.warnTag}>overlap</span> : null}
        <select aria-label={`Role of ${candidate.keyword}`} value={candidate.role} onChange={(e) => onChange({ ...candidate, role: e.target.value as CandidateRole })}>
          {CANDIDATE_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>
      </div>
      <p className={s.demand}>
        <DemandLine summary={analysis.demand} />
      </p>
      {open ? (
        <div className={s.candidateBody}>
          <KeywordAnalysis analysis={analysis} />
          <EvidenceTable candidate={candidate} today={today} onChange={onChange} />
          <label className={s.noteField}>
            Notes
            <textarea
              rows={2}
              maxLength={500}
              value={candidate.note ?? ""}
              placeholder="Why this keyword, or why not."
              onChange={(e) => onChange({ ...candidate, note: e.target.value })}
            />
          </label>
          <div className={s.actions}>
            <a href={`https://www.google.com/search?${new URLSearchParams({ q: candidate.keyword, gl: "in", hl: "en" })}`} target="_blank" rel="noreferrer">
              Search Google yourself ↗
            </a>
            <a href={`https://trends.google.com/trends/explore?${new URLSearchParams({ geo: "IN", q: candidate.keyword })}`} target="_blank" rel="noreferrer">
              Google Trends ↗
            </a>
            <button type="button" disabled={isPrimaryInForm} onClick={onUse} title="Puts it in the Primary keyword field. Nothing is saved until you save the look.">
              {isPrimaryInForm ? "Is the primary keyword in the form" : "Use as primary keyword"}
            </button>
            <button type="button" className={s.danger} onClick={onRemove}>
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

const blankEvidence = (today: string): Evidence => ({ id: newId(), source: "keyword-planner", value: "", period: "last 12 months", market: "IN", collectedAt: today });

function EvidenceTable({ candidate, today, onChange }: { candidate: Candidate; today: string; onChange: (next: Candidate) => void }) {
  const [draft, setDraft] = useState<Evidence>(() => blankEvidence(today));
  const [tried, setTried] = useState(false);
  const problems = evidenceProblems(draft, today);
  const info = SOURCE_INFO[draft.source];
  const summary = demandSummary(candidate.evidence, today);
  const confidence = new Map(summary.status === "evidence" ? summary.items.map((i) => [i.id, i]) : []);
  return (
    <div className={s.evidence}>
      <b>Demand evidence</b>
      {candidate.evidence.length ? (
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Value</th>
                <th>Period</th>
                <th>Market</th>
                <th>Looked up</th>
                <th>Confidence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidate.evidence.map((e) => {
                const c = confidence.get(e.id);
                return (
                  <tr key={e.id}>
                    <td data-label="Source">{e.url ? <a href={e.url} target="_blank" rel="noreferrer">{SOURCE_INFO[e.source].label} ↗</a> : SOURCE_INFO[e.source].label}</td>
                    <td data-label="Value">
                      {e.value} <small>{SOURCE_INFO[e.source].unit}</small>
                    </td>
                    <td data-label="Period">{e.period}</td>
                    <td data-label="Market">{e.market}</td>
                    <td data-label="Looked up">{e.collectedAt}</td>
                    <td data-label="Confidence" title={c?.reasons.join(" ")}>{c ? <span className={s[`conf_${c.confidence}`]}>{c.confidence}</span> : <span className={s.bad}>invalid</span>}</td>
                    <td data-label="">
                      <button type="button" className={s.danger} aria-label="Remove this evidence" onClick={() => onChange({ ...candidate, evidence: candidate.evidence.filter((x) => x.id !== e.id) })}>
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={s.unknown}>No evidence recorded. Demand is unknown — not zero.</p>
      )}

      <fieldset className={s.addEvidence}>
        <legend>Record what you found</legend>
        <label>
          Source
          <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as EvidenceSource, value: "" })}>
            {EVIDENCE_SOURCES.map((source) => (
              <option key={source} value={source}>
                {SOURCE_INFO[source].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Value <small>({info.unit})</small>
          <input value={draft.value} placeholder={info.example} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
        </label>
        <label>
          Period
          <input value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} />
        </label>
        <label>
          Market
          <input value={draft.market} maxLength={6} onChange={(e) => setDraft({ ...draft, market: e.target.value.toUpperCase() })} />
        </label>
        <label>
          Looked up on
          <input type="date" value={draft.collectedAt} max={today} onChange={(e) => setDraft({ ...draft, collectedAt: e.target.value })} />
        </label>
        <label className={s.wideLabel}>
          Link to re-check {draft.source === "other" ? "(required)" : "(optional)"}
          <input type="url" value={draft.url ?? ""} placeholder="https://…" onChange={(e) => setDraft({ ...draft, url: e.target.value || undefined })} />
        </label>
        <p className={s.caveat}>{info.caveat}</p>
        {tried && problems.length ? (
          <ul className={s.problems}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (problems.length) return;
            onChange({ ...candidate, evidence: [...candidate.evidence, { ...draft, value: draft.value.trim(), market: draft.market.trim().toUpperCase() }] });
            setDraft(blankEvidence(today));
            setTried(false);
          }}
        >
          Add evidence
        </button>
      </fieldset>
    </div>
  );
}

// ------------------------------------------------------------------ manual result-page reviews

const blankSerp = (keyword: string, today: string): SerpReview => ({
  keyword,
  checkedAt: today,
  market: "IN",
  device: "mobile",
  results: Array.from({ length: 5 }, (_, i) => ({ position: i + 1, domain: "", type: "other" as const, match: "different" as const })),
  features: [],
});

function SerpReviews({ research, keywords, today }: { research: Research; keywords: string[]; today: string }) {
  const [editing, setEditing] = useState<number | null>(null);
  const update = (index: number, next: SerpReview) => research.setSerp((list) => list.map((r, i) => (i === index ? next : r)));
  return (
    <div className={s.block}>
      <h3 className={s.groupHead}>
        Result-page review <span>what Google shows today, checked by you</span>
      </h3>
      <p className={s.muted}>
        Search the keyword yourself (signed out, India, phone if you can) and record the top results. Nothing is fetched from Google automatically.
      </p>
      {research.serp.map((review, index) => (
        <div key={index} className={s.serp}>
          <div className={s.candidateHead}>
            <strong>“{review.keyword || "—"}”</strong>
            <span className={s.muted}>
              {review.checkedAt} · {review.market} · {review.device}
            </span>
            <button type="button" onClick={() => setEditing(editing === index ? null : index)}>
              {editing === index ? "Done" : "Edit"}
            </button>
            <button type="button" className={s.danger} onClick={() => research.setSerp((list) => list.filter((_, i) => i !== index))}>
              Remove
            </button>
          </div>
          <ul className={s.observations}>
            {serpObservations({ ...review, results: review.results.filter((r) => r.domain) }).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {editing === index ? <SerpEditor review={review} keywords={keywords} today={today} onChange={(next) => update(index, next)} /> : null}
        </div>
      ))}
      {research.serp.length < 3 ? (
        <button
          type="button"
          className={s.linkButton}
          onClick={() => {
            research.setSerp((list) => [...list, blankSerp(keywords[0] ?? "", today)]);
            setEditing(research.serp.length);
          }}
        >
          + Add a result-page review
        </button>
      ) : null}
    </div>
  );
}

function SerpEditor({ review, keywords, today, onChange }: { review: SerpReview; keywords: string[]; today: string; onChange: (next: SerpReview) => void }) {
  const setRow = (i: number, patch: Partial<SerpReview["results"][number]>) => onChange({ ...review, results: review.results.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className={s.serpEditor}>
      <div className={s.addEvidence}>
        <label>
          Keyword
          <select value={review.keyword} onChange={(e) => onChange({ ...review, keyword: e.target.value })}>
            {!keywords.includes(review.keyword) ? <option value={review.keyword}>{review.keyword || "Choose…"}</option> : null}
            {keywords.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label>
          Searched on
          <input type="date" value={review.checkedAt} max={today} onChange={(e) => onChange({ ...review, checkedAt: e.target.value })} />
        </label>
        <label>
          Device
          <select value={review.device} onChange={(e) => onChange({ ...review, device: e.target.value === "desktop" ? "desktop" : "mobile" })}>
            <option value="mobile">Phone</option>
            <option value="desktop">Desktop</option>
          </select>
        </label>
      </div>
      <div className={s.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Domain</th>
              <th>Kind of page</th>
              <th>About this look?</th>
            </tr>
          </thead>
          <tbody>
            {review.results.map((r, i) => (
              <tr key={i}>
                <td data-label="#">{r.position}</td>
                <td data-label="Domain">
                  <input aria-label={`Result ${r.position} domain`} value={r.domain} placeholder="example.com" onChange={(e) => setRow(i, { domain: e.target.value })} />
                </td>
                <td data-label="Kind of page">
                  <select aria-label={`Result ${r.position} kind`} value={r.type} onChange={(e) => setRow(i, { type: e.target.value as typeof r.type })}>
                    {SERP_RESULT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {SERP_RESULT_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </td>
                <td data-label="About this look?">
                  <select aria-label={`Result ${r.position} match`} value={r.match} onChange={(e) => setRow(i, { match: e.target.value as typeof r.match })}>
                    {SERP_MATCH.map((m) => (
                      <option key={m} value={m}>
                        {m === "exact" ? "Yes, this exact look" : m === "similar" ? "A similar look" : "Something else"}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {review.results.length < 10 ? (
        <button type="button" className={s.linkButton} onClick={() => onChange({ ...review, results: [...review.results, { position: review.results.length + 1, domain: "", type: "other", match: "different" }] })}>
          + Another result
        </button>
      ) : null}
      <fieldset className={s.features}>
        <legend>Also on the page</legend>
        {SERP_FEATURES.map((f) => (
          <label key={f}>
            <input
              type="checkbox"
              checked={review.features.includes(f)}
              onChange={(e) => onChange({ ...review, features: e.target.checked ? [...review.features, f] : review.features.filter((x) => x !== f) })}
            />
            {f.replace(/-/g, " ")}
          </label>
        ))}
      </fieldset>
      <label className={s.noteField}>
        Notes
        <textarea rows={2} maxLength={500} value={review.note ?? ""} onChange={(e) => onChange({ ...review, note: e.target.value })} />
      </label>
    </div>
  );
}
