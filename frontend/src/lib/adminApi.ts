import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  AdminBulkModerationItem,
  AdminBulkModerationResponse,
  AdminBulkUserResponse,
  AdminAppealItem,
  AdminAppealListResponse,
  AdminContentListResponse,
  AdminModerationListResponse,
  AdminContentNotifyResponse,
  AdminContentRereportResponse,
  AdminUserDetail,
  AppealStatus,
  AdminStats,
  AdminThread,
  AdminContentItem,
  AdminUserItem,
  AuditLogListResponse,
  ModerationAction,
  PaginatedResponse,
  ThreadStatus,
  UserRole,
  UserSortOption,
} from "@/types/admin";

type ListUsersParams = {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  is_active?: boolean;
  sort?: UserSortOption;
};

type ListAuditParams = {
  page?: number;
  limit?: number;
  action?: string;
  target_type?: string;
  severity?: "info" | "warning" | "critical";
  result?: "success" | "failed";
  actor_id?: string;
  request_id?: string;
  date_from?: string;
  date_to?: string;
};

type ListAppealsParams = {
  page?: number;
  limit?: number;
  status?: AppealStatus;
};

type ListContentParams = {
  page?: number;
  limit?: number;
  type?: "all" | "thread" | "post";
  search?: string;
  is_deleted?: boolean;
  is_flagged?: boolean;
  status?: ThreadStatus;
};

type ContentTargetType = "thread" | "post";

function withQuery(path: string, params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    query.set(key, String(value));
  });
  const q = query.toString();
  if (!q) return path;
  return `${path}?${q}`;
}

export async function getAdminStats(): Promise<AdminStats> {
  return apiGet<AdminStats>("admin/stats");
}

export async function getAdminUsers(params: ListUsersParams = {}): Promise<PaginatedResponse<AdminUserItem>> {
  const path = withQuery("admin/users", {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    search: params.search?.trim() || undefined,
    role: params.role,
    is_active: params.is_active,
    sort: params.sort,
  });
  return apiGet<PaginatedResponse<AdminUserItem>>(path);
}

export async function updateAdminUserRole(userId: string, role: UserRole, reason?: string): Promise<AdminUserItem> {
  return apiPatch<AdminUserItem>(`admin/users/${userId}/role`, { role, reason: reason || undefined });
}

export async function updateAdminUserStatus(userId: string, is_active: boolean, reason?: string): Promise<AdminUserItem> {
  return apiPatch<AdminUserItem>(`admin/users/${userId}/status`, { is_active, reason: reason || undefined });
}

export async function getModerationQueue(page = 1, limit = 50): Promise<AdminModerationListResponse> {
  return apiGet<AdminModerationListResponse>(`admin/moderation?page=${page}&limit=${limit}`);
}

export async function moderatePost(postId: string, action: ModerationAction, reason?: string): Promise<AdminContentItem> {
  return apiPatch<AdminContentItem>(`admin/moderation/${postId}`, { action, reason: reason || undefined });
}

export async function moderateBulk(actions: AdminBulkModerationItem[]): Promise<AdminBulkModerationResponse> {
  return apiPost<AdminBulkModerationResponse>("admin/moderation/bulk", { actions });
}

export async function listAuditLogs(params: ListAuditParams = {}): Promise<AuditLogListResponse> {
  const path = withQuery("admin/audit-logs", {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    action: params.action?.trim() || undefined,
    target_type: params.target_type?.trim() || undefined,
    severity: params.severity,
    result: params.result,
    actor_id: params.actor_id?.trim() || undefined,
    request_id: params.request_id?.trim() || undefined,
    date_from: params.date_from,
    date_to: params.date_to,
  });
  return apiGet<AuditLogListResponse>(path);
}

export async function listAppeals(params: ListAppealsParams = {}): Promise<AdminAppealListResponse> {
  const path = withQuery("admin/appeals", {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    status: params.status,
  });
  return apiGet<AdminAppealListResponse>(path);
}

export async function resolveAppeal(
  appealId: string,
  action: "approve" | "reject",
  note?: string,
): Promise<AdminAppealItem> {
  return apiPatch<AdminAppealItem>(`admin/appeals/${appealId}`, {
    action,
    note: note || undefined,
  });
}

export async function listContent(params: ListContentParams = {}): Promise<AdminContentListResponse> {
  const path = withQuery("admin/content", {
    page: params.page ?? 1,
    limit: params.limit ?? 30,
    type: params.type ?? "all",
    search: params.search?.trim() || undefined,
    is_deleted: params.is_deleted,
    is_flagged: params.is_flagged,
    status: params.status,
  });
  return apiGet<AdminContentListResponse>(path);
}

export async function getAdminContentItem(
  contentType: ContentTargetType,
  contentId: string,
): Promise<AdminContentItem> {
  return apiGet<AdminContentItem>(`admin/content/${contentType}/${contentId}`);
}

export async function rereportMissingContentByAdmin(payload?: {
  limit?: number;
  include_deleted?: boolean;
}): Promise<AdminContentRereportResponse> {
  return apiPost<AdminContentRereportResponse>("admin/content/rereport-missing", {
    limit: payload?.limit ?? 200,
    include_deleted: payload?.include_deleted ?? false,
  });
}

export async function rereportAdminContentItem(
  contentType: ContentTargetType,
  contentId: string,
): Promise<AdminContentItem> {
  return apiPost<AdminContentItem>(`admin/content/${contentType}/${contentId}/rereport`);
}

export async function updateAdminContentFlag(
  contentType: ContentTargetType,
  contentId: string,
  is_flagged: boolean,
  reason?: string,
): Promise<AdminContentItem> {
  return apiPatch<AdminContentItem>(`admin/content/${contentType}/${contentId}/flag`, {
    is_flagged,
    reason: reason || undefined,
  });
}

export async function editAdminContentItem(
  contentType: ContentTargetType,
  contentId: string,
  payload: { title?: string; content?: string; reason?: string },
): Promise<AdminContentItem> {
  return apiPatch<AdminContentItem>(`admin/content/${contentType}/${contentId}/edit`, {
    title: payload.title,
    content: payload.content,
    reason: payload.reason || undefined,
  });
}

export async function notifyAdminContentAuthor(
  contentType: ContentTargetType,
  contentId: string,
  message: string,
  reason?: string,
): Promise<AdminContentNotifyResponse> {
  return apiPost<AdminContentNotifyResponse>(`admin/content/${contentType}/${contentId}/notify`, {
    message,
    reason: reason || undefined,
  });
}

export async function deleteThreadByAdmin(threadId: string, reason?: string): Promise<void> {
  const path = withQuery(`admin/threads/${threadId}`, { reason: reason?.trim() || undefined });
  await apiDelete(path);
}

export async function deletePostByAdmin(postId: string, reason?: string): Promise<void> {
  const path = withQuery(`admin/posts/${postId}`, { reason: reason?.trim() || undefined });
  await apiDelete(path);
}

export async function updateThreadStatusByAdmin(
  threadId: string,
  status: ThreadStatus,
  reason?: string,
): Promise<AdminThread> {
  return apiPatch<AdminThread>(`admin/threads/${threadId}/status`, { status, reason: reason || undefined });
}

export async function updateThreadPinByAdmin(
  threadId: string,
  is_pinned: boolean,
  reason?: string,
): Promise<AdminThread> {
  return apiPatch<AdminThread>(`admin/threads/${threadId}/pin`, { is_pinned, reason: reason || undefined });
}

// ─── User Detail / Notes / Bulk ─────────────────────────────────────────────

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  return apiGet<AdminUserDetail>(`admin/users/${userId}/detail`);
}

export async function addAdminUserNote(userId: string, note: string): Promise<AdminUserDetail> {
  return apiPost<AdminUserDetail>(`admin/users/${userId}/notes`, { note });
}

export async function bulkUpdateUserRole(
  userIds: string[],
  role: UserRole,
  reason?: string,
): Promise<AdminBulkUserResponse> {
  return apiPost<AdminBulkUserResponse>("admin/users/bulk-role", {
    user_ids: userIds,
    role,
    reason: reason || undefined,
  });
}

export async function bulkUpdateUserStatus(
  userIds: string[],
  isActive: boolean,
  reason?: string,
): Promise<AdminBulkUserResponse> {
  return apiPost<AdminBulkUserResponse>("admin/users/bulk-status", {
    user_ids: userIds,
    is_active: isActive,
    reason: reason || undefined,
  });
}
