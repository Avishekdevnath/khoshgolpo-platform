import { api, apiGet, apiPost } from "@/lib/api";
import type {
  Conversation,
  ConversationListResponse,
  Message,
  MessageBlockStatusResponse,
  MessageListResponse,
  MessageUnreadCountResponse,
} from "@/types/message";

export async function getConversations(cursor?: string, limit: number = 50): Promise<ConversationListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiGet(`/messages/conversations?${params.toString()}`);
}

export async function createConversation(targetUserId: string): Promise<Conversation> {
  return apiPost("/messages/conversations", { target_user_id: targetUserId });
}

export async function getConversationMessages(
  conversationId: string,
  cursor?: string,
  limit: number = 50,
): Promise<MessageListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiGet(`/messages/conversations/${conversationId}/messages?${params.toString()}`);
}

export async function sendConversationMessage(conversationId: string, content: string): Promise<Message> {
  return apiPost(`/messages/conversations/${conversationId}/messages`, { content });
}

export async function markConversationRead(
  conversationId: string,
  lastReadMessageId?: string,
): Promise<MessageUnreadCountResponse> {
  return apiPost(`/messages/conversations/${conversationId}/read`, {
    last_read_message_id: lastReadMessageId ?? null,
  });
}

export async function getMessageUnreadCount(): Promise<MessageUnreadCountResponse> {
  return apiGet("/messages/unread-count");
}

export async function blockMessageUser(userId: string): Promise<MessageBlockStatusResponse> {
  return apiPost(`/messages/users/${userId}/block`, {});
}

export async function unblockMessageUser(userId: string): Promise<MessageBlockStatusResponse> {
  return api.delete(`messages/users/${userId}/block`).json<MessageBlockStatusResponse>();
}
