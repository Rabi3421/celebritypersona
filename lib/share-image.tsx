import "server-only";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { outfitPhotos, type Outfit } from "@/lib/types";
import { SHARE_KINDS, shareText, type ShareKind } from "@/lib/share-text";

/**
 * A look's share card (1200×630, for WhatsApp, X, Facebook and link previews)
 * and Pinterest pin (1000×1500), drawn from the look's REAL photo, its name and
 * its prices. Nothing is generated: the photo is only cropped, never altered.
 */

const INK = "#16181d";
const BONE = "#fbf9f5";
const RANI = "#e0006c";
const JADE = "#0f7a5a";
const MUTED = "#5c6270";

/** The photo cropped to the box, as JPEG: the image renderer cannot read WebP. */
async function photoData(url: string, width: number, height: number): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .rotate()
      .resize(width, height, { fit: "cover", position: sharp.strategy.attention })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

function Words({ outfit, scale }: { outfit: Outfit; scale: number }) {
  const text = shareText(outfit);
  const px = (n: number) => Math.round(n * scale);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: `${px(52)}px ${px(56)}px`, background: BONE, color: INK }}>
      <div style={{ display: "flex", fontSize: px(20), letterSpacing: 4, color: RANI, fontWeight: 700 }}>CELEBRITYPERSONA</div>
      <div style={{ display: "flex", fontSize: px(62), fontWeight: 700, lineHeight: 1.05, marginTop: px(26) }}>{text.celebrity}</div>
      <div style={{ display: "flex", fontSize: px(29), color: MUTED, lineHeight: 1.3, marginTop: px(14) }}>{text.event}</div>
      <div style={{ display: "flex", flex: 1 }} />
      {text.worn ? (
        <div style={{ display: "flex", alignItems: "baseline", fontSize: px(28), color: MUTED }}>
          <span>As worn&nbsp;</span>
          <span style={{ textDecoration: text.strike ? "line-through" : "none", color: INK }}>{text.worn}</span>
        </div>
      ) : null}
      {text.swap ? (
        <div style={{ display: "flex", alignItems: "center", marginTop: px(10) }}>
          <span style={{ fontSize: px(28), color: MUTED }}>Get the look&nbsp;</span>
          <span style={{ fontSize: px(52), fontWeight: 700, color: RANI }}>{text.swap}</span>
          {text.saving ? (
            <span
              style={{ marginLeft: px(16), fontSize: px(22), fontWeight: 700, color: "#fff", background: JADE, padding: `${px(6)}px ${px(14)}px`, borderRadius: px(999) }}
            >
              {text.saving}
            </span>
          ) : null}
        </div>
      ) : (
        <div style={{ display: "flex", fontSize: px(28), color: INK, marginTop: px(10) }}>{text.pieces}</div>
      )}
      <div style={{ display: "flex", fontSize: px(22), color: MUTED, marginTop: px(26) }}>celebritypersona.com</div>
    </div>
  );
}

export async function shareImage(outfit: Outfit, kind: ShareKind, headers: Record<string, string>) {
  const { width, height } = SHARE_KINDS[kind];
  const photoUrl = outfitPhotos(outfit)[0]?.url;
  // Card: photo on the left, words on the right. Pin: photo on top, words below.
  const box = kind === "card" ? { width: 470, height } : { width, height: 1000 };
  const photo = photoUrl ? await photoData(photoUrl, box.width, box.height) : null;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: kind === "card" ? "row" : "column", width: "100%", height: "100%", background: BONE }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={photo} width={box.width} height={box.height} style={{ objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", width: box.width, height: box.height, background: INK }} />
        )}
        <Words outfit={outfit} scale={kind === "card" ? 1 : 1.12} />
      </div>
    ),
    { width, height, headers },
  );
}

/**
 * The look's main preview image for Google Discover and Search: 1200×675, the
 * whole real photo centred on a blurred, darkened copy of itself. No text and
 * no logo, as Discover's guidance asks; nothing is generated or altered.
 * Returns JPEG bytes, or null when the look has no usable photo.
 */
export async function coverJpeg(outfit: Outfit): Promise<Buffer | null> {
  const url = outfitPhotos(outfit)[0]?.url;
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const source = sharp(Buffer.from(await response.arrayBuffer())).rotate();
    const [backdrop, front] = await Promise.all([
      source.clone().resize(1200, 675, { fit: "cover" }).blur(40).modulate({ brightness: 0.72 }).toBuffer(),
      source.clone().resize(1200, 675, { fit: "inside" }).toBuffer(),
    ]);
    return await sharp(backdrop)
      .composite([{ input: front, gravity: "centre" }])
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/** The text card as JPEG: a quarter of the PNG's size, which chat apps prefer. */
export async function cardJpeg(outfit: Outfit): Promise<Buffer> {
  const png = Buffer.from(await (await shareImage(outfit, "card", {})).arrayBuffer());
  return sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}
