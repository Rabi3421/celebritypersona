"use client";

import { useActionState } from "react";
import {
  ErrorSummary,
  FormError,
  SaveButton,
  TextAreaField,
  TextField,
} from "@/components/admin/form/Fields";
import { RepeatableRows } from "@/components/admin/form/RepeatableRows";
import { saveHome, type HomeFormState } from "@/app/admin/(panel)/home/actions";
import type { HomeContent } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

const peekText = (peek: { label: string; price: number }[]) =>
  peek.map((entry) => `${entry.label}:${entry.price}`).join(", ");

export function HomeForm({ home, saved }: { home: HomeContent; saved?: boolean }) {
  const [state, action] = useActionState<HomeFormState, FormData>(saveHome, {});
  const errors = state.errors;

  return (
    <>
      {saved ? (
        <div className={styles.notice}>
          <strong>Saved</strong>
          <p>The homepage has been updated and the public pages revalidated.</p>
        </div>
      ) : null}
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />

      <form action={action} id="entity-form">
        <section className={styles.section} style={{ marginTop: 0 }}>
          <div className={styles.sectionHead}>
            <h2>Hero look</h2>
            <span>Drives the swap demo</span>
          </div>
          <div className={styles.formGrid}>
            <TextField name="hero.celebrity" label="Celebrity" defaultValue={home.heroLook.celebrity} errors={errors} />
            <TextField name="hero.occasion" label="Occasion" defaultValue={home.heroLook.occasion} errors={errors} />
            <TextField name="hero.date" label="Date" defaultValue={home.heroLook.date} errors={errors} />
            <TextField name="hero.photoCredit" label="Photo credit" defaultValue={home.heroLook.photoCredit} errors={errors} />
            <TextField name="hero.headline" label="Headline" defaultValue={home.heroLook.headline} errors={errors} wide />
            <TextAreaField name="hero.summary" label="Summary" defaultValue={home.heroLook.summary} errors={errors} rows={3} />
            <RepeatableRows
              name="heroItems"
              title="Hero pieces"
              columns="minmax(0,1.2fr) 110px minmax(0,1fr) minmax(0,1fr) 110px 110px"
              error={errors?.["heroLook.items"]}
              initial={home.heroLook.items}
              addLabel="Add a piece"
              fields={[
                { key: "name", label: "Piece" },
                { key: "short", label: "Short" },
                { key: "wornBrand", label: "Worn brand" },
                { key: "swapBrand", label: "Swap brand" },
                { key: "worn", label: "Worn ₹", type: "number" },
                { key: "swap", label: "Swap ₹", type: "number" },
              ]}
            />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.formGrid}>
            <RepeatableRows name="ticker" title="Ticker" columns="minmax(0,1fr) minmax(0,1fr) 120px 120px"
              error={errors?.tickerEntries} initial={home.tickerEntries} addLabel="Add an entry"
              fields={[{ key: "celebrity", label: "Celebrity" }, { key: "occasion", label: "Occasion" },
                       { key: "worn", label: "Worn ₹", type: "number" }, { key: "swap", label: "Swap ₹", type: "number" }]} />
            <RepeatableRows name="stats" title="Stats bar" columns="140px 120px minmax(0,1fr)"
              error={errors?.stats} initial={home.stats} addLabel="Add a stat"
              fields={[{ key: "value", label: "Value", type: "number" }, { key: "suffix", label: "Suffix" }, { key: "label", label: "Label" }]} />
            <RepeatableRows name="thisWeek" title="Decoded this week"
              hint="Peek format: Kurta:1799, Tote:1499"
              columns="minmax(0,1fr) minmax(0,1fr) 120px 90px 110px 110px minmax(0,1.4fr)"
              error={errors?.thisWeek} initial={home.thisWeek.map((c) => ({ ...c, peek: peekText(c.peek) }))}
              addLabel="Add a card"
              fields={[{ key: "celebrity", label: "Celebrity" }, { key: "occasion", label: "Occasion" },
                       { key: "posted", label: "Posted" }, { key: "tone", label: "Tone" },
                       { key: "worn", label: "Worn ₹", type: "number" }, { key: "swap", label: "Swap ₹", type: "number" },
                       { key: "peek", label: "Peek" }]} />
            <RepeatableRows name="swapSteps" title="How it works" columns="70px minmax(0,1fr) minmax(0,2fr)"
              error={errors?.swapSteps} initial={home.swapSteps} addLabel="Add a step"
              fields={[{ key: "n", label: "No." }, { key: "title", label: "Title" }, { key: "body", label: "Body" }]} />
            <RepeatableRows name="budgetTiers" title="Budget tiers" columns="150px 150px"
              error={errors?.budgetTiers} initial={home.budgetTiers} addLabel="Add a tier"
              fields={[{ key: "cap", label: "Under ₹", type: "number" }, { key: "looks", label: "Looks", type: "number" }]} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><h2>Dupe of the week</h2></div>
          <div className={styles.formGrid}>
            <TextField name="dupe.wornName" label="As worn" defaultValue={home.dupeOfTheWeek.worn.name} errors={errors} />
            <TextField name="dupe.wornPrice" label="As worn ₹" type="number" defaultValue={home.dupeOfTheWeek.worn.price} errors={errors} />
            <TextField name="dupe.swapName" label="The swap" defaultValue={home.dupeOfTheWeek.swap.name} errors={errors} />
            <TextField name="dupe.swapPrice" label="The swap ₹" type="number" defaultValue={home.dupeOfTheWeek.swap.price} errors={errors} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.formGrid}>
            <RepeatableRows name="homeOccasions" title="Occasion tiles" columns="minmax(0,1fr) 140px"
              error={errors?.occasions} initial={home.occasions} addLabel="Add an occasion"
              fields={[{ key: "name", label: "Name" }, { key: "looks", label: "Looks", type: "number" }]} />
            <RepeatableRows name="homeCelebrities" title="Archive tiles" columns="minmax(0,1fr) 140px"
              error={errors?.celebrities} initial={home.celebrities} addLabel="Add a celebrity"
              fields={[{ key: "name", label: "Name" }, { key: "looks", label: "Looks", type: "number" }]} />
            <RepeatableRows name="trustPoints" title="Trust points" columns="70px minmax(0,1fr) minmax(0,2fr)"
              error={errors?.trustPoints} initial={home.trustPoints} addLabel="Add a point"
              fields={[{ key: "n", label: "No." }, { key: "title", label: "Title" }, { key: "body", label: "Body" }]} />
            <RepeatableRows name="reels" title="Reels" columns="120px minmax(0,1fr)"
              error={errors?.reels} initial={home.reels} addLabel="Add a reel"
              fields={[{ key: "views", label: "Views" }, { key: "caption", label: "Caption" }]} />
            <TextAreaField name="brands" label="Brand marquee" hint="One brand per line"
              defaultValue={home.brands.join("\n")} errors={errors} rows={8} />
          </div>
        </section>

        <div className={styles.formBar}>
          <SaveButton>Save homepage</SaveButton>
        </div>
      </form>
    </>
  );
}
