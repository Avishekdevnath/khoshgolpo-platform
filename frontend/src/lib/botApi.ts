import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import type {
  BotActivityEntry,
  BotConfig,
  BotContentResponse,
  BotListResponse,
  CreateBotRequest,
  UpdateBotIdentityRequest,
  UpdateBotScheduleRequest,
} from "@/types/admin";

export async function listBots(): Promise<BotListResponse> {
  return apiGet<BotListResponse>("admin/bot");
}

export async function createBot(body: CreateBotRequest): Promise<{ bot_user_id: string; config_id: string }> {
  return apiPost<{ bot_user_id: string; config_id: string }>("admin/bot/create", body);
}

export async function setBotEnabled(configId: string, enabled: boolean): Promise<BotConfig> {
  return apiPatch<BotConfig>(`admin/bot/${configId}/enable`, { enabled });
}

export async function updateBotIdentity(configId: string, body: UpdateBotIdentityRequest): Promise<BotConfig> {
  return apiPut<BotConfig>(`admin/bot/${configId}/identity`, body);
}

export async function deleteBotConfig(configId: string): Promise<void> {
  return apiDelete(`admin/bot/${configId}`);
}

export async function triggerBotThread(configId: string): Promise<{ ok: boolean; message: string }> {
  return apiPost(`admin/bot/${configId}/trigger/thread`);
}

export async function triggerBotComment(configId: string): Promise<{ ok: boolean; message: string }> {
  return apiPost(`admin/bot/${configId}/trigger/comment`);
}

export async function triggerBotEngage(configId: string): Promise<{ ok: boolean; message: string }> {
  return apiPost(`admin/bot/${configId}/trigger/engage`);
}

export async function getBotActivity(configId: string): Promise<BotActivityEntry[]> {
  return apiGet<BotActivityEntry[]>(`admin/bot/${configId}/activity`);
}

export async function updateBotSchedule(configId: string, body: UpdateBotScheduleRequest): Promise<BotConfig> {
  return apiPatch<BotConfig>(`admin/bot/${configId}/schedule`, body);
}

export async function getBotContent(configId: string, limit = 40): Promise<BotContentResponse> {
  return apiGet<BotContentResponse>(`admin/bot/${configId}/content?limit=${limit}`);
}

export async function editBotThread(threadId: string, title: string, body: string): Promise<void> {
  return apiPatch(`admin/bot/content/thread/${threadId}`, { title, body });
}

export async function deleteBotThread(threadId: string): Promise<void> {
  return apiDelete(`admin/bot/content/thread/${threadId}`);
}

export async function archiveBotThread(threadId: string): Promise<void> {
  return apiPatch(`admin/bot/content/thread/${threadId}/archive`, {});
}

export async function editBotPost(postId: string, content: string): Promise<void> {
  return apiPatch(`admin/bot/content/post/${postId}`, { content });
}

export async function deleteBotPost(postId: string): Promise<void> {
  return apiDelete(`admin/bot/content/post/${postId}`);
}
