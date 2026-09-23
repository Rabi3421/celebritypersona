/**
 * Seed source for the `celebrities` collection. Not read by the app.
 *
 * This file used to carry eighteen names, one of them with a confident
 * two-paragraph description of how Alia Bhatt dresses — her repeated colours,
 * her silhouettes, her "most repeated label" — written against twenty invented
 * looks. None of it was reporting. A style archive is a claim about what a
 * person actually wears, so it cannot be seeded: it has to be written from
 * looks somebody decoded.
 *
 * A record is created in the panel when there is an archive to describe. The
 * public pages need no record to work — a name the outfits mention already
 * gets a profile — so seeding names ahead of looks only produced directories
 * of empty archives.
 */
import type { Celebrity } from "@/lib/types";

export const celebrities: Celebrity[] = [];
