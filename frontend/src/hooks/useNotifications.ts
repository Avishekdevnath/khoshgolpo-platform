import useSWR from "swr";
import { api, apiPatch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export interface Notification {
  id: string;
  type: "reply" | "mention" | "follow" | "connection" | "message" | "moderation" | "system";
  recipient_id: string;
  actor_id: string | null;
  thread_id: string | null;
  post_id: string | null;
  message: string;
  metadata: {
    moderation_action?: string;
    appealable?: boolean;
    appeal_status?: "none" | "pending" | "approved" | "rejected";
    content_type?: "thread" | "post";
    content_id?: string;
    [key: string]: string | number | boolean | null | undefined;
  };
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
  page: number;
  limit: number;
  has_more: boolean;
}

type UseNotificationsOptions = {
  enabled?: boolean;
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: Notification["type"];
  refreshInterval?: number;
};

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { isAuthenticated } = useAuthStore();
  const {
    enabled = true,
    page = 1,
    limit = 50,
    isRead,
    type,
    refreshInterval = 5000,
  } = options;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (isRead !== undefined) params.append("is_read", String(isRead));
  if (type) params.append("type", type);

  // Only fetch if authenticated
  const { data, error, isLoading, mutate } = useSWR<NotificationListResponse>(
    enabled && isAuthenticated() ? `notifications?${params.toString()}` : null,
    async (url: string) => api.get(url).json(),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval,
    }
  );

  const toError = (error: unknown): Error =>
    error instanceof Error ? error : new Error("Notification action failed");

  const markAsRead = async (notificationId: string) => {
    const previous = data;
    mutate(
      (current) => {
        if (!current) return current;
        let unread = current.unread_count;
        const items = current.items.map((item) => {
          if (item.id !== notificationId || item.is_read) return item;
          unread = Math.max(0, unread - 1);
          return { ...item, is_read: true };
        });
        return { ...current, items, unread_count: unread };
      },
      { revalidate: false }
    );

    try {
      await apiPatch(`/notifications/${notificationId}/read`, {});
      await mutate();
    } catch (error) {
      if (previous) {
        mutate(previous, { revalidate: false });
      }
      throw toError(error);
    }
  };

  const markAllAsRead = async () => {
    const previous = data;
    mutate(
      (current) => {
        if (!current) return current;
        const items = current.items.map((item) => ({ ...item, is_read: true }));
        return { ...current, items, unread_count: 0 };
      },
      { revalidate: false }
    );

    try {
      await apiPatch("/notifications/read-all", {});
      await mutate();
    } catch (error) {
      if (previous) {
        mutate(previous, { revalidate: false });
      }
      throw toError(error);
    }
  };

  const unreadCount = data?.unread_count || 0;

  return {
    notifications: data?.items || [],
    page: data?.page ?? page,
    limit: data?.limit ?? limit,
    total: data?.total || 0,
    hasMore: data?.has_more ?? false,
    unreadCount,
    isLoading,
    error,
    mutate,
    markAsRead,
    markAllAsRead,
  };
}
