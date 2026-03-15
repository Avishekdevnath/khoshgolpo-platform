export type FeedMode = "home" | "following";
export type SortMode = "recent" | "trending";
export type ThreadStatus = "open" | "closed" | "archived";

export interface PopularTopic {
  name: string;
  thread_count: number;
}

export interface PopularTopicsResponse {
  topics: PopularTopic[];
}

export interface MyFeedResponse {
  data: FeedItem[];
  next_cursor: string | null;
  has_topics: boolean;
}

export interface FeedItem {
  id: string;
  title: string;
  body: string;
  tags: string[];
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  post_count: number;
  status: ThreadStatus;
  is_pinned: boolean;
  is_flagged: boolean;
  is_deleted: boolean;
  feed_boost: number;
  created_at: string;
  updated_at: string;
  score: number | null;
  reasons: string[];
}

export interface FeedListResponse {
  data: FeedItem[];
  limit: number;
  next_cursor: string | null;
  mode: FeedMode;
}

export interface FeedPreferences {
  interest_tags: string[];
  hidden_tags: string[];
  muted_user_ids: string[];
  topics_selected: boolean;
}

export interface FeedPreferencesUpdate {
  interest_tags?: string[];
  hidden_tags?: string[];
  muted_user_ids?: string[];
}

export interface FeedExplainResponse {
  thread_id: string;
  mode: FeedMode;
  score: number;
  reasons: string[];
  breakdown: Record<string, number>;
}

export interface FeedWeights {
  follow: number;
  recency: number;
  engagement: number;
  interest: number;
  pin: number;
  quality_penalty: number;
  ai_adjustment_cap: number;
}

export interface FeedConfig {
  id: string;
  version: number;
  weights: FeedWeights;
  ai_enabled: boolean;
  ai_timeout_ms: number;
  ai_daily_budget_usd: number;
  ai_spend_today_usd: number;
  ai_last_reset: string;
  updated_by: string | null;
  updated_at: string;
}

export interface FeedThreadOverrideUpdate {
  feed_boost?: number;
  feed_suppressed?: boolean;
  reason?: string;
}

export interface FeedThreadOverrideResponse {
  thread_id: string;
  feed_boost: number;
  feed_suppressed: boolean;
  updated_at: string;
}

export interface FeedDebugItem {
  thread_id: string;
  title: string;
  author_id: string;
  score: number;
  reasons: string[];
  breakdown: Record<string, number>;
  created_at: string;
}

export interface FeedDebugResponse {
  mode: FeedMode;
  user_id: string;
  data: FeedDebugItem[];
  next_cursor: string | null;
}

export interface FeedAIHealth {
  ai_enabled: boolean;
  ai_timeout_ms: number;
  ai_daily_budget_usd: number;
  ai_spend_today_usd: number;
  ai_last_reset: string;
  requests_count: number;
  timeout_count: number;
  error_count: number;
  fallback_count: number;
}

export interface FeedAIPolicyUpdate {
  ai_enabled?: boolean;
  ai_timeout_ms?: number;
  ai_daily_budget_usd?: number;
  ai_adjustment_cap?: number;
  reason?: string;
}

export type FeedInterestSuggestionReplaceMode = "merge" | "replace";
export type FeedInterestSuggestionJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed";
export type FeedInterestSuggestionUserStatus = "success" | "fallback" | "failed" | "budget_exceeded";

export interface FeedInterestSuggestionJobRequest {
  user_ids: string[];
  replace_mode?: FeedInterestSuggestionReplaceMode;
  max_tags_per_user?: number;
}

export interface FeedInterestSuggestionUserResult {
  user_id: string;
  status: FeedInterestSuggestionUserStatus;
  suggested_tags: string[];
  applied_tags: string[];
  error: string | null;
}

export interface FeedInterestSuggestionJobSummary {
  job_id: string;
  status: FeedInterestSuggestionJobStatus;
  requested_count: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  replace_mode: FeedInterestSuggestionReplaceMode;
  max_tags_per_user: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface FeedInterestSuggestionJobCreateResponse {
  job_id: string;
  status: FeedInterestSuggestionJobStatus;
  requested_count: number;
  created_at: string;
}

export interface FeedInterestSuggestionJobResponse extends FeedInterestSuggestionJobSummary {
  results: FeedInterestSuggestionUserResult[];
}

export interface FeedInterestSuggestionJobListResponse {
  data: FeedInterestSuggestionJobSummary[];
}

export interface UserSearchItem {
  id: string;
  username: string;
  display_name: string;
}
