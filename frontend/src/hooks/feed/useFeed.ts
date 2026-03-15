import { useMemo } from "react";
import useSWRInfinite from "swr/infinite";

import { getFeedPage } from "@/lib/feedApi";
import type { FeedItem, FeedListResponse, FeedMode } from "@/types/feed";

type FeedKey = readonly ["feed", FeedMode, number, string | null];

function uniqueById(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const unique: FeedItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

export function useFeed(mode: FeedMode, options: { limit?: number } = {}) {
  const limit = options.limit ?? 20;

  const getKey = (pageIndex: number, previousPageData: FeedListResponse | null): FeedKey | null => {
    if (previousPageData && !previousPageData.next_cursor) {
      return null;
    }
    const cursor = pageIndex === 0 ? null : (previousPageData?.next_cursor ?? null);
    return ["feed", mode, limit, cursor];
  };

  const { data, error, isValidating, size, setSize, mutate } = useSWRInfinite<FeedListResponse, Error>(
    getKey,
    (key: FeedKey) => {
      const [, modeKey, limitKey, cursorKey] = key;
      return getFeedPage(modeKey, { limit: limitKey, cursor: cursorKey });
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  const items = useMemo(
    () => uniqueById((data ?? []).flatMap(page => page.data)),
    [data],
  );

  const nextCursor = data?.[data.length - 1]?.next_cursor ?? null;
  const hasMore = nextCursor !== null;
  const isLoading = !data && !error;
  const isLoadingMore = isValidating && size > 0;

  async function loadMore(): Promise<void> {
    if (!hasMore || isLoadingMore) return;
    await setSize(size + 1);
  }

  return {
    items,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    nextCursor,
    refresh: mutate,
    loadMore,
  };
}
