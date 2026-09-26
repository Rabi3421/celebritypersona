import { notFound } from "next/navigation";
import { HubRecordForm } from "@/components/admin/HubRecordForm";
import { BUDGET_CAPS, budgetLabel, budgetSlug, looksUnder } from "@/lib/budget";
import { getBudgetPages, getPublishedOutfits } from "@/lib/db/content";
import { budgetDescription, budgetHeadline } from "@/lib/hub-pages";
import { saveBudget } from "../actions";

export default async function EditBudgetPage({ params }: { params: Promise<{ cap: string }> }) {
  const cap = Number((await params).cap);
  if (!(BUDGET_CAPS as readonly number[]).includes(cap)) notFound();
  const [outfits, pages] = await Promise.all([getPublishedOutfits(), getBudgetPages()]);
  const looks = looksUnder(outfits, cap).length;

  return (
    <HubRecordForm
      action={saveBudget}
      hidden={{ cap }}
      record={pages.find((page) => page.cap === cap)}
      introHint={`One paragraph per line, 100–300 words: what a celebrity look ${budgetLabel(cap).toLowerCase()} can be, which swaps work, where to shop. With fewer than 2 looks, the page stays out of Google until this has 100+ words.`}
      path={`/budget/${budgetSlug(cap)}`}
      looks={looks}
      fallbackTitle={budgetHeadline(cap)}
      fallbackDescription={budgetDescription(cap, looks)}
      backHref="/admin/budgets"
    />
  );
}
