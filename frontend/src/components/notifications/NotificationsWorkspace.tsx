"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign, Bell, Check, CheckCheck, ChevronLeft, ChevronRight,
  ExternalLink, Info, Link2, Mail, MessageSquareReply, ShieldAlert, UserPlus, X,
} from "lucide-react";
import PageLoader from "@/components/shared/PageLoader";
import WorkspaceShell from "@/components/app/WorkspaceShell";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { apiPost } from "@/lib/api";
import { toProfilePath } from "@/lib/profileRouting";
import { relativeTime } from "@/lib/workspaceUtils";
import { followUser, getFollowStatus } from "@/lib/followApi";
import { acceptMessageRequest, rejectMessageRequest } from "@/lib/connectionApi";
import AppealModal from "@/components/notifications/AppealModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { key: "all",        label: "All" },
  { key: "reply",      label: "Replies" },
  { key: "mention",    label: "Mentions" },
  { key: "follow",     label: "Follows" },
  { key: "connection", label: "Connections" },
  { key: "message",    label: "Messages" },
  { key: "moderation", label: "Moderation" },
  { key: "system",     label: "System" },
] as const;

const STATUS_OPTIONS = [
  { key: "all",    label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read",   label: "Read" },
] as const;

type NotificationTypeFilter   = (typeof TYPE_OPTIONS)[number]["key"];
type NotificationStatusFilter = (typeof STATUS_OPTIONS)[number]["key"];
type FollowRelationshipState = "loading" | "following" | "not_following";
type AppealState = "idle" | "loading" | "done";

const TYPE_CONFIG: Record<Notification["type"], {
  label: string; color: string; bg: string; border: string;
  icon: React.ReactNode;
}> = {
  reply: {
    label: "Reply",      color: "#7c73f0", bg: "rgba(124,115,240,0.15)", border: "rgba(124,115,240,0.3)",
    icon: <MessageSquareReply size={14} />,
  },
  mention: {
    label: "Mention",    color: "#f0834a", bg: "rgba(240,131,74,0.15)",  border: "rgba(240,131,74,0.3)",
    icon: <AtSign size={14} />,
  },
  moderation: {
    label: "Moderation", color: "#f06b6b", bg: "rgba(240,107,107,0.15)", border: "rgba(240,107,107,0.3)",
    icon: <ShieldAlert size={14} />,
  },
  follow: {
    label: "Follow",     color: "#7c73f0", bg: "rgba(124,115,240,0.15)", border: "rgba(124,115,240,0.3)",
    icon: <UserPlus size={14} />,
  },
  connection: {
    label: "Connection", color: "#f0834a", bg: "rgba(240,131,74,0.15)",  border: "rgba(240,131,74,0.3)",
    icon: <Link2 size={14} />,
  },
  message: {
    label: "Message", color: "#3dd68c", bg: "rgba(61,214,140,0.15)", border: "rgba(61,214,140,0.3)",
    icon: <Mail size={14} />,
  },
  system: {
    label: "System",     color: "#3dd68c", bg: "rgba(61,214,140,0.15)",  border: "rgba(61,214,140,0.3)",
    icon: <Bell size={14} />,
  },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <div style={{
      display: "flex", gap: 12, padding: "14px 16px",
      border: "1px solid #1e2235", borderRadius: 12,
      background: "linear-gradient(180deg,#10131d,#0f1118)",
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1a1f30", flexShrink: 0, animation: "sk 1.4s ease infinite" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ width: "28%", height: 11, borderRadius: 4, background: "#1e2540", animation: "sk 1.4s ease infinite" }} />
        <div style={{ width: "80%", height: 13, borderRadius: 4, background: "#1e2540", animation: "sk 1.4s ease infinite 0.1s" }} />
        <div style={{ width: "40%", height: 10, borderRadius: 4, background: "#1a1f30", animation: "sk 1.4s ease infinite 0.2s", opacity: 0.6 }} />
      </div>
      <style jsx>{`@keyframes sk{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
    </div>
  );
}

// ─── Rejection reason modal ──────────────────────────────────────────────────

function RejectionReasonModal({ note, onClose }: { note: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="rej-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rej-modal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rej-modal" onClick={e => e.stopPropagation()}>
        <div className="rej-header">
          <h3 id="rej-modal-title">Appeal Rejected</h3>
          <button type="button" className="rej-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="rej-sub">The admin provided the following reason for rejecting your appeal:</p>
        <div className="rej-note-box">
          <p className="rej-note-text">{note}</p>
        </div>
        <div className="rej-actions">
          <button type="button" className="rej-btn" onClick={onClose}>Close</button>
        </div>
      </div>

      <style jsx>{`
        .rej-overlay {
          position: fixed; inset: 0; z-index: 80;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .rej-modal {
          width: min(480px, 100%);
          border: 1px solid #1e2235; border-radius: 14px;
          background: linear-gradient(180deg, #121624, #101420);
          color: #e4e8f4; padding: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45);
          animation: rej-slide-up 0.2s ease;
        }
        @keyframes rej-slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .rej-header {
          display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px;
        }
        .rej-header h3 {
          margin: 0; font-family: var(--font-dm-serif), serif; font-size: 20px; line-height: 1.1; color: #f06b6b;
        }
        .rej-close {
          border: 1px solid #2b324c; background: #151927; color: #8d98b8;
          border-radius: 8px; width: 30px; height: 30px; display: grid; place-items: center; cursor: pointer;
        }
        .rej-close:hover { color: #e4e8f4; border-color: #3d4460; }
        .rej-sub {
          margin: 0 0 14px; color: #9aa4c2; font-size: 13px; line-height: 1.45;
        }
        .rej-note-box {
          border: 1px solid rgba(240,107,107,0.25); background: rgba(240,107,107,0.06);
          border-radius: 10px; padding: 12px 14px;
        }
        .rej-note-text {
          margin: 0; font-size: 13px; line-height: 1.6; color: #d4d9ec; white-space: pre-wrap;
        }
        .rej-actions { margin-top: 16px; display: flex; justify-content: flex-end; }
        .rej-btn {
          border: 1px solid #2b324c; background: #151927; color: #9aa4c2;
          border-radius: 9px; padding: 8px 16px; font-size: 12px; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: all 0.15s;
        }
        .rej-btn:hover { color: #e4e8f4; border-color: #3d4460; background: #1a1f30; }
      `}</style>
    </div>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────

type ConnectionActionState = "idle" | "loading" | "accepted" | "declined";

function NotificationRow({
  item, marking, markingAll, onMarkRead, onFollowBack, followBackState, followRelationshipState, onAppeal, appealState, onViewReason,
  connectionActionState, onConnectionAccept, onConnectionDecline,
}: {
  item: Notification;
  marking: boolean;
  markingAll: boolean;
  onMarkRead: (id: string) => void;
  onFollowBack: (actorId: string) => void;
  followBackState: "idle" | "loading";
  followRelationshipState: FollowRelationshipState;
  onAppeal: (notificationId: string) => void;
  appealState: AppealState;
  onViewReason: (note: string) => void;
  connectionActionState: ConnectionActionState;
  onConnectionAccept: (requestId: string, notifId: string) => void;
  onConnectionDecline: (requestId: string, notifId: string) => void;
}) {
  const router = useRouter();
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.system;
  const isUnread = !item.is_read;
  const isFollowNotif = item.type === "follow" && item.actor_id;
  const isFollowedYou = isFollowNotif && item.message.includes("started following");
  const moderationAction = String(item.metadata?.moderation_action ?? "").toLowerCase();
  const isRemovedModeration =
    item.type === "moderation" &&
    (moderationAction === "removed" || item.message.toLowerCase().includes("removed"));
  const isAppealResult = item.type === "moderation" && moderationAction === "appeal_result";
  const appealStatus = item.metadata?.appeal_status ?? "none";
  const isRejectedAppeal = isAppealResult && appealStatus === "rejected";
  const adminNote = item.metadata?.admin_note as string | undefined;
  const canAppeal =
    isRemovedModeration &&
    (appealStatus === "none" || !appealStatus) &&
    item.metadata?.appealable !== false &&
    appealState !== "done";
  const canShowFollowBack =
    isFollowedYou &&
    followRelationshipState === "not_following";

  // Connection request row: incoming requests have metadata.connection_action = "incoming_request"
  const incomingRequestId =
    item.type === "connection" &&
    item.metadata?.connection_action === "incoming_request" &&
    typeof item.metadata?.request_id === "string"
      ? (item.metadata.request_id as string)
      : null;

  return (
    <div className={`notif-row ${isUnread ? "unread" : "read"}`}
      style={isUnread ? { boxShadow: `inset 3px 0 0 ${cfg.color}` } : undefined}>
      <div className="notif-icon" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
        {cfg.icon}
      </div>

      <div className="notif-content">
        <div className="notif-meta">
          <span className="notif-type" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="notif-sep">·</span>
          <span className="notif-time" title={formatDate(item.created_at)}>{relativeTime(item.created_at)}</span>
          {isUnread && <span className="notif-new">New</span>}
        </div>
        <p className={`notif-msg ${isUnread ? "bright" : ""}`}>{item.message}</p>

        <div className="notif-actions">
          {item.type === "message" && typeof item.metadata?.conversation_id === "string" && (
            <button
              type="button"
              className="action-link profile-link"
              onClick={() => {
                if (isUnread) onMarkRead(item.id);
                router.push(`/messages/${item.metadata.conversation_id}`);
              }}
            >
              <Mail size={11} />
              Open conversation
            </button>
          )}
          {/* Thread link — hidden for removed content and rejected appeals */}
          {item.thread_id && !isRemovedModeration && !isRejectedAppeal && (
            <Link
              href={`/threads/${item.thread_id}`}
              className="notif-link"
              onClick={() => { if (isUnread) onMarkRead(item.id); }}
            >
              Open thread →
            </Link>
          )}

          {/* View profile link — never show for system/moderation notices */}
          {item.actor_id && item.type !== "system" && item.type !== "moderation" && !isRemovedModeration && !isRejectedAppeal && (
            <button
              type="button"
              className="action-link profile-link"
              onClick={() => {
                if (isUnread) onMarkRead(item.id);
                router.push(toProfilePath(item.actor_id!));
              }}
            >
              <ExternalLink size={11} />
              View profile
            </button>
          )}

          {/* Follow back — only for "started following you" notifications */}
          {canShowFollowBack && (
            <button
              type="button"
              className="action-link follow-back-btn"
              disabled={followBackState !== "idle"}
              onClick={() => onFollowBack(item.actor_id!)}
            >
              {followBackState === "loading"
                ? <><UserPlus size={11} /> Following...</>
                : <><UserPlus size={11} /> Follow back</>}
            </button>
          )}

          {/* Connection request — Accept / Decline inline */}
          {incomingRequestId && connectionActionState === "idle" && (
            <>
              <button
                type="button"
                className="action-link conn-accept-btn"
                onClick={() => onConnectionAccept(incomingRequestId, item.id)}
              >
                <Check size={11} /> Accept
              </button>
              <button
                type="button"
                className="action-link conn-decline-btn"
                onClick={() => onConnectionDecline(incomingRequestId, item.id)}
              >
                <X size={11} /> Decline
              </button>
            </>
          )}
          {incomingRequestId && connectionActionState === "loading" && (
            <span className="conn-pending-label">Updating…</span>
          )}
          {incomingRequestId && connectionActionState === "accepted" && (
            <span className="appeal-status approved">Connected</span>
          )}
          {incomingRequestId && connectionActionState === "declined" && (
            <span className="appeal-status" style={{ color: "#636f8d", background: "rgba(99,111,141,0.1)", borderColor: "rgba(99,111,141,0.25)" }}>Declined</span>
          )}

          {canAppeal && (
            <button
              type="button"
              className="action-link appeal-btn"
              disabled={appealState !== "idle"}
              onClick={() => onAppeal(item.id)}
            >
              {appealState === "loading" ? "Submitting appeal..." : "Appeal"}
            </button>
          )}

          {isRemovedModeration && !canAppeal && (
            <>
              <span className={`appeal-status ${appealStatus}`}>
                {appealStatus === "pending" || appealState === "done"
                  ? "Appeal pending review"
                  : appealStatus === "approved"
                    ? "Appeal approved"
                    : appealStatus === "rejected"
                      ? "Appeal rejected"
                      : "Removed by moderation"}
              </span>
              {appealStatus === "rejected" && adminNote && (
                <button
                  type="button"
                  className="action-link view-reason-btn"
                  onClick={() => onViewReason(adminNote)}
                >
                  <Info size={11} />
                  View reason
                </button>
              )}
            </>
          )}

          {isRejectedAppeal && (
            <>
              <span className="appeal-status rejected">Appeal rejected</span>
              {adminNote && (
                <button
                  type="button"
                  className="action-link view-reason-btn"
                  onClick={() => onViewReason(adminNote)}
                >
                  <Info size={11} />
                  View reason
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isUnread && (
        <button
          type="button"
          className="mark-btn"
          disabled={marking || markingAll}
          onClick={() => onMarkRead(item.id)}
          title="Mark as read"
        >
          <Check size={12} />
          <span>Read</span>
        </button>
      )}

      <style jsx>{`
        .notif-row {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 16px; border: 1px solid #1e2235; border-radius: 12px;
          background: linear-gradient(180deg,#10131d,#0f1118);
          transition: background 0.15s, border-color 0.15s;
        }
        .notif-row.unread { border-color: #252b40; background: linear-gradient(180deg,#121624,#101420); }
        .notif-row:hover { background: linear-gradient(180deg,#141828,#121622); border-color: #252b40; }
        .notif-icon { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; margin-top: 1px; }
        .notif-content { flex: 1; min-width: 0; }
        .notif-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
        .notif-type { font-size: 11px; font-weight: 700; }
        .notif-sep { font-size: 10px; color: #3d4460; }
        .notif-time { font-size: 11px; color: #636f8d; }
        .notif-new { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #f0834a; background: rgba(240,131,74,0.12); border: 1px solid rgba(240,131,74,0.25); border-radius: 999px; padding: 1px 7px; }
        .notif-msg { font-size: 13px; line-height: 1.6; color: #8990aa; margin: 0 0 5px; }
        .notif-msg.bright { color: #c4cbe0; }
        .notif-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
        .notif-link { font-size: 11px; font-weight: 600; color: #7c73f0; text-decoration: none; transition: color 0.15s; }
        .notif-link:hover { color: #9b8ef8; text-decoration: underline; }
        .action-link {
          border: none; background: none; padding: 0;
          font-size: 11px; font-weight: 600; font-family: inherit;
          display: inline-flex; align-items: center; gap: 4px;
          cursor: pointer; transition: color 0.15s;
        }
        .profile-link { color: #636f8d; }
        .profile-link:hover { color: #b5bfd8; }
        .follow-back-btn { color: #7c73f0; }
        .follow-back-btn:hover:not(:disabled) { color: #9b8ef8; }
        .follow-back-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .appeal-btn { color: #f0834a; }
        .appeal-btn:hover:not(:disabled) { color: #ff9e70; }
        .appeal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .conn-accept-btn { color: #3dd68c; }
        .conn-accept-btn:hover { color: #6eedb0; }
        .conn-decline-btn { color: #636f8d; }
        .conn-decline-btn:hover { color: #9baac8; }
        .conn-pending-label { font-size: 11px; color: #636f8d; }
        .appeal-status {
          font-size: 11px;
          font-weight: 600;
          border-radius: 999px;
          padding: 2px 10px;
          border: 1px solid rgba(149,163,198,0.28);
          background: rgba(149,163,198,0.14);
          color: #aeb8d7;
        }
        .appeal-status.pending {
          color: #f6c5ab;
          border-color: rgba(240,131,74,0.35);
          background: rgba(240,131,74,0.16);
        }
        .appeal-status.approved {
          color: #8ce6ba;
          border-color: rgba(61,214,140,0.35);
          background: rgba(61,214,140,0.16);
        }
        .appeal-status.rejected {
          color: #f6b0b0;
          border-color: rgba(240,107,107,0.35);
          background: rgba(240,107,107,0.16);
        }
        .view-reason-btn { color: #f06b6b; }
        .view-reason-btn:hover { color: #f6b0b0; }
        .mark-btn {
          border: 1px solid #252b40; background: #151927; color: #636f8d;
          border-radius: 7px; padding: 5px 10px; font-size: 11px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 4px;
          cursor: pointer; white-space: nowrap; transition: all 0.15s;
          flex-shrink: 0; font-family: inherit;
        }
        .mark-btn:hover:not(:disabled) { color: #3dd68c; border-color: rgba(61,214,140,0.4); background: rgba(61,214,140,0.08); }
        .mark-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NotificationsWorkspace() {

  // Hydration guard — SWR isLoading=false on server, true on client → mismatch without this
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Notification state
  const [page, setPage]                 = useState(1);
  const [typeFilter, setTypeFilter]     = useState<NotificationTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<NotificationStatusFilter>("all");
  const [markingId, setMarkingId]       = useState<string | null>(null);
  const [markingAll, setMarkingAll]     = useState(false);
  const [toast, setToast]               = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimer                      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiTypeFilter   = typeFilter   === "all" ? undefined : typeFilter;
  const apiIsReadFilter = statusFilter === "all" ? undefined : statusFilter === "read";

  const {
    notifications, limit, page: currentPage, total,
    unreadCount, isLoading, error, hasMore, mutate, markAsRead, markAllAsRead,
  } = useNotifications({ page, limit: 20, type: apiTypeFilter, isRead: apiIsReadFilter });

  useEffect(() => { setPage(1); }, [typeFilter, statusFilter]);

  if (!mounted || (isLoading && notifications.length === 0)) {
    return <PageLoader />;
  }

  const errorMessage = useMemo(() => {
    if (!error) return null;
    return error instanceof Error ? error.message : "Failed to load notifications";
  }, [error]);

  const grouped = useMemo(() => ({
    unread: notifications.filter(n => !n.is_read),
    read:   notifications.filter(n =>  n.is_read),
  }), [notifications]);

  const [followRelationshipMap, setFollowRelationshipMap] = useState<
    Record<string, FollowRelationshipState>
  >({});

  useEffect(() => {
    const followNotificationActorIds = Array.from(
      new Set(
        notifications
          .filter(
            n =>
              n.type === "follow" &&
              Boolean(n.actor_id) &&
              n.message.includes("started following")
          )
          .map(n => n.actor_id!)
      )
    );

    const missingActorIds = followNotificationActorIds.filter(
      actorId => !followRelationshipMap[actorId]
    );
    if (missingActorIds.length === 0) return;

    let cancelled = false;

    setFollowRelationshipMap(prev => {
      const next = { ...prev };
      for (const actorId of missingActorIds) {
        if (!next[actorId]) next[actorId] = "loading";
      }
      return next;
    });

    void Promise.all(
      missingActorIds.map(async actorId => {
        try {
          const status = await getFollowStatus(actorId);
          const state: FollowRelationshipState = status.is_following ? "following" : "not_following";
          return { actorId, state };
        } catch {
          return { actorId, state: "not_following" as const };
        }
      })
    ).then(results => {
      if (cancelled) return;
      setFollowRelationshipMap(prev => {
        const next = { ...prev };
        for (const { actorId, state } of results) {
          next[actorId] = state;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [notifications, followRelationshipMap]);

  function showToast(msg: string, type: "success" | "error" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  async function handleMarkRead(id: string) {
    setMarkingId(id);
    try { await markAsRead(id); }
    catch (e) { showToast(e instanceof Error ? e.message : "Failed to mark as read", "error"); }
    finally   { setMarkingId(null); }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try { await markAllAsRead(); showToast("All notifications marked as read"); }
    catch (e) { showToast(e instanceof Error ? e.message : "Failed to mark all as read", "error"); }
    finally   { setMarkingAll(false); }
  }

  // Follow-back state: actorId -> "idle" | "loading"
  const [followBackMap, setFollowBackMap] = useState<Record<string, "loading">>({});
  const [appealMap, setAppealMap] = useState<Record<string, "loading" | "done">>({});
  const [appealTargetId, setAppealTargetId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState<string | null>(null);

  // Connection request inline actions: notifId -> state
  const [connectionActionMap, setConnectionActionMap] = useState<Record<string, ConnectionActionState>>({});

  async function handleConnectionAccept(requestId: string, notifId: string) {
    setConnectionActionMap(prev => ({ ...prev, [notifId]: "loading" }));
    try {
      await acceptMessageRequest(requestId);
      setConnectionActionMap(prev => ({ ...prev, [notifId]: "accepted" }));
      if (!notifications.find(n => n.id === notifId)?.is_read) await markAsRead(notifId);
      showToast("Connection accepted!");
    } catch {
      setConnectionActionMap(prev => ({ ...prev, [notifId]: "idle" }));
      showToast("Failed to accept connection", "error");
    }
  }

  async function handleConnectionDecline(requestId: string, notifId: string) {
    setConnectionActionMap(prev => ({ ...prev, [notifId]: "loading" }));
    try {
      await rejectMessageRequest(requestId);
      setConnectionActionMap(prev => ({ ...prev, [notifId]: "declined" }));
      if (!notifications.find(n => n.id === notifId)?.is_read) await markAsRead(notifId);
      showToast("Connection request declined");
    } catch {
      setConnectionActionMap(prev => ({ ...prev, [notifId]: "idle" }));
      showToast("Failed to decline connection", "error");
    }
  }

  async function handleFollowBack(actorId: string) {
    setFollowBackMap(prev => ({ ...prev, [actorId]: "loading" }));
    try {
      await followUser(actorId);
      setFollowBackMap(prev => { const next = { ...prev }; delete next[actorId]; return next; });
      setFollowRelationshipMap(prev => ({ ...prev, [actorId]: "following" }));
      showToast("Followed back!");
    } catch {
      setFollowBackMap(prev => { const next = { ...prev }; delete next[actorId]; return next; });
      showToast("Failed to follow back", "error");
    }
  }

  function handleAppeal(notificationId: string) {
    setAppealTargetId(notificationId);
  }

  async function handleAppealSubmit(reason: string) {
    const notificationId = appealTargetId;
    if (!notificationId) {
      throw new Error("Appeal target is missing");
    }

    setAppealMap(prev => ({ ...prev, [notificationId]: "loading" }));
    try {
      await apiPost(`notifications/${notificationId}/appeal`, { reason });
      setAppealMap(prev => ({ ...prev, [notificationId]: "done" }));
      setAppealTargetId(null);
      await mutate();
      showToast("Appeal submitted. Admin will review it.");
    } catch (e) {
      setAppealMap(prev => { const next = { ...prev }; delete next[notificationId]; return next; });
      throw (e instanceof Error ? e : new Error("Failed to submit appeal"));
    }
  }

  const totalPages = Math.ceil(total / Math.max(1, limit));
  const appealModalLoading = Boolean(appealTargetId && appealMap[appealTargetId] === "loading");

  return (
    <>
      <WorkspaceShell wrapPanel={false}>
        <section className="ws-panel main-panel">

        <div className="page-header">
          <div className="header-left">
            <span className="eyebrow">Inbox</span>
            <h1 className="page-title">Notifications</h1>
            <p className="page-sub">Replies, mentions, follows, messages, connections, and moderation updates.</p>
          </div>
          <div className="header-right">
            {unreadCount > 0 && <span className="unread-pill">{unreadCount} unread</span>}
            {unreadCount > 0 && (
              <button type="button" className="mark-all-btn" disabled={markingAll || isLoading} onClick={handleMarkAllRead}>
                <CheckCheck size={13} />
                {markingAll ? "Marking…" : "Mark all read"}
              </button>
            )}
          </div>
        </div>

        <div className="status-tabs">
          {STATUS_OPTIONS.map(opt => (
            <button key={opt.key} type="button"
              className={`tab-btn ${statusFilter === opt.key ? "active" : ""}`}
              onClick={() => setStatusFilter(opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="type-chips">
          {TYPE_OPTIONS.map(opt => (
            <button key={opt.key} type="button"
              className={`type-chip ${typeFilter === opt.key ? "active" : ""}`}
              onClick={() => setTypeFilter(opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>

        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        <div className="notif-scroll ws-scroll">

          {(!mounted || isLoading) && notifications.length === 0 && (
            <div className="notif-list">
              {Array.from({ length: 5 }, (_, i) => <NotificationSkeleton key={i} />)}
            </div>
          )}

          {mounted && !isLoading && !errorMessage && notifications.length === 0 && (
            <div className="empty-state">
              <Bell size={28} strokeWidth={1.2} />
              <p>No notifications{statusFilter !== "all" || typeFilter !== "all" ? " for this filter" : ""} yet.</p>
            </div>
          )}

          {mounted && notifications.length > 0 && (
            <>
              {statusFilter === "all" ? (
                <>
                  {grouped.unread.length > 0 && (
                    <div className="notif-group">
                      <div className="group-label"><span className="gdot unread-dot" />Unread</div>
                      <div className="notif-list">
                        {grouped.unread.map(item => (
                          <NotificationRow key={item.id} item={item}
                            marking={markingId === item.id} markingAll={markingAll}
                            onMarkRead={handleMarkRead}
                            onFollowBack={handleFollowBack}
                            onAppeal={handleAppeal}
                            followBackState={item.actor_id ? (followBackMap[item.actor_id] ?? "idle") : "idle"}
                            followRelationshipState={item.actor_id ? (followRelationshipMap[item.actor_id] ?? "loading") : "not_following"}
                            appealState={appealMap[item.id] ?? "idle"}
                            onViewReason={setRejectionNote}
                            connectionActionState={connectionActionMap[item.id] ?? "idle"}
                            onConnectionAccept={handleConnectionAccept}
                            onConnectionDecline={handleConnectionDecline} />
                        ))}
                      </div>
                    </div>
                  )}
                  {grouped.read.length > 0 && (
                    <div className="notif-group">
                      <div className="group-label"><span className="gdot read-dot" />Earlier</div>
                      <div className="notif-list">
                        {grouped.read.map(item => (
                          <NotificationRow key={item.id} item={item}
                            marking={markingId === item.id} markingAll={markingAll}
                            onMarkRead={handleMarkRead}
                            onFollowBack={handleFollowBack}
                            onAppeal={handleAppeal}
                            followBackState={item.actor_id ? (followBackMap[item.actor_id] ?? "idle") : "idle"}
                            followRelationshipState={item.actor_id ? (followRelationshipMap[item.actor_id] ?? "loading") : "not_following"}
                            appealState={appealMap[item.id] ?? "idle"}
                            onViewReason={setRejectionNote}
                            connectionActionState={connectionActionMap[item.id] ?? "idle"}
                            onConnectionAccept={handleConnectionAccept}
                            onConnectionDecline={handleConnectionDecline} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="notif-list">
                  {notifications.map(item => (
                    <NotificationRow key={item.id} item={item}
                      marking={markingId === item.id} markingAll={markingAll}
                      onMarkRead={handleMarkRead}
                      onFollowBack={handleFollowBack}
                      onAppeal={handleAppeal}
                      followBackState={item.actor_id ? (followBackMap[item.actor_id] ?? "idle") : "idle"}
                      followRelationshipState={item.actor_id ? (followRelationshipMap[item.actor_id] ?? "loading") : "not_following"}
                      appealState={appealMap[item.id] ?? "idle"}
                      onViewReason={setRejectionNote}
                      connectionActionState={connectionActionMap[item.id] ?? "idle"}
                      onConnectionAccept={handleConnectionAccept}
                      onConnectionDecline={handleConnectionDecline} />
                  ))}
                </div>
              )}

              <div className="pagination">
                <span className="page-info">
                  Page {currentPage}{totalPages > 1 ? ` of ${totalPages}` : ""} · {total} total
                </span>
                <div className="page-btns">
                  <button type="button" className="page-btn"
                    disabled={currentPage <= 1 || isLoading}
                    onClick={() => setPage(p => Math.max(1, p - 1))}>
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <button type="button" className="page-btn"
                    disabled={!hasMore || isLoading}
                    onClick={() => setPage(p => p + 1)}>
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        </section>
      </WorkspaceShell>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      {rejectionNote && (
        <RejectionReasonModal note={rejectionNote} onClose={() => setRejectionNote(null)} />
      )}
      {appealTargetId && (
        <AppealModal
          loading={appealModalLoading}
          onClose={() => {
            if (!appealModalLoading) setAppealTargetId(null);
          }}
          onSubmit={handleAppealSubmit}
        />
      )}

      <style jsx>{`
        .main-panel {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 20px 24px 0;
        }

        /* Header */
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; flex-shrink: 0; }
        .eyebrow { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #f0834a; margin-bottom: 4px; }
        .page-title { font-family: var(--font-dm-serif),serif; font-size: 28px; line-height: 1.1; margin: 0 0 5px; color: #e8eaf4; }
        .page-sub { font-size: 12px; color: #636f8d; margin: 0; }
        .header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding-top: 4px; }
        .unread-pill { font-size: 11px; font-weight: 700; color: #f0834a; background: rgba(240,131,74,0.12); border: 1px solid rgba(240,131,74,0.25); border-radius: 999px; padding: 3px 10px; }
        .mark-all-btn {
          border: none; background: #f0834a; color: #fff; border-radius: 9px; padding: 7px 13px;
          font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;
          cursor: pointer; white-space: nowrap; box-shadow: 0 4px 14px rgba(240,131,74,0.3);
          transition: opacity 0.15s; font-family: inherit;
        }
        .mark-all-btn:hover:not(:disabled) { opacity: 0.88; }
        .mark-all-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Tabs */
        .status-tabs { display: flex; border-bottom: 1px solid #1e2235; margin-bottom: 12px; flex-shrink: 0; }
        .tab-btn {
          border: none; border-bottom: 2px solid transparent; background: transparent;
          color: #69738f; font-size: 12px; font-weight: 600;
          padding: 7px 16px; cursor: pointer; transition: all 0.15s;
          margin-bottom: -1px; font-family: inherit;
        }
        .tab-btn:hover:not(.active) { color: #b5bfd8; }
        .tab-btn.active { color: #e4e8f4; border-bottom-color: #f0834a; }

        /* Type chips */
        .type-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; flex-shrink: 0; }
        .type-chip {
          border: 1px solid #252b40; background: #151927; color: #636f8d;
          border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .type-chip:hover:not(.active) { color: #b5bfd8; border-color: #2d3450; }
        .type-chip.active { background: rgba(240,131,74,0.12); border-color: rgba(240,131,74,0.35); color: #f0834a; }

        /* Error */
        .error-banner { border: 1px solid rgba(240,107,107,0.35); background: rgba(240,107,107,0.1); color: #fca5a5; border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; flex-shrink: 0; }

        /* Scroll */
        .notif-scroll { flex: 1; padding-bottom: 20px; padding-right: 2px; }

        /* Empty state */
        .empty-state { border: 1px dashed #252d47; border-radius: 14px; color: #636f8d; font-size: 13px; text-align: center; padding: 52px 20px; margin-top: 8px; display: flex; flex-direction: column; align-items: center; gap: 10px; }

        /* Groups */
        .notif-group { margin-bottom: 20px; }
        .group-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #545c7a; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 0 2px; }
        .gdot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .unread-dot { background: #f0834a; }
        .read-dot { background: #3d4460; }

        /* List */
        .notif-list { display: flex; flex-direction: column; gap: 7px; }

        /* Pagination */
        .pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 0 4px; border-top: 1px solid #1e2235; margin-top: 8px; }
        .page-info { font-size: 11px; color: #636f8d; }
        .page-btns { display: flex; gap: 6px; }
        .page-btn {
          border: 1px solid #252b40; background: #151927; color: #636f8d;
          border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 4px;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .page-btn:hover:not(:disabled) { color: #c4cbe0; border-color: #2d3450; background: #1a1f30; }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Toast */
        .toast { position: fixed; bottom: 24px; right: 24px; z-index: 60; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; }
        .toast.success { background: rgba(61,214,140,0.15); border: 1px solid rgba(61,214,140,0.35); color: #3dd68c; }
        .toast.error   { background: rgba(240,107,107,0.15); border: 1px solid rgba(240,107,107,0.35); color: #f06b6b; }

        /* Responsive */
        @media (max-width: 860px) {
          .main-panel { padding: 18px 20px 0; }
        }
      `}</style>
    </>
  );
}
