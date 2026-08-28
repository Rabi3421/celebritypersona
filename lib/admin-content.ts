/**
 * Data the panel shows that has no home yet.
 *
 * Price reports currently arrive as email from the public report form, so
 * there is nothing to list until that form posts to a collection instead.
 * Keeping the shape here means the inbox screen is ready when it does.
 */

export type PriceReport = {
  id: string;
  receivedAt: string;
  outfitSlug: string;
  issue: "Price is wrong" | "Link is dead" | "Sold out" | "Wrong brand or piece";
  detail: string;
  reporterEmail?: string;
  status: "New" | "Checked" | "Fixed" | "No change needed";
};

export const priceReports: PriceReport[] = [];
