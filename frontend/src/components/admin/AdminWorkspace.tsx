"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Check,
  ClipboardList,
  FileText,
  Flag,
  Gavel,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from "lucide-react";

import {
  bulkUpdateUserRole,
  bulkUpdateUserStatus,
  deletePostByAdmin,
  deleteThreadByAdmin,
  editAdminContentItem,
  getAdminStats,
  getAdminUsers,
  getModerationQueue,
  listAppeals,
  listAuditLogs,
  listContent,
  moderateBulk,
  notifyAdminContentAuthor,
  rereportAdminContentItem,
  resolveAppeal,
  rereportMissingContentByAdmin,
  updateAdminContentFlag,
  updateAdminUserRole,
  updateAdminUserStatus,
  updateThreadPinByAdmin,
  updateThreadStatusByAdmin,
} from "@/lib/adminApi";
import { getAdminFeedAIHealth, getAdminFeedConfig } from "@/lib/adminFeedApi";
import WorkspaceShell from "@/components/app/WorkspaceShell";
import { profilePathFromUsername, toProfilePath } from "@/lib/profileRouting";
import { downloadCsv, downloadJson } from "@/lib/workspaceUtils";
import { useAuthStore } from "@/store/authStore";
import AuditTab from "@/components/admin/tabs/AuditTab";
import ContentTab from "@/components/admin/tabs/ContentTab";
import ModerationTab from "@/components/admin/tabs/ModerationTab";
import OverviewTab from "@/components/admin/tabs/OverviewTab";
import AppealsTab from "@/components/admin/tabs/AppealsTab";
import UsersTab from "@/components/admin/tabs/UsersTab";
import BulkConfirmModal from "@/components/admin/tabs/BulkConfirmModal";
import UserDetailDrawer from "@/components/admin/tabs/UserDetailDrawer";
import AppealRejectModal from "@/components/admin/shared/AppealRejectModal";
import BotTab from "@/components/admin/tabs/BotTab";
import type {
  AdminContentItem,
  AdminAppealItem,
  AdminStats,
  AdminUserItem,
  AppealStatus,
  AuditLogItem,
  ModerationAction,
  ModerationItem,
  ThreadStatus,
  UserRole,
  UserSortOption,
} from "@/types/admin";
import type { FeedAIHealth, FeedConfig } from "@/types/feed";

type Tab = "overview" | "moderation" | "appeals" | "users" | "content" | "removed" | "audit" | "bot";
type BoolFilter = "" | "true" | "false";
type AdminWorkspaceProps = {
  initialTab?: Tab;
};

function toBool(value: BoolFilter): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseAuditPage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function parseAuditSeverity(value: string | null): "" | "info" | "warning" | "critical" {
  if (value === "info" || value === "warning" || value === "critical") return value;
  return "";
}

function parseAuditResult(value: string | null): "" | "success" | "failed" {
  if (value === "success" || value === "failed") return value;
  return "";
}

function parseAuditDate(value: string | null): string {
  if (!value) return "";
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

function parseUserRole(value: string | null): UserRole | "" {
  if (value === "admin" || value === "moderator" || value === "member") return value;
  return "";
}

function parseUserSort(value: string | null): UserSortOption {
  if (value === "oldest" || value === "name_az" || value === "name_za") return value;
  return "newest";
}

function parseUserStatus(value: string | null): "active" | "inactive" | "" {
  if (value === "active" || value === "inactive") return value;
  return "";
}

function moderationItemKey(item: Pick<ModerationItem, "type" | "id">): string {
  return `${item.type}:${item.id}`;
}

export default function AdminWorkspace({ initialTab = "overview" }: AdminWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [feedConfig, setFeedConfig] = useState<FeedConfig | null>(null);
  const [feedAIHealth, setFeedAIHealth] = useState<FeedAIHealth | null>(null);
  const [feedReadError, setFeedReadError] = useState<string | null>(null);

  const [modItems, setModItems] = useState<ModerationItem[]>([]);
  const [modTotal, setModTotal] = useState(0);
  const [modFlaggedPosts, setModFlaggedPosts] = useState(0);
  const [modFlaggedThreads, setModFlaggedThreads] = useState(0);
  const [modSelectedIds, setModSelectedIds] = useState<string[]>([]);
  const [modActionLoading, setModActionLoading] = useState<string | null>(null);
  const [modBulkLoading, setModBulkLoading] = useState(false);
  const [modRefreshing, setModRefreshing] = useState(false);

  const [appeals, setAppeals] = useState<AdminAppealItem[]>([]);
  const [appealsTotal, setAppealsTotal] = useState(0);
  const [appealsPending, setAppealsPending] = useState(0);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealsStatus, setAppealsStatus] = useState<"" | AppealStatus>("pending");
  const [appealsActionLoading, setAppealsActionLoading] = useState<string | null>(null);
  const [appealRejectTarget, setAppealRejectTarget] = useState<AdminAppealItem | null>(null);

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSearch, setUserSearch] = useState(() => searchParams.get("u_search") ?? "");
  const [userSort, setUserSort] = useState<UserSortOption>(() => parseUserSort(searchParams.get("u_sort")));
  const [userRole, setUserRole] = useState<UserRole | "">(() => parseUserRole(searchParams.get("u_role")));
  const [userIsActive, setUserIsActive] = useState<"active" | "inactive" | "">(() => parseUserStatus(searchParams.get("u_status")));
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);
  const [userBulkLoading, setUserBulkLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userDetailId, setUserDetailId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<{ type: "role" | "activate" | "deactivate"; role?: UserRole } | null>(null);

  const [contentItems, setContentItems] = useState<AdminContentItem[]>([]);
  const [contentTotal, setContentTotal] = useState(0);
  const [removedTotal, setRemovedTotal] = useState(0);
  const [contentMissingAiReports, setContentMissingAiReports] = useState(0);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSearch, setContentSearch] = useState("");
  const [contentType, setContentType] = useState<"all" | "thread" | "post">("all");
  const [contentStatus, setContentStatus] = useState<"" | ThreadStatus>("");
  const [contentDeleted, setContentDeleted] = useState<BoolFilter>(initialTab === "removed" ? "true" : "");
  const [contentFlagged, setContentFlagged] = useState<BoolFilter>("");
  const [contentActionLoading, setContentActionLoading] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const auditLimit = 20;
  const [auditPage, setAuditPage] = useState(() => parseAuditPage(searchParams.get("page")));
  const [auditAction, setAuditAction] = useState(() => searchParams.get("action") ?? "");
  const [auditTargetType, setAuditTargetType] = useState(() => searchParams.get("target_type") ?? "");
  const [auditSeverity, setAuditSeverity] = useState<"" | "info" | "warning" | "critical">(() =>
    parseAuditSeverity(searchParams.get("severity")),
  );
  const [auditResult, setAuditResult] = useState<"" | "success" | "failed">(() => parseAuditResult(searchParams.get("result")));
  const [auditActorId, setAuditActorId] = useState(() => searchParams.get("actor_id") ?? "");
  const [auditRequestId, setAuditRequestId] = useState(() => searchParams.get("request_id") ?? "");
  const [auditDateFrom, setAuditDateFrom] = useState(() => parseAuditDate(searchParams.get("date_from")));
  const [auditDateTo, setAuditDateTo] = useState(() => parseAuditDate(searchParams.get("date_to")));
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / auditLimit));

  const contentFilters = useMemo(
    () => ({
      type: contentType,
      search: contentSearch.trim() || undefined,
      status: contentStatus || undefined,
      is_deleted: toBool(contentDeleted),
      is_flagged: toBool(contentFlagged),
    }),
    [contentDeleted, contentFlagged, contentSearch, contentStatus, contentType],
  );

  const auditFilters = useMemo(
    () => ({
      page: auditPage,
      limit: auditLimit,
      action: auditAction.trim() || undefined,
      target_type: auditTargetType.trim() || undefined,
      severity: auditSeverity || undefined,
      result: auditResult || undefined,
      actor_id: auditActorId.trim() || undefined,
      request_id: auditRequestId.trim() || undefined,
      date_from: auditDateFrom ? `${auditDateFrom}T00:00:00Z` : undefined,
      date_to: auditDateTo ? `${auditDateTo}T23:59:59Z` : undefined,
    }),
    [auditAction, auditActorId, auditDateFrom, auditDateTo, auditPage, auditRequestId, auditResult, auditSeverity, auditTargetType],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Tab items with badges
  const tabs: { key: Tab; label: string; icon: typeof Users; badge?: number }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "moderation", label: "Moderation", icon: Flag, badge: modTotal },
    { key: "appeals", label: "Appeals", icon: Gavel, badge: appealsPending },
    { key: "users", label: "Users", icon: Users, badge: usersTotal },
    { key: "content", label: "Content", icon: FileText, badge: contentTotal },
    { key: "removed", label: "Removed", icon: Trash2, badge: removedTotal },
    { key: "audit", label: "Audit", icon: ClipboardList, badge: auditTotal },
    { key: "bot", label: "Bots", icon: Bot },
  ];

  useEffect(() => {
    setTab(initialTab);
    if (initialTab === "removed") {
      setContentDeleted("true");
    }
  }, [initialTab]);

  useEffect(() => {
    if (tab !== "audit") return;

    const nextPage = parseAuditPage(searchParams.get("page"));
    const nextAction = searchParams.get("action") ?? "";
    const nextTargetType = searchParams.get("target_type") ?? "";
    const nextSeverity = parseAuditSeverity(searchParams.get("severity"));
    const nextResult = parseAuditResult(searchParams.get("result"));
    const nextActorId = searchParams.get("actor_id") ?? "";
    const nextRequestId = searchParams.get("request_id") ?? "";
    const nextDateFrom = parseAuditDate(searchParams.get("date_from"));
    const nextDateTo = parseAuditDate(searchParams.get("date_to"));

    setAuditPage(prev => (prev === nextPage ? prev : nextPage));
    setAuditAction(prev => (prev === nextAction ? prev : nextAction));
    setAuditTargetType(prev => (prev === nextTargetType ? prev : nextTargetType));
    setAuditSeverity(prev => (prev === nextSeverity ? prev : nextSeverity));
    setAuditResult(prev => (prev === nextResult ? prev : nextResult));
    setAuditActorId(prev => (prev === nextActorId ? prev : nextActorId));
    setAuditRequestId(prev => (prev === nextRequestId ? prev : nextRequestId));
    setAuditDateFrom(prev => (prev === nextDateFrom ? prev : nextDateFrom));
    setAuditDateTo(prev => (prev === nextDateTo ? prev : nextDateTo));
  }, [searchParams, tab]);

  useEffect(() => {
    if (tab !== "audit") return;

    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    if (auditPage > 1) params.set("page", String(auditPage));
    else params.delete("page");
    setOrDelete("action", auditAction.trim());
    setOrDelete("target_type", auditTargetType.trim());
    setOrDelete("severity", auditSeverity);
    setOrDelete("result", auditResult);
    setOrDelete("actor_id", auditActorId.trim());
    setOrDelete("request_id", auditRequestId.trim());
    setOrDelete("date_from", auditDateFrom);
    setOrDelete("date_to", auditDateTo);

    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();
    if (currentQuery === nextQuery) return;

    const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextPath, { scroll: false });
  }, [
    auditAction,
    auditActorId,
    auditDateFrom,
    auditDateTo,
    auditPage,
    auditRequestId,
    auditResult,
    auditSeverity,
    auditTargetType,
    pathname,
    router,
    searchParams,
    tab,
  ]);

  // Users tab URL sync — read from URL
  useEffect(() => {
    if (tab !== "users") return;
    const nextSearch = searchParams.get("u_search") ?? "";
    const nextSort = parseUserSort(searchParams.get("u_sort"));
    const nextRole = parseUserRole(searchParams.get("u_role"));
    const nextStatus = parseUserStatus(searchParams.get("u_status"));
    setUserSearch(prev => (prev === nextSearch ? prev : nextSearch));
    setUserSort(prev => (prev === nextSort ? prev : nextSort));
    setUserRole(prev => (prev === nextRole ? prev : nextRole));
    setUserIsActive(prev => (prev === nextStatus ? prev : nextStatus));
  }, [searchParams, tab]);

  // Users tab URL sync — write to URL
  useEffect(() => {
    if (tab !== "users") return;
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete("u_search", userSearch.trim());
    setOrDelete("u_sort", userSort === "newest" ? "" : userSort);
    setOrDelete("u_role", userRole);
    setOrDelete("u_status", userIsActive);
    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();
    if (currentQuery === nextQuery) return;
    const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextPath, { scroll: false });
  }, [userSearch, userSort, userRole, userIsActive, tab, pathname, router, searchParams]);

  const openTab = useCallback(
    (nextTab: Tab) => {
      if (nextTab === tab) return;
      if (nextTab === "removed") {
        setContentType("all");
        setContentStatus("");
        setContentFlagged("");
        setContentDeleted("true");
      } else if (tab === "removed" && nextTab === "content") {
        setContentDeleted("");
      }
      setTab(nextTab);
      router.push(`/admin/${nextTab}`);
    },
    [router, tab],
  );


  const loadStats = useCallback(async () => {
    const res = await getAdminStats();
    setStats(res);
  }, []);

  const loadFeedReadSurface = useCallback(async () => {
    setFeedReadError(null);
    try {
      const [config, health] = await Promise.all([getAdminFeedConfig(), getAdminFeedAIHealth()]);
      setFeedConfig(config);
      setFeedAIHealth(health);
    } catch {
      setFeedReadError("Feed config endpoints are unavailable.");
      setFeedConfig(null);
      setFeedAIHealth(null);
    }
  }, []);

  const loadModeration = useCallback(async () => {
    const pageSize = 100;
    const first = await getModerationQueue(1, pageSize);
    const totalPages = Math.max(1, Math.ceil(first.total / pageSize));
    let allItems = first.data;

    if (totalPages > 1) {
      const remaining = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, idx) => getModerationQueue(idx + 2, pageSize)),
      );
      allItems = [...first.data, ...remaining.flatMap(page => page.data)];
    }

    setModItems(allItems);
    setModTotal(first.total);
    setModFlaggedPosts(first.flagged_posts);
    setModFlaggedThreads(first.flagged_threads);
    setModSelectedIds(prev => prev.filter(id => allItems.some(item => moderationItemKey(item) === id)));
  }, []);

  const loadUsers = useCallback(async (search: string, sort: UserSortOption, role: UserRole | "" = "", isActive: "active" | "inactive" | "" = "") => {
    const res = await getAdminUsers({
      page: 1,
      limit: 50,
      search: search.trim() || undefined,
      sort,
      role: role || undefined,
      is_active: isActive === "active" ? true : isActive === "inactive" ? false : undefined,
    });
    setUsers(res.data);
    setUsersTotal(res.total);
    setSelectedUserIds(prev => {
      const next = new Set<string>();
      const currentIds = new Set(res.data.map(item => item.id));
      prev.forEach(id => {
        if (currentIds.has(id)) next.add(id);
      });
      return next;
    });
  }, []);

  const loadContent = useCallback(async () => {
    setContentLoading(true);
    try {
      const [res, removedRes] = await Promise.all([
        listContent({ page: 1, limit: 40, ...contentFilters }),
        listContent({ page: 1, limit: 1, type: "all", is_deleted: true }),
      ]);
      setContentItems(res.data);
      setContentTotal(res.total);
      setContentMissingAiReports(res.missing_ai_reports);
      setRemovedTotal(removedRes.total);
    } finally {
      setContentLoading(false);
    }
  }, [contentFilters]);

  const upsertContentItem = useCallback((updated: AdminContentItem) => {
    setContentItems(prev => prev.map(item => (item.id === updated.id && item.type === updated.type ? updated : item)));
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await listAuditLogs(auditFilters);
      setAuditLogs(res.data);
      setAuditTotal(res.total);
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilters]);

  const loadAppeals = useCallback(async () => {
    setAppealsLoading(true);
    try {
      const res = await listAppeals({
        page: 1,
        limit: 80,
        status: appealsStatus || undefined,
      });
      setAppeals(res.data);
      setAppealsTotal(res.total);
      setAppealsPending(res.pending_count);
    } finally {
      setAppealsLoading(false);
    }
  }, [appealsStatus]);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadStats(),
        loadModeration(),
        loadUsers(userSearch, userSort, userRole, userIsActive),
        loadContent(),
        loadAudit(),
        loadAppeals(),
        loadFeedReadSurface(),
      ]);
      setBootstrapped(true);
    } catch {
      setError("Failed to load admin data. Make sure you have admin access.");
    } finally {
      setLoading(false);
    }
  }, [
    loadAppeals,
    loadAudit,
    loadContent,
    loadFeedReadSurface,
    loadModeration,
    loadStats,
    loadUsers,
    userSearch,
    userSort,
    userRole,
    userIsActive,
  ]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    void reloadAll();
  }, [reloadAll, user]);

  useEffect(() => {
    if (!bootstrapped) return;
    const t = setTimeout(() => void loadUsers(userSearch, userSort, userRole, userIsActive), 350);
    return () => clearTimeout(t);
  }, [bootstrapped, loadUsers, userSearch, userSort, userRole, userIsActive]);

  useEffect(() => {
    if (!bootstrapped) return;
    const t = setTimeout(() => void loadContent(), 350);
    return () => clearTimeout(t);
  }, [bootstrapped, loadContent]);

  useEffect(() => {
    if (tab !== "removed") return;
    if (contentDeleted === "true") return;
    setContentDeleted("true");
  }, [contentDeleted, tab]);

  useEffect(() => {
    if (!bootstrapped) return;
    const t = setTimeout(() => void loadAudit(), 350);
    return () => clearTimeout(t);
  }, [bootstrapped, loadAudit]);

  useEffect(() => {
    if (!bootstrapped) return;
    const t = setTimeout(() => void loadAppeals(), 350);
    return () => clearTimeout(t);
  }, [bootstrapped, loadAppeals]);

  const handleModerate = useCallback(
    async (item: ModerationItem, action: ModerationAction) => {
      const key = moderationItemKey(item);
      setModActionLoading(`moderate:${key}`);
      try {
        const res = await moderateBulk([{ content_type: item.type, content_id: item.id, action }]);
        const result = res.results[0];
        if (!result?.success) {
          throw new Error(result?.error ?? "moderation_failed");
        }
        setToast({ type: "ok", text: action === "approve" ? `${item.type} approved` : `${item.type} removed` });
        await Promise.all([loadModeration(), loadStats(), loadContent()]);
      } catch {
        setToast({ type: "err", text: "Moderation action failed" });
      } finally {
        setModActionLoading(null);
      }
    },
    [loadContent, loadModeration, loadStats],
  );

  const handleBulkModerate = useCallback(
    async (action: ModerationAction) => {
      if (modSelectedIds.length === 0) return;
      const ok = window.confirm(`${action === "approve" ? "Approve" : "Remove"} ${modSelectedIds.length} selected item(s)?`);
      if (!ok) return;

      const selected = modItems.filter(item => modSelectedIds.includes(moderationItemKey(item)));
      if (selected.length === 0) {
        setModSelectedIds([]);
        return;
      }

      setModBulkLoading(true);
      try {
        const res = await moderateBulk(selected.map(item => ({ content_type: item.type, content_id: item.id, action })));
        setToast({
          type: res.failed === 0 ? "ok" : "err",
          text: `${res.succeeded}/${res.processed} moderation actions completed`,
        });
        setModSelectedIds([]);
        await Promise.all([loadModeration(), loadStats(), loadContent()]);
      } catch {
        setToast({ type: "err", text: "Bulk moderation failed" });
      } finally {
        setModBulkLoading(false);
      }
    },
    [loadContent, loadModeration, loadStats, modItems, modSelectedIds],
  );

  const handleModerationCheck = useCallback(
    async (item: ModerationItem) => {
      const key = moderationItemKey(item);
      setModActionLoading(`check:${key}`);
      try {
        await rereportAdminContentItem(item.type, item.id);
        setToast({ type: "ok", text: `${item.type} checked with AI` });
        await Promise.all([loadModeration(), loadStats(), loadContent()]);
      } catch {
        setToast({ type: "err", text: "AI check failed" });
      } finally {
        setModActionLoading(null);
      }
    },
    [loadContent, loadModeration, loadStats],
  );

  const handleModerationRefresh = useCallback(async () => {
    setModRefreshing(true);
    try {
      await Promise.all([loadModeration(), loadStats()]);
      setToast({ type: "ok", text: "Moderation queue refreshed" });
    } catch {
      setToast({ type: "err", text: "Failed to refresh moderation queue" });
    } finally {
      setModRefreshing(false);
    }
  }, [loadModeration, loadStats]);

  const resolveAppealItem = useCallback(
    async (item: AdminAppealItem, action: "approve" | "reject", note?: string) => {
      setAppealsActionLoading(`resolve:${item.id}`);
      try {
        await resolveAppeal(item.id, action, note);
        setToast({ type: "ok", text: action === "approve" ? "Appeal approved" : "Appeal rejected" });
        await Promise.all([loadAppeals(), loadContent(), loadModeration(), loadStats()]);
      } catch {
        setToast({ type: "err", text: "Failed to resolve appeal" });
        throw new Error("Failed to resolve appeal");
      } finally {
        setAppealsActionLoading(null);
      }
    },
    [loadAppeals, loadContent, loadModeration, loadStats],
  );

  const handleResolveAppeal = useCallback(
    (item: AdminAppealItem, action: "approve" | "reject") => {
      if (action === "reject") {
        setAppealRejectTarget(item);
        return;
      }
      void resolveAppealItem(item, action);
    },
    [resolveAppealItem],
  );

  const handleRejectAppealSubmit = useCallback(async (note: string) => {
    if (!appealRejectTarget) {
      throw new Error("Appeal target is missing");
    }
    await resolveAppealItem(appealRejectTarget, "reject", note.trim() || undefined);
    setAppealRejectTarget(null);
  }, [appealRejectTarget, resolveAppealItem]);

  const handleUserRoleChange = useCallback(async (targetUser: AdminUserItem, role: UserRole) => {
    if (targetUser.role === role) return;
    setUserActionLoading(`role:${targetUser.id}`);
    try {
      const updated = await updateAdminUserRole(targetUser.id, role);
      setUsers(prev => prev.map(item => (item.id === targetUser.id ? { ...item, role: updated.role } : item)));
      setToast({ type: "ok", text: `${targetUser.username} role updated` });
    } catch {
      setToast({ type: "err", text: "Failed to update role" });
    } finally {
      setUserActionLoading(null);
    }
  }, []);

  const handleUserStatusToggle = useCallback(
    async (targetUser: AdminUserItem) => {
      const nextStatus = !targetUser.is_active;
      const ok = window.confirm(`${nextStatus ? "Activate" : "Deactivate"} @${targetUser.username}?`);
      if (!ok) return;

      setUserActionLoading(`status:${targetUser.id}`);
      try {
        const updated = await updateAdminUserStatus(targetUser.id, nextStatus);
        setUsers(prev => prev.map(item => (item.id === targetUser.id ? { ...item, is_active: updated.is_active } : item)));
        await loadStats();
        setToast({ type: "ok", text: nextStatus ? "User activated" : "User deactivated" });
      } catch {
        setToast({ type: "err", text: "Failed to update status" });
      } finally {
        setUserActionLoading(null);
      }
    },
    [loadStats],
  );

  const handleToggleUserSelect = useCallback((id: string, checked: boolean) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleToggleAllUsers = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedUserIds(new Set());
        return;
      }
      setSelectedUserIds(new Set(users.map(item => item.id)));
    },
    [users],
  );

  const handleUserDetailUpdated = useCallback(async () => {
    await Promise.all([loadUsers(userSearch, userSort, userRole, userIsActive), loadStats()]);
  }, [loadStats, loadUsers, userSearch, userSort, userRole, userIsActive]);

  const handleRequestBulkRoleChange = useCallback((role: UserRole) => {
    if (selectedUserIds.size === 0) return;
    setBulkAction({ type: "role", role });
  }, [selectedUserIds]);

  const handleRequestBulkActivate = useCallback(() => {
    if (selectedUserIds.size === 0) return;
    setBulkAction({ type: "activate" });
  }, [selectedUserIds]);

  const handleRequestBulkDeactivate = useCallback(() => {
    if (selectedUserIds.size === 0) return;
    setBulkAction({ type: "deactivate" });
  }, [selectedUserIds]);

  const handleConfirmBulkAction = useCallback(async () => {
    if (!bulkAction || selectedUserIds.size === 0) {
      setBulkAction(null);
      return;
    }

    const userIds = Array.from(selectedUserIds);
    setUserBulkLoading(true);
    try {
      let result;
      if (bulkAction.type === "role") {
        if (!bulkAction.role) {
          setToast({ type: "err", text: "Missing role for bulk update" });
          return;
        }
        result = await bulkUpdateUserRole(userIds, bulkAction.role);
      } else {
        result = await bulkUpdateUserStatus(userIds, bulkAction.type === "activate");
      }
      setToast({
        type: result.failed === 0 ? "ok" : "err",
        text: `${result.succeeded}/${result.processed} users updated`,
      });
      setSelectedUserIds(new Set());
      setBulkAction(null);
      await Promise.all([loadUsers(userSearch, userSort, userRole, userIsActive), loadStats()]);
    } catch {
      setToast({ type: "err", text: "Bulk user update failed" });
    } finally {
      setUserBulkLoading(false);
    }
  }, [bulkAction, loadStats, loadUsers, selectedUserIds, userSearch, userSort, userRole, userIsActive]);

  const handleExportUsers = useCallback(async (format: "csv" | "json") => {
    try {
      const res = await getAdminUsers({
        page: 1,
        limit: 1000,
        search: userSearch.trim() || undefined,
        sort: userSort,
        role: userRole || undefined,
        is_active: userIsActive === "active" ? true : userIsActive === "inactive" ? false : undefined,
      });
      const filename = `users-${new Date().toISOString().slice(0, 10)}`;
      if (format === "csv") downloadCsv(res.data as Record<string, unknown>[], `${filename}.csv`);
      else downloadJson(res.data, `${filename}.json`);
    } catch {
      setToast({ type: "err", text: "Export failed" });
    }
  }, [userSearch, userSort, userRole, userIsActive]);

  const handleExportAudit = useCallback(async (format: "csv" | "json") => {
    try {
      const res = await listAuditLogs({ ...auditFilters, limit: 500, page: 1 });
      const filename = `audit-${new Date().toISOString().slice(0, 10)}`;
      if (format === "csv") downloadCsv(res.data as Record<string, unknown>[], `${filename}.csv`);
      else downloadJson(res.data, `${filename}.json`);
    } catch {
      setToast({ type: "err", text: "Export failed" });
    }
  }, [auditFilters]);

  const handleDeleteContent = useCallback(
    async (item: AdminContentItem) => {
      const ok = window.confirm(`Delete this ${item.type}?`);
      if (!ok) return;

      setContentActionLoading(`delete:${item.type}:${item.id}`);
      try {
        if (item.type === "thread") await deleteThreadByAdmin(item.id);
        else await deletePostByAdmin(item.id);
        setToast({ type: "ok", text: `${item.type} deleted` });
        await Promise.all([loadContent(), loadStats(), loadModeration()]);
      } catch {
        setToast({ type: "err", text: "Failed to delete content" });
      } finally {
        setContentActionLoading(null);
      }
    },
    [loadContent, loadModeration, loadStats],
  );

  const handleThreadStatusChange = useCallback(async (item: AdminContentItem, status: ThreadStatus) => {
    if (item.type !== "thread") return;
    setContentActionLoading(`status:${item.id}`);
    try {
      const updated = await updateThreadStatusByAdmin(item.id, status);
      setContentItems(prev => prev.map(content => (content.id === item.id && content.type === "thread" ? { ...content, status: updated.status } : content)));
      setToast({ type: "ok", text: "Thread status updated" });
    } catch {
      setToast({ type: "err", text: "Failed to update thread status" });
    } finally {
      setContentActionLoading(null);
    }
  }, []);

  const handleThreadPinToggle = useCallback(async (item: AdminContentItem) => {
    if (item.type !== "thread") return;
    setContentActionLoading(`pin:${item.id}`);
    try {
      const updated = await updateThreadPinByAdmin(item.id, !item.is_pinned);
      setContentItems(prev => prev.map(content => (content.id === item.id && content.type === "thread" ? { ...content, is_pinned: updated.is_pinned } : content)));
      setToast({ type: "ok", text: updated.is_pinned ? "Thread pinned" : "Thread unpinned" });
    } catch {
      setToast({ type: "err", text: "Failed to update pin status" });
    } finally {
      setContentActionLoading(null);
    }
  }, []);

  const handleContentRereportMissing = useCallback(async () => {
    const ok = window.confirm(`Run AI re-report for ${contentMissingAiReports} item(s) without reports?`);
    if (!ok) return;

    setContentActionLoading("rereport:missing");
    try {
      const res = await rereportMissingContentByAdmin({ limit: 500, include_deleted: false });
      setToast({
        type: res.failed === 0 ? "ok" : "err",
        text: `AI re-report: ${res.updated}/${res.processed} updated, ${res.flagged} flagged`,
      });
      await Promise.all([loadContent(), loadStats(), loadModeration()]);
    } catch {
      setToast({ type: "err", text: "Failed to run missing AI re-report" });
    } finally {
      setContentActionLoading(null);
    }
  }, [contentMissingAiReports, loadContent, loadModeration, loadStats]);

  const handleContentRereportItem = useCallback(
    async (item: AdminContentItem) => {
      setContentActionLoading(`rereport:${item.type}:${item.id}`);
      try {
        const updated = await rereportAdminContentItem(item.type, item.id);
        upsertContentItem(updated);
        setToast({ type: "ok", text: `${item.type} re-reported with AI` });
        await Promise.all([loadModeration(), loadStats(), loadContent()]);
      } catch {
        setToast({ type: "err", text: "Failed to re-report content item" });
      } finally {
        setContentActionLoading(null);
      }
    },
    [loadContent, loadModeration, loadStats, upsertContentItem],
  );

  const handleContentFlagToggle = useCallback(
    async (item: AdminContentItem) => {
      const nextFlag = !Boolean(item.is_flagged);
      setContentActionLoading(`flag:${item.type}:${item.id}`);
      try {
        const updated = await updateAdminContentFlag(item.type, item.id, nextFlag);
        upsertContentItem(updated);
        setToast({ type: "ok", text: nextFlag ? "Item flagged" : "Item unflagged" });
        await Promise.all([loadModeration(), loadStats(), loadContent()]);
      } catch {
        setToast({ type: "err", text: "Failed to update flag state" });
      } finally {
        setContentActionLoading(null);
      }
    },
    [loadContent, loadModeration, loadStats, upsertContentItem],
  );

  const handleContentEdit = useCallback(
    async (item: AdminContentItem) => {
      if (item.type === "thread") {
        const nextTitle = window.prompt("Edit thread title", item.title ?? "");
        if (nextTitle === null) return;
        const nextBody = window.prompt("Edit thread content", item.content ?? "");
        if (nextBody === null) return;

        setContentActionLoading(`edit:${item.type}:${item.id}`);
        try {
          const updated = await editAdminContentItem("thread", item.id, { title: nextTitle, content: nextBody });
          upsertContentItem(updated);
          setToast({ type: "ok", text: "Thread updated" });
          await Promise.all([loadModeration(), loadStats(), loadContent()]);
        } catch {
          setToast({ type: "err", text: "Failed to update thread" });
        } finally {
          setContentActionLoading(null);
        }
        return;
      }

      const nextContent = window.prompt("Edit post content", item.content ?? "");
      if (nextContent === null) return;

      setContentActionLoading(`edit:${item.type}:${item.id}`);
      try {
        const updated = await editAdminContentItem("post", item.id, { content: nextContent });
        upsertContentItem(updated);
        setToast({ type: "ok", text: "Post updated" });
        await Promise.all([loadModeration(), loadStats(), loadContent()]);
      } catch {
        setToast({ type: "err", text: "Failed to update post" });
      } finally {
        setContentActionLoading(null);
      }
    },
    [loadContent, loadModeration, loadStats, upsertContentItem],
  );

  const handleContentNotify = useCallback(async (item: AdminContentItem) => {
    const message = window.prompt("Notify the author", `Admin update: action taken on your ${item.type}.`);
    if (message === null) return;
    if (!message.trim()) {
      setToast({ type: "err", text: "Message cannot be empty" });
      return;
    }

    setContentActionLoading(`notify:${item.type}:${item.id}`);
    try {
      await notifyAdminContentAuthor(item.type, item.id, message.trim());
      setToast({ type: "ok", text: "Author notified" });
    } catch {
      setToast({ type: "err", text: "Failed to notify author" });
    } finally {
      setContentActionLoading(null);
    }
  }, []);

  if (!user || user.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", background: "#080a10", display: "grid", placeItems: "center", color: "#e4e8f4" }}>
        <div style={{ textAlign: "center" }}>
          <Shield size={48} style={{ color: "#f06b6b", marginBottom: 16 }} />
          <h1 style={{ fontFamily: "var(--font-dm-serif), serif", fontSize: 24, marginBottom: 8 }}>Access Denied</h1>
          <p style={{ color: "#636f8d", fontSize: 14 }}>You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  const useInnerScroll = tab === "content" || tab === "removed" || tab === "moderation" || tab === "appeals" || tab === "users" || tab === "audit" || tab === "bot";
  const rejectAppealModalLoading = Boolean(
    appealRejectTarget && appealsActionLoading === `resolve:${appealRejectTarget.id}`,
  );

  // Main return - integrated sidebar with admin navigation
  return (
    <>
      <WorkspaceShell
        wrapPanel={false}
        sidebarResize={{ defaultWidth: 328, min: 280, max: 480 }}
        sidebarProps={{
          hideChannels: true,
          hideAdminNav: true,
          extraSectionTitle: "Admin",
          extraSection: (
            <>
              {tabs.map(t => {
                const Icon = t.icon;
                const isWarn = t.key === "moderation" && (t.badge ?? 0) > 0;
                return (
                  <button key={`sb-tab-${t.key}`} type="button" className={`extra-item ${tab === t.key ? "active" : ""}`} onClick={() => openTab(t.key)}>
                    <Icon size={14} />
                    <span>{t.label}</span>
                    {!!t.badge && <span className={`extra-badge ${isWarn ? "warn" : ""}`}>{t.badge}</span>}
                  </button>
                );
              })}
            </>
          ),
        }}
      >

        {/* Main Content Area */}
        <main className="ws-panel admin-main">
          {/* Top bar */}
          <div className="top-bar">
            <div className="top-title-wrap">
              <Shield size={18} className="top-title-icon" />
              <div>
                <h1 className="page-title">Admin Dashboard</h1>
                <p className="page-subtitle">Moderate content, users, and system activity.</p>
              </div>
            </div>
            <div className="top-actions">
              <span className={`metric-chip ${modTotal > 0 ? "warn" : ""}`}>Queue: {modTotal}</span>
              <span className={`metric-chip ${modTotal > 0 ? "warn" : ""}`}>
                Flagged content: {modFlaggedPosts + modFlaggedThreads}
              </span>
              <span className="metric-chip">Active users: {stats?.active_users ?? usersTotal}</span>
              <button type="button" className="refresh-btn" onClick={() => void reloadAll()} title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className={`content ws-scroll ${useInnerScroll ? "content-locked" : "kg-scroll kg-scroll--sm kg-scroll--subtle"}`}>
            <div className="content-inner">
              {loading ? (
                <div className="center-msg">Loading admin data...</div>
              ) : error ? (
                <div className="error-box">
                  <AlertTriangle size={14} /> {error}
                </div>
              ) : (
                <>
                  {tab === "overview" && stats && (
                    <OverviewTab
                      stats={stats}
                      onOpenModeration={() => openTab("moderation")}
                      feedConfig={feedConfig}
                      feedAIHealth={feedAIHealth}
                      feedReadError={feedReadError}
                    />
                  )}
                  {tab === "moderation" && (
                    <ModerationTab
                      items={modItems}
                      total={modTotal}
                      flaggedPosts={modFlaggedPosts}
                      flaggedThreads={modFlaggedThreads}
                      selectedIds={modSelectedIds}
                      actionLoading={modActionLoading}
                      bulkLoading={modBulkLoading}
                      refreshing={modRefreshing}
                      onToggleItem={(id, checked) =>
                        setModSelectedIds(prev => (checked ? Array.from(new Set([...prev, id])) : prev.filter(item => item !== id)))
                      }
                      onToggleAll={checked => setModSelectedIds(checked ? modItems.map(item => moderationItemKey(item)) : [])}
                      onModerate={handleModerate}
                      onBulkModerate={handleBulkModerate}
                      onCheckItem={handleModerationCheck}
                      onRefresh={() => void handleModerationRefresh()}
                      onViewThread={threadId => threadId && router.push(`/threads/${threadId}`)}
                      onViewAuthor={username => router.push(profilePathFromUsername(username))}
                    />
                  )}
                  {tab === "appeals" && (
                    <AppealsTab
                      appeals={appeals}
                      total={appealsTotal}
                      pendingCount={appealsPending}
                      loading={appealsLoading}
                      statusFilter={appealsStatus}
                      actionLoading={appealsActionLoading}
                      onStatusChange={setAppealsStatus}
                      onResolve={handleResolveAppeal}
                      onViewContent={item => router.push(`/admin/content/${item.content_type}/${item.content_id}`)}
                      onViewProfile={userId => router.push(toProfilePath(userId))}
                      onViewThread={threadId => router.push(`/threads/${threadId}`)}
                    />
                  )}
                  {tab === "users" && (
                    <UsersTab
                      users={users}
                      total={usersTotal}
                      search={userSearch}
                      sort={userSort}
                      roleFilter={userRole}
                      statusFilter={userIsActive}
                      loading={loading}
                      selectedIds={selectedUserIds}
                      actionLoading={userActionLoading}
                      bulkLoading={userBulkLoading}
                      onSearchChange={setUserSearch}
                      onSortChange={setUserSort}
                      onRoleFilterChange={setUserRole}
                      onStatusFilterChange={setUserIsActive}
                      onExport={format => void handleExportUsers(format)}
                      onRoleChange={handleUserRoleChange}
                      onStatusToggle={handleUserStatusToggle}
                      onViewProfile={username => router.push(profilePathFromUsername(username))}
                      onUserRowClick={user => setUserDetailId(user.id)}
                      onToggleSelect={handleToggleUserSelect}
                      onToggleSelectAll={handleToggleAllUsers}
                      onBulkRoleChange={handleRequestBulkRoleChange}
                      onBulkActivate={handleRequestBulkActivate}
                      onBulkDeactivate={handleRequestBulkDeactivate}
                    />
                  )}
                  {tab === "content" && (
                    <ContentTab
                      items={contentItems}
                      total={contentTotal}
                      missingAiReports={contentMissingAiReports}
                      loading={contentLoading}
                      title="Content Control"
                      countLabel={`${contentTotal} items`}
                      search={contentSearch}
                      contentType={contentType}
                      statusFilter={contentStatus}
                      deletedFilter={contentDeleted}
                      flaggedFilter={contentFlagged}
                      actionLoading={contentActionLoading}
                      onSearchChange={setContentSearch}
                      onTypeChange={value => {
                        setContentType(value);
                        setContentStatus("");
                        setContentFlagged("");
                      }}
                      onStatusChange={setContentStatus}
                      onDeletedChange={setContentDeleted}
                      onFlaggedChange={setContentFlagged}
                      onDeleteItem={handleDeleteContent}
                      onRereportMissing={handleContentRereportMissing}
                      onOpenItem={item => router.push(`/admin/content/${item.type}/${item.id}`)}
                      onRereportItem={handleContentRereportItem}
                      onFlagToggle={handleContentFlagToggle}
                      onEditItem={handleContentEdit}
                      onNotifyItem={handleContentNotify}
                      onThreadStatusChange={handleThreadStatusChange}
                      onThreadPinToggle={handleThreadPinToggle}
                      onViewThread={threadId => router.push(`/threads/${threadId}`)}
                    />
                  )}
                  {tab === "removed" && (
                    <ContentTab
                      items={contentItems}
                      total={contentTotal}
                      missingAiReports={contentMissingAiReports}
                      loading={contentLoading}
                      title="Removed Content Collection"
                      countLabel={`${contentTotal} removed`}
                      lockDeletedFilter
                      hideBulkAiAction
                      search={contentSearch}
                      contentType={contentType}
                      statusFilter={contentStatus}
                      deletedFilter="true"
                      flaggedFilter={contentFlagged}
                      actionLoading={contentActionLoading}
                      onSearchChange={setContentSearch}
                      onTypeChange={value => {
                        setContentType(value);
                        setContentStatus("");
                        setContentFlagged("");
                      }}
                      onStatusChange={setContentStatus}
                      onDeletedChange={() => {}}
                      onFlaggedChange={setContentFlagged}
                      onDeleteItem={handleDeleteContent}
                      onRereportMissing={handleContentRereportMissing}
                      onOpenItem={item => router.push(`/admin/content/${item.type}/${item.id}`)}
                      onRereportItem={handleContentRereportItem}
                      onFlagToggle={handleContentFlagToggle}
                      onEditItem={handleContentEdit}
                      onNotifyItem={handleContentNotify}
                      onThreadStatusChange={handleThreadStatusChange}
                      onThreadPinToggle={handleThreadPinToggle}
                      onViewThread={threadId => router.push(`/threads/${threadId}`)}
                    />
                  )}
                  {tab === "audit" && (
                    <AuditTab
                      logs={auditLogs}
                      total={auditTotal}
                      loading={auditLoading}
                      page={auditPage}
                      totalPages={auditTotalPages}
                      action={auditAction}
                      targetType={auditTargetType}
                      severity={auditSeverity}
                      result={auditResult}
                      actorId={auditActorId}
                      requestId={auditRequestId}
                      dateFrom={auditDateFrom}
                      dateTo={auditDateTo}
                      onActionChange={value => {
                        setAuditAction(value);
                        setAuditPage(1);
                      }}
                      onTargetTypeChange={value => {
                        setAuditTargetType(value);
                        setAuditPage(1);
                      }}
                      onSeverityChange={value => {
                        setAuditSeverity(value);
                        setAuditPage(1);
                      }}
                      onResultChange={value => {
                        setAuditResult(value);
                        setAuditPage(1);
                      }}
                      onActorIdChange={value => {
                        setAuditActorId(value);
                        setAuditPage(1);
                      }}
                      onRequestIdChange={value => {
                        setAuditRequestId(value);
                        setAuditPage(1);
                      }}
                      onDateFromChange={value => {
                        setAuditDateFrom(value);
                        setAuditPage(1);
                      }}
                      onDateToChange={value => {
                        setAuditDateTo(value);
                        setAuditPage(1);
                      }}
                      onPageChange={setAuditPage}
                      onExport={format => void handleExportAudit(format)}
                    />
                  )}
                  {tab === "bot" && <BotTab />}
                </>
              )}
            </div>
          </div>

          {toast && (
            <div className={`toast ${toast.type}`}>
              {toast.type === "ok" ? <Check size={14} /> : <AlertTriangle size={14} />}
              {toast.text}
            </div>
          )}

          {bulkAction && (
            <BulkConfirmModal
              count={selectedUserIds.size}
              actionType={bulkAction.type}
              newRole={bulkAction.role}
              loading={userBulkLoading}
              onClose={() => {
                if (!userBulkLoading) setBulkAction(null);
              }}
              onConfirm={() => void handleConfirmBulkAction()}
            />
          )}

          {userDetailId && (
            <UserDetailDrawer
              userId={userDetailId}
              onClose={() => setUserDetailId(null)}
              onUserUpdated={() => void handleUserDetailUpdated()}
            />
          )}

          {appealRejectTarget && (
            <AppealRejectModal
              key={appealRejectTarget.id}
              appeal={appealRejectTarget}
              loading={rejectAppealModalLoading}
              onClose={() => {
                if (!rejectAppealModalLoading) setAppealRejectTarget(null);
              }}
              onSubmit={handleRejectAppealSubmit}
            />
          )}
        </main>
      </WorkspaceShell>

      <style jsx>{`
        .admin-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 18px 24px;
          border-bottom: 1px solid #1e2235;
        }
        .top-title-wrap {
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .top-title-icon {
          color: #f0834a;
        }
        .page-title {
          margin: 0;
          font-family: var(--font-dm-serif), serif;
          font-size: 24px;
          line-height: 1.1;
        }
        .page-subtitle {
          margin-top: 4px;
          color: #636f8d;
          font-size: 13px;
        }
        .top-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .metric-chip {
          border: 1px solid #252b40;
          background: #151927;
          color: #9ba3be;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }
        .metric-chip.warn {
          border-color: rgba(240, 107, 107, 0.35);
          background: rgba(240, 107, 107, 0.16);
          color: #f6b0b0;
        }
        .refresh-btn {
          border: 1px solid #252b40;
          background: #151927;
          color: #9ba3be;
          border-radius: 8px;
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .refresh-btn:hover {
          border-color: #3a4160;
          color: #e4e8f4;
          background: #161a26;
        }
        .content {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 24px;
        }
        .content.content-locked {
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .content-inner {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .content.content-locked .content-inner {
          height: 100%;
          min-height: 0;
        }
        .center-msg {
          text-align: center;
          color: #7b86a6;
          padding: 56px 0;
        }
        .error-box {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #f5b0b0;
          background: rgba(240, 107, 107, 0.1);
          border: 1px solid rgba(240, 107, 107, 0.24);
          border-radius: 12px;
          padding: 13px 16px;
          font-size: 13px;
        }
        .toast {
          position: absolute;
          right: 16px;
          bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 13px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          z-index: 8;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
        }
        .toast.ok {
          background: rgba(61, 214, 140, 0.16);
          color: #85e6ba;
          border: 1px solid rgba(61, 214, 140, 0.34);
        }
        .toast.err {
          background: rgba(240, 107, 107, 0.16);
          color: #f4b3b3;
          border: 1px solid rgba(240, 107, 107, 0.34);
        }
        @media (max-width: 860px) {
          .top-bar {
            padding: 16px;
            align-items: flex-start;
            flex-direction: column;
          }
          .top-actions {
            width: 100%;
            justify-content: flex-start;
          }
          .content {
            padding: 14px;
          }
        }
      `}</style>
    </>
  );
}
