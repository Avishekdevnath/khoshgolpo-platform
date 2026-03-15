export type UserRole = "member" | "moderator" | "admin";
export type ThreadStatus = "open" | "closed" | "archived";
export type ModerationAction = "approve" | "reject";
export type ContentType = "thread" | "post";
export type AuditSeverity = "info" | "warning" | "critical";
export type AuditResult = "success" | "failed";
export type AppealStatus = "pending" | "approved" | "rejected";

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

export type AdminStats = {
  total_users: number;
  active_users: number;
  total_threads: number;
  total_posts: number;
  flagged_posts: number;
  deleted_posts: number;
  generated_at: string;
};

export type ModerationItem = {
  type: ContentType;
  id: string;
  thread_id: string | null;
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  title: string | null;
  content: string | null;
  status: ThreadStatus | null;
  ai_score: number | null;
  is_flagged: boolean | null;
  is_deleted: boolean;
  created_at: string;
};

export type AdminUserItem = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  is_bot: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminBulkModerationItem = {
  content_type: ContentType;
  content_id: string;
  action: ModerationAction;
  reason?: string;
};

export type AdminBulkModerationRequest = {
  actions: AdminBulkModerationItem[];
};

export type AdminBulkModerationResult = {
  content_type: ContentType;
  content_id: string;
  action: ModerationAction;
  success: boolean;
  error: string | null;
};

export type AdminBulkModerationResponse = {
  results: AdminBulkModerationResult[];
  processed: number;
  succeeded: number;
  failed: number;
};

export type AdminModerationListResponse = PaginatedResponse<ModerationItem> & {
  flagged_posts: number;
  flagged_threads: number;
};

export type AuditLogItem = {
  id: string;
  action: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_display_name: string | null;
  target_type: string;
  target_id: string | null;
  target_display_name: string | null;
  severity: AuditSeverity;
  result: AuditResult;
  request_id: string | null;
  ip: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type AuditLogListResponse = PaginatedResponse<AuditLogItem>;

export type AdminContentItem = {
  type: ContentType;
  id: string;
  thread_id: string | null;
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  title: string | null;
  content: string | null;
  status: ThreadStatus | null;
  is_pinned: boolean | null;
  ai_score: number | null;
  is_flagged: boolean | null;
  is_deleted: boolean;
  created_at: string;
};

export type AdminContentListResponse = PaginatedResponse<AdminContentItem> & {
  missing_ai_reports: number;
};

export type AdminContentRereportResponse = {
  processed: number;
  updated: number;
  failed: number;
  flagged: number;
  threads_updated: number;
  posts_updated: number;
};

export type AdminContentNotifyResponse = {
  success: boolean;
};

export type AdminThread = {
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
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminAppealItem = {
  id: string;
  notification_id: string;
  appellant_id: string;
  appellant_username: string | null;
  appellant_display_name: string | null;
  content_type: ContentType;
  content_id: string;
  thread_id: string | null;
  post_id: string | null;
  notification_message: string;
  reason: string;
  status: AppealStatus;
  admin_note: string | null;
  resolved_by: string | null;
  resolved_by_username: string | null;
  resolved_by_display_name: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminAppealListResponse = PaginatedResponse<AdminAppealItem> & {
  pending_count: number;
};

// ─── Bot types ────────────────────────────────────────────────────────────────

export type BotConfig = {
  id: string;
  bot_user_id: string;
  display_name: string;
  persona: string;
  enabled: boolean;
  topic_seeds: string[];
  channels: string[];
  thread_interval_hours: number;
  comment_interval_hours: number;
  engage_interval_hours: number;
  max_threads_per_day: number;
  max_comments_per_day: number;
  min_thread_replies: number;
  threads_created_today: number;
  comments_posted_today: number;
  last_thread_at: string | null;
  last_comment_at: string | null;
  last_engage_at: string | null;
  created_at: string;
  username: string;
  avatar_url: string | null;
};

export type CreateBotRequest = {
  username: string;
  display_name: string;
  email: string;
  bio?: string;
  avatar_url?: string;
  persona?: string;
  topic_seeds?: string[];
  channels?: string[];
  thread_interval_hours?: number;
  comment_interval_hours?: number;
  engage_interval_hours?: number;
  max_threads_per_day?: number;
  max_comments_per_day?: number;
  min_thread_replies?: number;
  enabled?: boolean;
};

export type UpdateBotIdentityRequest = {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  persona?: string;
};

export type BotActivityEntry = {
  id: string;
  action: string;
  created_at: string;
  details: Record<string, unknown>;
};

export type BotListResponse = {
  data: BotConfig[];
  total: number;
};

export type UpdateBotScheduleRequest = {
  topic_seeds?: string[];
  channels?: string[];
  thread_interval_hours?: number;  // float hours, e.g. 0.5 = 30 min
  comment_interval_hours?: number;
  engage_interval_hours?: number;
  max_threads_per_day?: number;
  max_comments_per_day?: number;
  min_thread_replies?: number;
};

export type BotContentItem = {
  id: string;
  kind: "thread" | "post";
  title: string | null;
  body: string;
  thread_id: string | null;
  thread_title: string | null;
  tags: string[];
  is_flagged: boolean;
  is_deleted: boolean;
  ai_score: number | null;
  post_count: number | null;
  created_at: string;
};

export type BotContentResponse = {
  data: BotContentItem[];
  total: number;
};

// ─── User detail / notes / bulk ──────────────────────────────────────────────

export type UserSortOption = "newest" | "oldest" | "name_az" | "name_za";

export type AdminNoteItem = {
  note: string;
  admin_id: string;
  admin_display_name: string | null;
  created_at: string;
};

export type AdminUserDetail = AdminUserItem & {
  total_posts: number;
  total_threads: number;
  followers_count: number;
  following_count: number;
  login_attempts: number;
  locked_until: string | null;
  last_login: string | null;
  admin_notes: AdminNoteItem[];
  recent_audit_logs: AuditLogItem[];
};

export type AdminBulkUserResult = {
  user_id: string;
  success: boolean;
  error: string | null;
};

export type AdminBulkUserResponse = {
  results: AdminBulkUserResult[];
  processed: number;
  succeeded: number;
  failed: number;
};
