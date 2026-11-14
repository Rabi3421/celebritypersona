import "server-only";
import { buildActions } from "@/lib/bi/actions";
import { recentActivity } from "@/lib/bi/activity";
import { clicksPipeline, summariseClicks, type ClickSummary } from "@/lib/bi/clicks";
import { contentSnapshot } from "@/lib/bi/content";
import { istDay, resolvePeriod, type Period } from "@/lib/bi/period";
import { getTraffic, trafficConnection } from "@/lib/bi/posthog";
import { clickSource, databaseSource } from "@/lib/bi/sources";
import { archiveHealth } from "@/lib/admin-health";
import {
  getAllOutfits,
  getCelebrityRequests,
  getCelebrityViews,
  getMailJobs,
  getOccasionViews,
  getPriceReports,
  getSubscribers,
} from "@/lib/db/content";
import { getDb } from "@/lib/mongodb";
import { outfitSlug } from "@/lib/slugs";

/**
 * Everything the Overview shows, gathered server-side. MongoDB figures are
 * awaited; PostHog is returned as a promise so the page can stream it in and
 * never waits on it for anything else. Each source fails on its own.
 */

async function database() {
  try {
    await (await getDb()).command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

const dayOfIso = (row: Record<string, unknown> | undefined) => {
  const ms = typeof row?.at === "string" ? Date.parse(row.at) : NaN;
  return Number.isNaN(ms) ? null : istDay(ms);
};

/** One aggregation over the two periods, plus the first and newest production click (each a single-document read). */
export async function loadClicks(period: Period): Promise<ClickSummary | null> {
  try {
    const collection = (await getDb()).collection("linkClicks");
    const edge = (direction: 1 | -1) =>
      collection.find({ env: "production" }, { projection: { _id: 0, at: 1 }, sort: { at: direction }, limit: 1, maxTimeMS: 8000 }).toArray();
    const [facets, first, last] = await Promise.all([collection.aggregate(clicksPipeline(period), { maxTimeMS: 8000 }).toArray(), edge(1), edge(-1)]);
    return summariseClicks(facets[0] as Parameters<typeof summariseClicks>[0], period, dayOfIso(first[0]), dayOfIso(last[0]));
  } catch {
    return null;
  }
}

const settle = async <T>(promise: Promise<T>, fallback: T) => {
  try {
    return await promise;
  } catch {
    return fallback;
  }
};

export async function loadOverview(params: { range?: string; from?: string; to?: string }, now = Date.now()) {
  const period = resolvePeriod(params, now);
  const traffic = getTraffic(period, now); // started now, awaited by whoever renders it
  const connection = trafficConnection();
  const [db, outfits, celebrities, occasions, reports, requests, mailJobs, subscribers, clicks] = await Promise.all([
    database(),
    settle(getAllOutfits(), []),
    settle(getCelebrityViews(), []),
    settle(getOccasionViews(), []),
    settle(getPriceReports(), []),
    settle(getCelebrityRequests(), []),
    settle(getMailJobs(), []),
    settle(getSubscribers(), []),
    loadClicks(period),
  ]);

  const today = istDay(now);
  const content = contentSnapshot(outfits, period, now);
  const health = archiveHealth({ outfits, celebrities, occasions, reports, requests, now: new Date(now) });
  const actions = buildActions({ content, health, clicks, traffic: connection, periodLabel: period.label });
  const activity = recentActivity({ outfits, mailJobs, subscribers, clickDays: clicks?.daily ?? [] });
  const sources = { database: databaseSource(db), clicks: clickSource({ ok: clicks !== null, since: clicks?.since ?? null, lastDay: clicks?.lastDay ?? null }, today) };

  // Look names for PostHog's outfit_view slugs and the click log's ids.
  const looks = outfits.map((o) => ({ id: o.id, slug: outfitSlug(o), name: `${o.celebrity} · ${o.event}` }));

  return {
    now,
    today,
    period,
    db,
    content,
    health,
    clicks,
    traffic,
    connection,
    actions,
    activity,
    sources,
    looks,
    subscribers: subscribers.filter((s) => s.status === "Active").length,
  };
}

export type Overview = Awaited<ReturnType<typeof loadOverview>>;
