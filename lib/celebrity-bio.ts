import { plural } from "@/lib/format";
import type { CelebrityView } from "@/lib/archive";

/**
 * The fallback bio for a person nobody has written one for yet.
 *
 * It used to open, for everyone, with "her archive moves comfortably between
 * polished occasion dressing and practical off-duty looks; the common thread
 * is a clear silhouette, controlled colour, and one focal piece" — a confident
 * verdict on a real person's taste, printed identically on twenty pages, and
 * on fourteen of them the archive held nothing at all to base it on.
 *
 * A claim about what somebody habitually wears needs more than one sighting to
 * stand up, so what this says now is bounded by how many looks are decoded:
 *
 *  - 0 looks  no claim of any kind, only what the page is for
 *  - 1 look   the facts of that one look, named as one look
 *  - 2-3      observations, said as observations from the looks so far
 *  - 4+       recurrence, and only for labels that actually recur
 *
 * It is also written to be different per person: the labels, garments and
 * colours in it come from her own pieces, so twenty archives do not publish
 * twenty copies of one paragraph.
 */

/** Where "we have seen this more than once" becomes "she does this". */
const PATTERN_THRESHOLD = 4;
/** Below this, a second look is an observation rather than a habit. */
const OBSERVATION_THRESHOLD = 2;

const list = (values: string[]) =>
  values.length < 2
    ? (values[0] ?? "")
    : `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;

export function celebrityBio(celebrity: CelebrityView): string[] {
  if (celebrity.bio?.length) return celebrity.bio;

  const { looks, pieces, brands, garments, palette, occasions } = celebrity.stats;
  const her = celebrity.name;
  const first = her.split(" ")[0];

  if (looks === 0) {
    return [
      `No look of ${her}'s has been decoded here yet. When one is, this page will carry every piece she wore — the label, the price we could confirm, and an affordable alternative where we have found one.`,
    ];
  }

  const labels = brands.map((brand) => brand.name);
  const shapes = garments.map((garment) => garment.name.toLowerCase());
  const colours = palette.map((colour) => colour.name.toLowerCase());
  const events = occasions.map((occasion) => occasion.name.toLowerCase());

  if (looks === 1) {
    const only = [
      `One ${her} look is decoded here so far`,
      events[0] ? ` — ${events[0]}` : "",
      `. It runs to ${plural(pieces, "piece")}`,
      labels[0] ? `, wearing ${list(labels.slice(0, 3))}` : "",
      ".",
    ].join("");
    return [
      only,
      `That is a single appearance, so nothing on this page describes ${first}'s style in general. What it does give you is that outfit, item by item, with what each piece cost and where an equivalent can be bought.`,
    ];
  }

  if (looks < PATTERN_THRESHOLD && looks >= OBSERVATION_THRESHOLD) {
    const repeated = labels.filter(
      (_, index) => (brands[index]?.count ?? 0) > 1,
    );
    const observation = repeated.length
      ? `${list(repeated.slice(0, 2))} ${repeated.length === 1 ? "appears" : "appear"} in more than one of them.`
      : `Each carries a different label so far.`;
    return [
      `${plural(looks, "look")} of ${her}'s are decoded here, covering ${list(events.slice(0, 3))}. Across them ${plural(pieces, "piece")} have been identified and priced.`,
      `${observation} With this few appearances on record these are observations from the looks we have decoded rather than a description of how ${first} dresses generally — the page says what is in the archive, and no more.`,
    ];
  }

  // Four or more looks: enough to talk about what recurs, using only the
  // labels, shapes and colours that actually do.
  const recurring = brands.filter((brand) => brand.count > 1);
  const labelLine = recurring.length
    ? `${list(recurring.slice(0, 2).map((brand) => brand.name))} ${recurring.length === 1 ? "is the label that recurs" : "are the labels that recur"} most across her pieces`
    : `No single label repeats across them yet`;

  return [
    `${plural(looks, "look")} of ${her}'s are decoded here — ${list(events.slice(0, 3))} — with ${plural(pieces, "piece")} identified and priced.`,
    [
      labelLine,
      shapes.length ? `, and ${list(shapes.slice(0, 3))} are the shapes that come up most often` : "",
      colours.length ? `, most often in ${list(colours.slice(0, 2))}` : "",
      `. Everything counted here is counted from those ${looks} looks, so it moves as the archive grows.`,
    ].join(""),
  ];
}
