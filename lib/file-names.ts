/**
 * A file name safe to show and to store: accents folded to plain letters,
 * emoji and every other special character dropped, runs of separators
 * collapsed. "Rukmini 💃 Café (1).JPG" becomes "Rukmini-Cafe-1.JPG".
 *
 * The storage path never uses the uploaded name — it is built from the slug
 * and the photo's position — so this is for what the editor reads back in a
 * message and for the name the compressed file carries.
 */
export function safeFileName(name: string, fallback = "photo"): string {
  // Only a short run of letters or digits after the last dot is an extension.
  const match = name.match(/^(.+)\.([A-Za-z0-9]{1,5})$/);
  const [stem, ext] = match ? [match[1], match[2]] : [name, ""];
  const clean = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  const safeStem = clean(stem) || fallback;
  const safeExt = ext;
  return safeExt ? `${safeStem}.${safeExt}` : safeStem;
}
