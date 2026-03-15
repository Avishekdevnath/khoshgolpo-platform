import useSWR from "swr";

import { useAuthStore } from "@/store/authStore";
import {
  blockMessageUser,
  createConversation as createConversationRequest,
  getConversationMessages,
  getConversations,
  getMessageUnreadCount,
  markConversationRead as markConversationReadRequest,
  sendConversationMessage,
  unblockMessageUser,
} from "@/lib/messageApi";
import type {
  Conversation,
  ConversationListResponse,
  Message,
  MessageBlockStatusResponse,
  MessageListResponse,
  MessageUnreadCountResponse,
} from "@/types/message";

type UseMessagesOptions = {
  conversationId?: string;
  enabled?: boolean;
};

export function useMessages(options: UseMessagesOptions = {}) {
  const { conversationId, enabled = true } = options;
  const { isAuthenticated } = useAuthStore();
  const isEnabled = enabled && isAuthenticated();

  const conversationsKey = isEnabled ? "messages/conversations?limit=50" : null;
  const messagesKey = isEnabled && conversationId
    ? `messages/conversations/${conversationId}/messages?limit=50`
    : null;
  const unreadKey = isEnabled ? "messages/unread-count" : null;

  const conversationsState = useSWR<ConversationListResponse>(
    conversationsKey,
    async () => getConversations(undefined, 50),
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  const messagesState = useSWR<MessageListResponse>(
    messagesKey,
    async () => getConversationMessages(conversationId!, undefined, 50),
    {
      refreshInterval: conversationId ? 5000 : 0,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  const unreadState = useSWR<MessageUnreadCountResponse>(
    unreadKey,
    async () => getMessageUnreadCount(),
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  const conversations = conversationsState.data?.data ?? [];
  const activeConversation =
    messagesState.data?.conversation ??
    conversations.find((item) => item.id === conversationId) ??
    null;

  const refreshAll = async () => {
    await Promise.all([
      conversationsState.mutate(),
      messagesState.mutate(),
      unreadState.mutate(),
    ]);
  };

  const createConversation = async (targetUserId: string): Promise<Conversation> => {
    const conversation = await createConversationRequest(targetUserId);
    await Promise.all([conversationsState.mutate(), unreadState.mutate()]);
    return conversation;
  };

  const sendMessage = async (targetConversationId: string, content: string): Promise<Message> => {
    const message = await sendConversationMessage(targetConversationId, content);
    await Promise.all([messagesState.mutate(), conversationsState.mutate(), unreadState.mutate()]);
    return message;
  };

  const markRead = async (targetConversationId: string, lastReadMessageId?: string) => {
    const result = await markConversationReadRequest(targetConversationId, lastReadMessageId);
    await Promise.all([messagesState.mutate(), conversationsState.mutate(), unreadState.mutate()]);
    return result;
  };

  const blockUser = async (userId: string): Promise<MessageBlockStatusResponse> => {
    const result = await blockMessageUser(userId);
    await Promise.all([messagesState.mutate(), conversationsState.mutate()]);
    return result;
  };

  const unblockUser = async (userId: string): Promise<MessageBlockStatusResponse> => {
    const result = await unblockMessageUser(userId);
    await Promise.all([messagesState.mutate(), conversationsState.mutate()]);
    return result;
  };

  return {
    conversations,
    activeConversation,
    messages: messagesState.data?.data ?? [],
    unreadCount: unreadState.data?.unread_count ?? 0,
    conversationsLoading: conversationsState.isLoading,
    messagesLoading: messagesState.isLoading,
    unreadLoading: unreadState.isLoading,
    error: conversationsState.error ?? messagesState.error ?? unreadState.error ?? null,
    createConversation,
    sendMessage,
    markRead,
    blockUser,
    unblockUser,
    mutateConversations: conversationsState.mutate,
    mutateMessages: messagesState.mutate,
    mutateUnreadCount: unreadState.mutate,
    refreshAll,
  };
}

export function useMessageUnreadCount() {
  const { isAuthenticated } = useAuthStore();
  const { data, error, isLoading, mutate } = useSWR<MessageUnreadCountResponse>(
    isAuthenticated() ? "messages/unread-count" : null,
    async () => getMessageUnreadCount(),
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  return {
    unreadCount: data?.unread_count ?? 0,
    isLoading,
    error,
    mutate,
  };
}
