import Image from "next/image";
import { outfitPhoto, type Outfit } from "@/lib/types";
import type { CelebrityView } from "@/lib/archive";

/**
 * Every card on the site used to fall back to `picsum.photos` when a look or a
 * person had no photograph — a random stock image, served from a third party,
 * captioned with a real person's name and the event she attended. It is the
 * one thing on a fashion site a reader is guaranteed to notice is wrong, and
 * Google Images had it indexed under her name.
 *
 * There is no honest photograph to substitute, so nothing pretends to be one:
 * the frame fills with the same gradient the homepage rail uses, and carries
 * no alt text because it depicts nothing.
 */

const TONES = [
  "linear-gradient(155deg,#252932,#454B57)",
  "linear-gradient(155deg,#2B2229,#5A4550)",
  "linear-gradient(155deg,#1E2A2A,#43585A)",
  "linear-gradient(155deg,#2A2620,#57493A)",
  "linear-gradient(155deg,#26222E,#4E4560)",
];

/**
 * A frame that fills its (positioned) parent and depicts nothing.
 *
 * The gradient alone read as a design choice rather than as an absence: a
 * reader looking at Rukmini Vasanth's card saw a coloured tile where every
 * other card has a photograph and could not tell whether the image had failed
 * to load. The brand mark sits on it now, faint enough not to compete with the
 * real photographs beside it and clear enough to say "there is no picture
 * here yet". It is still `aria-hidden`, because it depicts nothing and a
 * screen reader has the name and event in the card's own text.
 */
export function BlankFrame({ seed }: { seed: number | string }) {
  const n =
    typeof seed === "number"
      ? seed
      : [...seed].reduce((total, ch) => total + ch.charCodeAt(0), 0);
  return <Blank seed={n} />;
}

function Blank({ seed }: { seed: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        background: TONES[Math.abs(seed) % TONES.length],
        display: "grid",
        placeItems: "center",
      }}
    >
      <Image
        src="/brand/celebritypersona-mark.png"
        alt=""
        width={44}
        height={44}
        style={{ width: "28%", maxWidth: 64, height: "auto", opacity: 0.22 }}
      />
    </span>
  );
}

/**
 * What the photo shows, in the words a reader who cannot see it would need:
 * who is in it, what she is wearing, and where. The editor's own alt wins when
 * there is one — this is the line for photos saved before that field existed.
 */
export function outfitAlt(outfit: Outfit) {
  const photo = outfitPhoto(outfit);
  if (photo?.alt?.trim()) return photo.alt.trim();

  const pieces = outfit.items.slice(0, 2).map((item) =>
    item.wornBrand ? `${item.name.toLowerCase()} by ${item.wornBrand}` : item.name.toLowerCase(),
  );
  const wearing = pieces.length ? ` wearing a ${pieces.join(" and ")}` : "";
  return `${outfit.celebrity}${wearing} at ${outfit.event}`;
}

/** A look's lead photo, or an honest blank. `alt=""` on decorative uses.
 *  `preload` replaces `priority`, which Next 16 deprecated. */
export function OutfitThumb({
  outfit,
  sizes,
  preload,
  decorative,
}: {
  outfit: Outfit;
  sizes: string;
  preload?: boolean;
  decorative?: boolean;
}) {
  const photo = outfitPhoto(outfit);
  if (!photo) return <Blank seed={outfit.id} />;
  return (
    <Image
      src={photo.url}
      alt={decorative ? "" : outfitAlt(outfit)}
      fill
      sizes={sizes}
      preload={preload}
    />
  );
}

/** A person's portrait from her archive, or an honest blank. */
export function CelebrityThumb({
  celebrity,
  sizes,
  index = 0,
  preload,
  decorative,
}: {
  celebrity: CelebrityView;
  sizes: string;
  index?: number;
  preload?: boolean;
  decorative?: boolean;
}) {
  const photo = celebrity.stats.photos[index] ?? celebrity.stats.photos[0];
  if (!photo) return <Blank seed={celebrity.id} />;
  return (
    <Image
      src={photo}
      alt={decorative ? "" : `${celebrity.name} in a look decoded on CelebrityPersona`}
      fill
      sizes={sizes}
      preload={preload}
    />
  );
}
