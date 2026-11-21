/**
 * Reads a product page the way a person's browser would, and reports what it
 * says: name, brand, price, currency, stock. Used by the look research runner
 * so prices and swaps come from the page itself, not from memory.
 *
 *     npx tsx scripts/shop-reader.ts product <url>      → one JSON object
 *
 * It uses the Chrome installed on this computer, in its ordinary headless mode,
 * one page at a time. It reads only public product pages and never logs in,
 * adds to a cart or buys. A shop that blocks automated reading is reported as
 * blocked and left alone: nothing here tries to get around a shop's protection.
 *
 * No "@/" imports, so it runs from any folder.
 */
import { chromium, type Browser } from "playwright-core";

export type ShopProduct = {
  url: string;
  ok: boolean;
  /** Why nothing could be read: "blocked", "not a product page", "HTTP 404"… */
  problem?: string;
  name?: string;
  brand?: string;
  price?: number;
  currency?: string;
  inStock?: boolean;
  image?: string;
};

const BLOCKED = /access denied|forbidden|captcha|are you a (human|robot)|unusual traffic|request blocked|too many requests/i;

/** Runs inside the page: JSON-LD Product first, then Shopify's own data, then meta tags. */
function extract() {
  const out: Record<string, unknown> = {};
  const nodes: Record<string, unknown>[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      const node = value as Record<string, unknown>;
      nodes.push(node);
      if (node["@graph"]) walk(node["@graph"]);
    }
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(script.textContent ?? ""));
    } catch {
      // A broken block on someone else's page; the others may still be fine.
    }
  }
  const isProduct = (node: Record<string, unknown>) => [node["@type"]].flat().some((type) => String(type).toLowerCase() === "product");
  const product = nodes.find(isProduct);
  if (product) {
    out.name = product.name;
    const brand = product.brand as { name?: string } | string | undefined;
    out.brand = typeof brand === "string" ? brand : brand?.name;
    const offers = [product.offers].flat().filter(Boolean) as Record<string, unknown>[];
    const offer = offers[0] ?? {};
    out.price = offer.price ?? offer.lowPrice ?? (offer.priceSpecification as { price?: unknown })?.price;
    out.currency = offer.priceCurrency ?? (offer.priceSpecification as { priceCurrency?: unknown })?.priceCurrency;
    const availability = offers.map((item) => String(item.availability ?? "")).join(" ");
    if (availability) out.inStock = /InStock|PreOrder|BackOrder|LimitedAvailability|MadeToOrder/i.test(availability);
    out.image = [product.image].flat()[0];
  }
  const meta = (property: string) =>
    document.querySelector(`meta[property="${property}"], meta[name="${property}"]`)?.getAttribute("content") ?? undefined;
  out.name ??= meta("og:title");
  out.price ??= meta("product:price:amount") ?? meta("og:price:amount");
  out.currency ??= meta("product:price:currency") ?? meta("og:price:currency");
  out.image ??= meta("og:image");
  out.isProductPage = Boolean(product) || Boolean(meta("product:price:amount") ?? meta("og:price:amount"));
  out.title = document.title;
  out.text = document.body?.innerText?.slice(0, 400) ?? "";
  return out;
}

/** Shopify stores expose the product as /products/<handle>.js on the same site. */
async function shopifyFallback(page: import("playwright-core").Page) {
  return page.evaluate(async () => {
    const meta = (window as unknown as { ShopifyAnalytics?: { meta?: { product?: unknown } } }).ShopifyAnalytics?.meta?.product;
    if (!meta || !/\/products\/[^/]+/.test(location.pathname)) return null;
    const response = await fetch(`${location.pathname.replace(/\/$/, "")}.js`, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const product = await response.json();
    const variants = (product.variants ?? []) as { price: number; available: boolean }[];
    const currency = (window as unknown as { Shopify?: { currency?: { active?: string } } }).Shopify?.currency?.active;
    return {
      name: product.title as string,
      brand: product.vendor as string,
      price: variants.length ? Math.min(...variants.map((variant) => variant.price)) / 100 : undefined,
      inStock: variants.some((variant) => variant.available),
      currency,
    };
  });
}

const toNumber = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? Math.round(number) : undefined;
};

export async function readProduct(url: string, browser?: Browser): Promise<ShopProduct> {
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error();
  } catch {
    return { url, ok: false, problem: "not an https:// link" };
  }
  const own = !browser;
  const chrome = browser ?? (await chromium.launch({ channel: "chrome", headless: true }));
  const context = await chrome.newContext({ locale: "en-IN", viewport: { width: 1366, height: 900 } });
  // tsx compiles functions with a `__name` helper that only exists in Node; the
  // functions passed to page.evaluate need it to exist in the page as well.
  await context.addInitScript({ content: "window.__name = (target) => target;" });
  const page = await context.newPage();
  try {
    const response = await page.goto(parsed.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2500);
    const status = response?.status() ?? 0;
    const found = (await page.evaluate(extract)) as Record<string, unknown>;
    if (status === 403 || status === 429 || status === 503 || BLOCKED.test(`${found.title} ${found.text}`.slice(0, 300))) {
      return { url, ok: false, problem: `blocked by the shop (HTTP ${status}); open it by hand` };
    }
    if (status >= 400) return { url, ok: false, problem: `HTTP ${status}` };
    const shopify = found.price ? null : await shopifyFallback(page).catch(() => null);
    const name = String(shopify?.name ?? found.name ?? "").trim() || undefined;
    const price = toNumber(shopify?.price ?? found.price);
    if (!found.isProductPage && !shopify) {
      return { url: page.url(), ok: false, problem: "not a product page (no product data found)", name };
    }
    return {
      url: page.url(),
      ok: Boolean(name && price),
      ...(name && price ? {} : { problem: "product page without a readable price" }),
      name,
      brand: (shopify?.brand ?? (found.brand as string | undefined))?.trim() || undefined,
      price,
      currency: String(shopify?.currency ?? found.currency ?? "").toUpperCase() || undefined,
      inStock: (shopify?.inStock ?? found.inStock) as boolean | undefined,
      image: typeof found.image === "string" ? found.image : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { url, ok: false, problem: /ERR_HTTP2_PROTOCOL_ERROR|ERR_CONNECTION/.test(message) ? "blocked by the shop (connection refused); open it by hand" : message.slice(0, 200) };
  } finally {
    await context.close();
    if (own) await chrome.close();
  }
}

/** Reads several pages with one browser, one at a time, a moment apart. */
export async function readProducts(urls: string[]): Promise<ShopProduct[]> {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const results: ShopProduct[] = [];
    for (const url of urls) {
      results.push(await readProduct(url, browser));
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return results;
  } finally {
    await browser.close();
  }
}

// CLI: `product <url>` prints one JSON object.
const [command, url] = process.argv.slice(2);
if (command === "product") {
  readProduct(url ?? "")
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.log(JSON.stringify({ url, ok: false, problem: String(error).slice(0, 200) }));
    });
}
