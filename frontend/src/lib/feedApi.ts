import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  FeedExplainResponse,
  FeedListResponse,
  FeedMode,
  FeedPreferences,
  FeedPreferencesUpdate,
  MyFeedResponse,
  PopularTopicsResponse,
  SortMode,
} from "@/types/feed";

function withCursor(path: string, limit: number, cursor?: string | null): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return `${path}?${params.toString()}`;
}

export async function getFeedPage(
  mode: FeedMode,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<FeedListResponse> {
  const limit = options.limit ?? 20;
  const path = mode === "following" ? "feed/following" : "feed/home";
  return apiGet<FeedListResponse>(withCursor(path, limit, options.cursor));
}

export async function getFeedPreferences(): Promise<FeedPreferences> {
  return apiGet<FeedPreferences>("feed/preferences");
}

export async function updateFeedPreferences(payload: FeedPreferencesUpdate): Promise<FeedPreferences> {
  return apiPatch<FeedPreferences>("feed/preferences", payload);
}

export async function updateFeedInterests(interest_tags: string[]): Promise<FeedPreferences> {
  return apiPost<FeedPreferences>("feed/interest", { interest_tags });
}

export async function explainFeedItem(threadId: string, mode: FeedMode = "home"): Promise<FeedExplainResponse> {
  return apiGet<FeedExplainResponse>(`feed/explain/${threadId}?mode=${mode}`);
}

export async function getPopularTopics(limit = 40): Promise<PopularTopicsResponse> {
  return apiGet<PopularTopicsResponse>(`feed/topics/popular?limit=${limit}`);
}

export async function setUserTopics(topics: string[]): Promise<FeedPreferences> {
  return apiPost<FeedPreferences>("feed/topics", { topics });
}

export async function getMyFeed(
  sort: SortMode = "recent",
  options: { cursor?: string | null; limit?: number } = {},
): Promise<MyFeedResponse> {
  const params = new URLSearchParams({ sort, limit: String(options.limit ?? 20) });
  if (options.cursor) params.set("cursor", options.cursor);
  return apiGet<MyFeedResponse>(`feed/my-feed?${params.toString()}`);
}

export async function getExploreFeed(
  sort: SortMode = "recent",
  options: { cursor?: string | null; limit?: number } = {},
): Promise<FeedListResponse> {
  const params = new URLSearchParams({ sort, limit: String(options.limit ?? 20) });
  if (options.cursor) params.set("cursor", options.cursor);
  return apiGet<FeedListResponse>(`feed/explore?${params.toString()}`);
}
