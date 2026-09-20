"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function SearchAnalytics({ queryLength, resultCount }: { queryLength: number; resultCount: number }) {
  useEffect(() => {
    if (queryLength === 0) return;
    trackEvent(resultCount === 0 ? "search_no_result" : "search", {
      query_length: queryLength,
      result_count: resultCount,
      source_page: "/search",
    });
  }, [queryLength, resultCount]);

  return null;
}
