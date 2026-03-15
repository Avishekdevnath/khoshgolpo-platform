import useSWR from "swr";

import { getFeedPreferences, updateFeedInterests, updateFeedPreferences } from "@/lib/feedApi";
import type { FeedPreferences, FeedPreferencesUpdate } from "@/types/feed";

export function useFeedPreferences() {
  const { data, error, isLoading, mutate } = useSWR<FeedPreferences>(
    "feed/preferences",
    getFeedPreferences,
    {
      revalidateOnFocus: false,
    },
  );

  async function savePreferences(payload: FeedPreferencesUpdate): Promise<FeedPreferences> {
    const next = await updateFeedPreferences(payload);
    await mutate(next, false);
    return next;
  }

  async function saveInterests(interestTags: string[]): Promise<FeedPreferences> {
    const next = await updateFeedInterests(interestTags);
    await mutate(next, false);
    return next;
  }

  async function setPreferencesLocal(next: FeedPreferences): Promise<void> {
    await mutate(next, false);
  }

  return {
    preferences: data ?? { interest_tags: [], hidden_tags: [], muted_user_ids: [] },
    isLoading,
    error,
    refresh: mutate,
    savePreferences,
    saveInterests,
    setPreferencesLocal,
  };
}
