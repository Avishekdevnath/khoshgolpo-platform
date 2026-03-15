import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  FeedAIHealth,
  FeedAIPolicyUpdate,
  FeedConfig,
  FeedDebugResponse,
  FeedInterestSuggestionJobCreateResponse,
  FeedInterestSuggestionJobListResponse,
  FeedInterestSuggestionJobRequest,
  FeedInterestSuggestionJobResponse,
  FeedInterestSuggestionJobStatus,
  FeedMode,
  FeedThreadOverrideResponse,
  FeedThreadOverrideUpdate,
} from "@/types/feed";

export async function getAdminFeedConfig(): Promise<FeedConfig> {
  return apiGet<FeedConfig>("admin/feed/config");
}

export async function updateAdminFeedConfig(payload: {
  weights?: Partial<FeedConfig["weights"]>;
  ai_enabled?: boolean;
  ai_timeout_ms?: number;
  ai_daily_budget_usd?: number;
  reason?: string;
}): Promise<FeedConfig> {
  return apiPatch<FeedConfig>("admin/feed/config", payload);
}

export async function updateAdminFeedThreadOverride(
  threadId: string,
  payload: FeedThreadOverrideUpdate,
): Promise<FeedThreadOverrideResponse> {
  return apiPatch<FeedThreadOverrideResponse>(`admin/feed/threads/${threadId}/override`, payload);
}

export async function triggerAdminFeedRebuild(): Promise<{ success: boolean; processed: number; message: string }> {
  return apiPost<{ success: boolean; processed: number; message: string }>("admin/feed/rebuild", {});
}

export async function getAdminFeedDebug(
  userId: string,
  mode: FeedMode = "home",
  limit = 20,
): Promise<FeedDebugResponse> {
  return apiGet<FeedDebugResponse>(`admin/feed/debug?user_id=${userId}&mode=${mode}&limit=${limit}`);
}

export async function getAdminFeedAIHealth(): Promise<FeedAIHealth> {
  return apiGet<FeedAIHealth>("admin/feed/ai/health");
}

export async function updateAdminFeedAIPolicy(payload: FeedAIPolicyUpdate): Promise<FeedConfig> {
  return apiPatch<FeedConfig>("admin/feed/ai/policy", payload);
}

export async function createAdminFeedInterestSuggestionJob(
  payload: FeedInterestSuggestionJobRequest,
): Promise<FeedInterestSuggestionJobCreateResponse> {
  return apiPost<FeedInterestSuggestionJobCreateResponse>("admin/feed/interests/suggestions/jobs", payload);
}

export async function getAdminFeedInterestSuggestionJob(jobId: string): Promise<FeedInterestSuggestionJobResponse> {
  return apiGet<FeedInterestSuggestionJobResponse>(`admin/feed/interests/suggestions/jobs/${jobId}`);
}

export async function listAdminFeedInterestSuggestionJobs(options: {
  limit?: number;
  status?: FeedInterestSuggestionJobStatus;
} = {}): Promise<FeedInterestSuggestionJobListResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 20));
  if (options.status) {
    params.set("status", options.status);
  }
  return apiGet<FeedInterestSuggestionJobListResponse>(`admin/feed/interests/suggestions/jobs?${params.toString()}`);
}
