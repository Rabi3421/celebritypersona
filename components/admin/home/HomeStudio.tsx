"use client";

import { useActionState, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { saveHome, type HomeFormState } from "@/app/admin/(panel)/home/actions";
import { useRetryAfterSignIn } from "@/components/admin/session/AdminSession";
import {
  dirtySections,
  duplicateNumbers,
  inSequence,
  isSitePath,
  moveItem,
  sectionOfError,
  sequenceNumber,
  STUDIO_SECTIONS,
  type StudioSectionId,
} from "@/lib/home-studio";
import type { HomeContent } from "@/lib/types";
import { HomePreview } from "./HomePreview";
import s from "./studio.module.css";

/** What the homepage works out for itself, computed on the server from published looks. */
export type StudioFacts = {
  publishedLooks: number;
  automatic: { key: string; label: string; value: string; hint: string; live: boolean }[];
  counters: { label: string; value: string }[];
  weddingLooks: number;
  minWeddingLooks: number;
  swapDemo: string | null;
};

type Item = { key: string; n: string; title: string; body: string };
const FORM_ID = "home-studio";
let nextKey = 0;
const keyed = (list: HomeContent["swapSteps"]): Item[] => list.map((item) => ({ ...item, key: `i${nextKey++}` }));
const plain = (list: Item[]) => list.map(({ n, title, body }) => ({ n, title, body }));

/**
 * The homepage's editorial copy, one section at a time, with a live preview.
 *
 * Saving is unchanged: one form, posted to the existing `saveHome` action with
 * the same field names, validated by the same schema. Everything here is
 * presentation — which section is open, what has changed since it was saved,
 * and what the preview shows. Nothing is saved until Save changes.
 */
export function HomeStudio({ home, facts, saved }: { home: HomeContent; facts: StudioFacts; saved: boolean }) {
  const [state, action, pending] = useActionState<HomeFormState, FormData>(saveHome, {});
  useRetryAfterSignIn(state, FORM_ID);
  const errors = useMemo(() => state.errors ?? {}, [state.errors]);

  const [showStats, setShowStats] = useState(Boolean(home.showStats));
  const [steps, setSteps] = useState(() => keyed(home.swapSteps));
  const [trust, setTrust] = useState(() => keyed(home.trustPoints));
  const [campaign, setCampaign] = useState(home.campaign);
  const draft: HomeContent = useMemo(() => ({ showStats, swapSteps: plain(steps), trustPoints: plain(trust), campaign }), [showStats, steps, trust, campaign]);
  const dirty = useMemo(() => dirtySections({ ...home, showStats: Boolean(home.showStats) }, draft), [home, draft]);

  const [active, setActive] = useState<StudioSectionId>("counters");
  const errorSections = useMemo(() => new Set(Object.keys(errors).map(sectionOfError).filter((x): x is StudioSectionId => Boolean(x))), [errors]);

  // A refused save opens the first section that needs attention.
  const [lastErrors, setLastErrors] = useState(errors);
  if (errors !== lastErrors) {
    setLastErrors(errors);
    const first = STUDIO_SECTIONS.find((section) => errorSections.has(section.id));
    if (first) setActive(first.id);
  }

  useLeaveGuard(dirty.size > 0 && !pending);

  const discard = () => {
    if (!window.confirm("Discard every unsaved change on this page?")) return;
    setShowStats(Boolean(home.showStats));
    setSteps(keyed(home.swapSteps));
    setTrust(keyed(home.trustPoints));
    setCampaign(home.campaign);
  };

  const formWide = errors.form;
  const fieldErrorCount = Object.keys(errors).filter((key) => key !== "form").length;

  return (
    <div className={s.studio}>
      <header className={s.toolbar}>
        <div className={s.titleBlock}>
          <h2 className={s.title}>Homepage Studio</h2>
          <p className={s.subtitle}>The copy on the public homepage. Everything else there is counted from published looks.</p>
        </div>
        <div className={s.toolbarActions}>
          <span className={s.status} data-state={pending ? "saving" : dirty.size ? "dirty" : "clean"} role="status" aria-live="polite">
            {pending ? "Saving…" : dirty.size ? `Unsaved changes in ${dirty.size} ${dirty.size === 1 ? "section" : "sections"}` : "All changes saved"}
          </span>
          {dirty.size && !pending ? (
            <button type="button" className={s.ghost} onClick={discard}>
              Discard
            </button>
          ) : null}
          <button type="submit" form={FORM_ID} className={s.primary} disabled={pending || dirty.size === 0}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      {saved && dirty.size === 0 && !Object.keys(errors).length ? (
        <p className={s.success} role="status">
          Saved. The public homepage has been updated.
        </p>
      ) : null}
      {formWide || fieldErrorCount ? (
        <div className={s.errorBox} role="alert">
          <strong>{formWide ?? (fieldErrorCount === 1 ? "One field needs attention before saving." : `${fieldErrorCount} fields need attention before saving.`)}</strong>
          {fieldErrorCount ? <span> Sections marked with ! show what to fix. Nothing was saved.</span> : null}
        </div>
      ) : null}

      <SectionNav active={active} onSelect={setActive} dirty={dirty} errors={errorSections} facts={facts} draft={draft} />

      <form action={action} id={FORM_ID} className={s.editor} noValidate>
        <Panel id="automatic" active={active}>
          <AutomaticPanel facts={facts} />
        </Panel>

        <Panel id="counters" active={active}>
          <PanelHead title="Counters" lead="Looks decoded, pieces identified and complete looks, in a bar under the hero. The figures are counted for you; you choose whether the bar is shown." />
          <label className={s.switchRow}>
            <input type="checkbox" name="showStats" checked={showStats} onChange={(e) => setShowStats(e.target.checked)} role="switch" aria-checked={showStats} />
            <span className={s.switchTrack} aria-hidden="true" />
            <span>
              <strong>Show the counters on the homepage</strong>
              <small>{showStats ? "Visitors see the figures below." : "Hidden from visitors. Turn on when the figures are worth showing."}</small>
            </span>
          </label>
          <div className={s.readout} aria-label="Figures the counters would show">
            {facts.counters.map((stat) => (
              <div className={s.readoutCard} key={stat.label}>
                <span>{stat.label}</span>
                <b>{stat.value}</b>
              </div>
            ))}
          </div>
          <p className={s.note}>Counted from {facts.publishedLooks} published {facts.publishedLooks === 1 ? "look" : "looks"}. Not editable.</p>
        </Panel>

        <Panel id="steps" active={active}>
          <PanelHead
            title="How swaps work"
            lead={facts.swapDemo ? `The steps beside the swap demo, which is showing ${facts.swapDemo}.` : "The steps beside the swap demo. The demo appears once a published look has two pieces priced on both sides — until then this section is not on the homepage."}
          />
          <ItemCards prefix="swapSteps" noun="step" items={steps} onChange={setSteps} errors={errors} listError={errors.swapSteps} />
        </Panel>

        <Panel id="campaign" active={active}>
          <PanelHead
            title="Campaign band"
            lead={`A full-width band that leads into the wedding edit. It runs once there are ${facts.minWeddingLooks} published wedding looks — there ${facts.weddingLooks === 1 ? "is" : "are"} ${facts.weddingLooks} now, so it is ${facts.weddingLooks >= facts.minWeddingLooks ? "showing" : "hidden"}.`}
          />
          <CampaignFields campaign={campaign} onChange={setCampaign} errors={errors} weddingLooks={facts.weddingLooks} />
        </Panel>

        <Panel id="trust" active={active}>
          <PanelHead title="Trust points" lead="“How we decode a look”, near the foot of the homepage. Short, specific promises the site actually keeps." />
          <ItemCards prefix="trustPoints" noun="point" items={trust} onChange={setTrust} errors={errors} listError={errors.trustPoints} />
        </Panel>

        <div className={s.formFoot}>
          <button type="submit" className={s.primary} disabled={pending || dirty.size === 0}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <span className={s.footNote}>Saves every section at once. The public homepage updates straight away.</span>
        </div>
      </form>

      <HomePreview section={active} content={draft} unsaved={dirty.has(active)} />
    </div>
  );
}

// ------------------------------------------------------------------ navigation

function SectionNav({
  active,
  onSelect,
  dirty,
  errors,
  facts,
  draft,
}: {
  active: StudioSectionId;
  onSelect: (id: StudioSectionId) => void;
  dirty: Set<StudioSectionId>;
  errors: Set<StudioSectionId>;
  facts: StudioFacts;
  draft: HomeContent;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const status: Record<StudioSectionId, string> = {
    automatic: `${facts.automatic.filter((a) => a.live).length} of ${facts.automatic.length} showing`,
    counters: draft.showStats ? "Showing" : "Hidden",
    steps: `${draft.swapSteps.length} ${draft.swapSteps.length === 1 ? "step" : "steps"}${facts.swapDemo ? "" : " · demo not shown yet"}`,
    campaign: facts.weddingLooks >= facts.minWeddingLooks ? "Showing" : `Hidden until ${facts.minWeddingLooks} wedding looks`,
    trust: `${draft.trustPoints.length} ${draft.trustPoints.length === 1 ? "point" : "points"}`,
  };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = STUDIO_SECTIONS.length - 1;
    const to = { ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: last }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const next = (to + STUDIO_SECTIONS.length) % STUDIO_SECTIONS.length;
    onSelect(STUDIO_SECTIONS[next].id);
    refs.current[next]?.focus();
  };
  return (
    <nav className={s.nav} aria-label="Homepage sections">
      <div role="tablist" aria-orientation="vertical" className={s.tabs}>
        {STUDIO_SECTIONS.map((section, i) => (
          <button
            key={section.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${section.id}`}
            aria-controls={`panel-${section.id}`}
            aria-selected={active === section.id}
            tabIndex={active === section.id ? 0 : -1}
            className={s.tab}
            onClick={() => onSelect(section.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className={s.tabTop}>
              <span className={s.tabLabel}>{section.label}</span>
              {errors.has(section.id) ? (
                <span className={s.badgeError} aria-label="needs attention">!</span>
              ) : dirty.has(section.id) ? (
                <span className={s.badgeDirty} aria-label="unsaved changes" />
              ) : !section.editable ? (
                <span className={s.badgeAuto}>Auto</span>
              ) : null}
            </span>
            <span className={s.tabMeta}>{status[section.id]}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function Panel({ id, active, children }: { id: StudioSectionId; active: StudioSectionId; children: ReactNode }) {
  // Inactive panels stay in the form (hidden), so a save always posts every section.
  return (
    <section role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={active !== id} className={s.panel}>
      {children}
    </section>
  );
}

function PanelHead({ title, lead }: { title: string; lead: string }) {
  return (
    <div className={s.panelHead}>
      <h3>{title}</h3>
      <p>{lead}</p>
    </div>
  );
}

// ------------------------------------------------------------------ automatic

function AutomaticPanel({ facts }: { facts: StudioFacts }) {
  return (
    <>
      <PanelHead title="Automatic sections" lead={`These parts of the homepage are counted from the ${facts.publishedLooks} published ${facts.publishedLooks === 1 ? "look" : "looks"} every time it is shown. There is nothing to edit here — publish or update a look and they follow.`} />
      <div className={s.autoGrid}>
        {facts.automatic.map((card) => (
          <div className={s.autoCard} key={card.key} data-live={card.live}>
            <span className={s.autoLabel}>
              {card.label}
              <em>{card.live ? "Showing" : "Not shown"}</em>
            </span>
            <b>{card.value}</b>
            <small>{card.hint}</small>
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ campaign

const SOFT_LIMITS = { eyebrow: 32, title: 60, cta: 32 } as const;

function CampaignFields({
  campaign,
  onChange,
  errors,
  weddingLooks,
}: {
  campaign: HomeContent["campaign"];
  onChange: (next: HomeContent["campaign"]) => void;
  errors: Record<string, string>;
  weddingLooks: number;
}) {
  const set = (key: keyof HomeContent["campaign"]) => (value: string) => onChange({ ...campaign, [key]: value });
  const hrefOk = isSitePath(campaign.href);
  return (
    <div className={s.fields}>
      <Field name="campaign.eyebrow" label="Eyebrow" help="The small label above the title." value={campaign.eyebrow} onChange={set("eyebrow")} error={errors["campaign.eyebrow"]} soft={SOFT_LIMITS.eyebrow} />
      <Field name="campaign.title" label="Title" help="The headline of the band." value={campaign.title} onChange={set("title")} error={errors["campaign.title"]} soft={SOFT_LIMITS.title} wide />
      <Field
        name="campaign.body"
        label="Body"
        help="Follows the number of wedding looks, which is filled in for you."
        value={campaign.body}
        onChange={set("body")}
        error={errors["campaign.body"]}
        multiline
        wide
        after={
          <p className={s.readsAs}>
            Reads as: <q>{weddingLooks} {weddingLooks === 1 ? "look" : "looks"} {campaign.body || "…"}</q>
          </p>
        }
      />
      <Field name="campaign.cta" label="Button label" help="The text on the button." value={campaign.cta} onChange={set("cta")} error={errors["campaign.cta"]} soft={SOFT_LIMITS.cta} />
      <Field
        name="campaign.href"
        label="Button link"
        help="A page on this site, starting with /."
        value={campaign.href}
        onChange={set("href")}
        error={errors["campaign.href"] ?? (campaign.href && !hrefOk ? "Use a path on this site that starts with /, e.g. /occasions." : undefined)}
        spellCheck={false}
        plain
        after={
          hrefOk ? (
            <p className={s.destination}>
              Goes to <code>celebritypersona.com{campaign.href.trim()}</code>{" "}
              <a href={campaign.href.trim()} target="_blank" rel="noopener noreferrer">
                Open ↗
              </a>
            </p>
          ) : null
        }
      />
    </div>
  );
}

function Field({
  name,
  label,
  help,
  value,
  onChange,
  error,
  soft,
  multiline,
  wide,
  after,
  spellCheck,
  plain,
}: {
  name: string;
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  soft?: number;
  multiline?: boolean;
  wide?: boolean;
  after?: ReactNode;
  spellCheck?: boolean;
  /** A plain one-line input (for links); otherwise one-line text wraps to show all of it. */
  plain?: boolean;
}) {
  const id = useId();
  const over = soft !== undefined && value.length > soft;
  const describedBy = [help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const common = { id, name, value, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, spellCheck } as const;
  return (
    <div className={s.field} data-wide={wide || undefined}>
      <div className={s.labelRow}>
        <label htmlFor={id}>{label}</label>
        {soft !== undefined ? (
          <span className={s.count} data-over={over || undefined}>
            {value.length}/{soft}
          </span>
        ) : null}
      </div>
      {multiline ? (
        <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : plain ? (
        <input {...common} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <LineField {...common} onChange={onChange} />
      )}
      {help ? (
        <small id={`${id}-help`} className={s.help}>
          {help}
          {over ? " Longer than usual — check it on a phone in the preview." : ""}
        </small>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={s.fieldError}>
          {error}
        </p>
      ) : null}
      {after}
    </div>
  );
}

/**
 * One line of text that wraps to show all of itself rather than scrolling out
 * of sight in a narrow field. Line breaks are refused (Enter does nothing,
 * pasted breaks become spaces), so what is saved is still one line.
 */
function LineField({
  onChange,
  value,
  ...rest
}: { onChange: (value: string) => void; value: string; id?: string; name: string; placeholder?: string; spellCheck?: boolean; "aria-invalid"?: true; "aria-describedby"?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + 2}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={s.lineField}
      value={value}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, " "))}
      {...rest}
    />
  );
}

// ------------------------------------------------------------------ repeatable cards

function ItemCards({
  prefix,
  noun,
  items,
  onChange,
  errors,
  listError,
}: {
  prefix: "swapSteps" | "trustPoints";
  noun: string;
  items: Item[];
  onChange: (next: Item[]) => void;
  errors: Record<string, string>;
  listError?: string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const update = (index: number, patch: Partial<Item>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const list = useRef<HTMLOListElement>(null);
  // Focus follows the card it moved: the same arrow if it still applies, otherwise the other one.
  const move = (from: number, to: number) => {
    onChange(moveItem(items, from, to));
    const dir = to < from ? "up" : "down";
    requestAnimationFrame(() => {
      const button = (d: string) => list.current?.querySelector<HTMLButtonElement>(`[aria-label="Move ${noun} ${to + 1} ${d}"]`);
      const same = button(dir);
      (same && !same.disabled ? same : button(dir === "up" ? "down" : "up"))?.focus();
    });
  };
  const remove = (key: string) => {
    onChange(items.filter((item) => item.key !== key));
    setConfirming(null);
  };
  const add = () => onChange([...items, { key: `i${nextKey++}`, n: sequenceNumber(items.length), title: "", body: "" }]);
  const duplicates = duplicateNumbers(items);
  const Noun = noun[0].toUpperCase() + noun.slice(1);

  return (
    <div className={s.items}>
      {listError ? <p className={s.fieldError}>{listError}</p> : null}
      <ol className={s.cards} ref={list}>
        {items.map((item, i) => {
          const open = !collapsed.has(item.key);
          const err = (field: string) => errors[`${prefix}.${i}.${field}`];
          // Position-based, so server and browser render the same id.
          const bodyId = `${prefix}-${i}-body`;
          return (
            <li key={item.key} className={s.card} data-error={Boolean(err("n") || err("title") || err("body")) || undefined}>
              <div className={s.cardHead}>
                <label className={s.numberField}>
                  <span className={s.srOnly}>
                    {Noun} {i + 1} number
                  </span>
                  <input name={`${prefix}.${i}.n`} value={item.n} onChange={(e) => update(i, { n: e.target.value })} aria-invalid={err("n") ? true : undefined} inputMode="numeric" />
                </label>
                <label className={s.titleField}>
                  <span className={s.srOnly}>
                    {Noun} {i + 1} title
                  </span>
                  <LineField name={`${prefix}.${i}.title`} value={item.title} placeholder={`${Noun} title`} onChange={(title) => update(i, { title })} aria-invalid={err("title") ? true : undefined} />
                </label>
                <div className={s.cardActions}>
                  <button type="button" className={s.iconButton} onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${noun} ${i + 1} up`} title="Move up">
                    ↑
                  </button>
                  <button type="button" className={s.iconButton} onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label={`Move ${noun} ${i + 1} down`} title="Move down">
                    ↓
                  </button>
                  <button
                    type="button"
                    className={s.iconButton}
                    aria-expanded={open}
                    aria-controls={bodyId}
                    aria-label={`${open ? "Collapse" : "Expand"} ${noun} ${i + 1}`}
                    title={open ? "Collapse" : "Expand"}
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(item.key)) next.delete(item.key);
                        else next.add(item.key);
                        return next;
                      })
                    }
                  >
                    {open ? "–" : "+"}
                  </button>
                  <button type="button" className={s.removeButton} onClick={() => setConfirming(item.key)} disabled={items.length === 1} title={items.length === 1 ? `The homepage needs at least one ${noun}` : undefined}>
                    Remove
                  </button>
                </div>
              </div>
              {confirming === item.key ? (
                <div className={s.confirm} role="alert">
                  <span>
                    Remove {noun} {item.n || i + 1}
                    {item.title ? ` “${item.title}”` : ""}? It goes when you save.
                  </span>
                  <button type="button" className={s.dangerButton} onClick={() => remove(item.key)}>
                    Remove
                  </button>
                  <button type="button" className={s.ghost} onClick={() => setConfirming(null)} autoFocus>
                    Keep it
                  </button>
                </div>
              ) : null}
              {/* Collapsed cards keep their text in the form (hidden), so it still saves. */}
              <div id={bodyId} className={s.cardBody} hidden={!open}>
                <label htmlFor={`${bodyId}-input`}>Text</label>
                <textarea id={`${bodyId}-input`} name={`${prefix}.${i}.body`} value={item.body} rows={3} onChange={(e) => update(i, { body: e.target.value })} aria-invalid={err("body") ? true : undefined} />
              </div>
              {!open && item.body ? <p className={s.cardSummary}>{item.body}</p> : null}
              {err("n") || err("title") || err("body") ? <p className={s.fieldError}>{[err("n"), err("title"), err("body")].filter(Boolean).join(" · ")}</p> : null}
            </li>
          );
        })}
      </ol>
      {duplicates.length ? <p className={s.warning}>Two {noun}s share the number {duplicates.join(", ")}. Give each its own.</p> : null}
      <div className={s.itemsFoot}>
        <button type="button" className={s.secondary} onClick={add}>
          + Add a {noun}
        </button>
        {!inSequence(items) ? (
          <button type="button" className={s.linkButton} onClick={() => onChange(items.map((item, i) => ({ ...item, n: sequenceNumber(i) })))}>
            Renumber 01, 02, 03…
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ leaving with unsaved changes

/** Asks before leaving — closing the tab, or following a link inside the admin — while there are unsaved changes. */
function useLeaveGuard(active: boolean) {
  const confirmLeave = useCallback(() => window.confirm("You have unsaved homepage changes. Leave without saving?"), []);
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (!confirmLeave()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, confirmLeave]);
}
