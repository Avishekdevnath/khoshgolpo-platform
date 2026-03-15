"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bot,
  Eye,
  Flag,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";

import {
  deletePostByAdmin,
  deleteThreadByAdmin,
  editAdminContentItem,
  getAdminContentItem,
  notifyAdminContentAuthor,
  rereportAdminContentItem,
  updateAdminContentFlag,
  updateThreadPinByAdmin,
  updateThreadStatusByAdmin,
} from "@/lib/adminApi";
import RichText from "@/components/shared/RichText";
import { relativeTime } from "@/lib/workspaceUtils";
import type { AdminContentItem, ThreadStatus } from "@/types/admin";

type AdminContentDetailPageProps = {
  contentType: "thread" | "post";
  contentId: string;
};

function aiSummary(score: number | null): string {
  if (score === null) return "AI report is missing. Re-report is recommended.";
  if (score >= 0.8) return `High risk (score ${score.toFixed(2)}). Auto-flag range.`;
  if (score >= 0.6) return `Warning range (score ${score.toFixed(2)}). Needs review.`;
  if (score >= 0.3) return `Medium risk (score ${score.toFixed(2)}). Review context.`;
  return `Likely safe (score ${score.toFixed(2)}).`;
}

export default function AdminContentDetailPage({ contentType, contentId }: AdminContentDetailPageProps) {
  const router = useRouter();
  const [item, setItem] = useState<AdminContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminContentItem(contentType, contentId);
      setItem(res);
    } catch {
      setError("Failed to load content detail.");
    } finally {
      setLoading(false);
    }
  }, [contentId, contentType]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleBackNavigation = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/admin/content");
  }, [router]);

  const handleRereport = useCallback(async () => {
    if (!item) return;
    setActionLoading("rereport");
    try {
      const updated = await rereportAdminContentItem(item.type, item.id);
      setItem(updated);
      setToast({ type: "ok", text: "AI report refreshed" });
    } catch {
      setToast({ type: "err", text: "Failed to re-report with AI" });
    } finally {
      setActionLoading(null);
    }
  }, [item]);

  const handleFlagToggle = useCallback(async () => {
    if (!item) return;
    setActionLoading("flag");
    try {
      const updated = await updateAdminContentFlag(item.type, item.id, !Boolean(item.is_flagged));
      setItem(updated);
      setToast({ type: "ok", text: updated.is_flagged ? "Item flagged" : "Item unflagged" });
    } catch {
      setToast({ type: "err", text: "Failed to update flag state" });
    } finally {
      setActionLoading(null);
    }
  }, [item]);

  const handleEdit = useCallback(async () => {
    if (!item) return;
    if (item.type === "thread") {
      const nextTitle = window.prompt("Edit thread title", item.title ?? "");
      if (nextTitle === null) return;
      const nextBody = window.prompt("Edit thread content", item.content ?? "");
      if (nextBody === null) return;
      setActionLoading("edit");
      try {
        const updated = await editAdminContentItem("thread", item.id, { title: nextTitle, content: nextBody });
        setItem(updated);
        setToast({ type: "ok", text: "Thread updated" });
      } catch {
        setToast({ type: "err", text: "Failed to edit thread" });
      } finally {
        setActionLoading(null);
      }
      return;
    }

    const nextContent = window.prompt("Edit post content", item.content ?? "");
    if (nextContent === null) return;
    setActionLoading("edit");
    try {
      const updated = await editAdminContentItem("post", item.id, { content: nextContent });
      setItem(updated);
      setToast({ type: "ok", text: "Post updated" });
    } catch {
      setToast({ type: "err", text: "Failed to edit post" });
    } finally {
      setActionLoading(null);
    }
  }, [item]);

  const handleNotify = useCallback(async () => {
    if (!item) return;
    const message = window.prompt("Notify the author", `Admin update: action taken on your ${item.type}.`);
    if (message === null) return;
    if (!message.trim()) {
      setToast({ type: "err", text: "Message cannot be empty" });
      return;
    }

    setActionLoading("notify");
    try {
      await notifyAdminContentAuthor(item.type, item.id, message.trim());
      setToast({ type: "ok", text: "Author notified" });
    } catch {
      setToast({ type: "err", text: "Failed to notify author" });
    } finally {
      setActionLoading(null);
    }
  }, [item]);

  const handleDelete = useCallback(async () => {
    if (!item || item.is_deleted) return;
    const ok = window.confirm(`Delete this ${item.type}?`);
    if (!ok) return;

    setActionLoading("delete");
    try {
      if (item.type === "thread") await deleteThreadByAdmin(item.id);
      else await deletePostByAdmin(item.id);
      await loadItem();
      setToast({ type: "ok", text: `${item.type} deleted` });
    } catch {
      setToast({ type: "err", text: "Failed to delete item" });
    } finally {
      setActionLoading(null);
    }
  }, [item, loadItem]);

  const handleStatusChange = useCallback(
    async (status: ThreadStatus) => {
      if (!item || item.type !== "thread") return;
      setActionLoading("status");
      try {
        await updateThreadStatusByAdmin(item.id, status);
        await loadItem();
        setToast({ type: "ok", text: "Thread status updated" });
      } catch {
        setToast({ type: "err", text: "Failed to update status" });
      } finally {
        setActionLoading(null);
      }
    },
    [item, loadItem],
  );

  const handlePinToggle = useCallback(async () => {
    if (!item || item.type !== "thread") return;
    setActionLoading("pin");
    try {
      await updateThreadPinByAdmin(item.id, !Boolean(item.is_pinned));
      await loadItem();
      setToast({ type: "ok", text: item.is_pinned ? "Thread unpinned" : "Thread pinned" });
    } catch {
      setToast({ type: "err", text: "Failed to update pin state" });
    } finally {
      setActionLoading(null);
    }
  }, [item, loadItem]);

  return (
    <div className="detail-root">
      <div className="head">
        <button type="button" className="back-btn" onClick={handleBackNavigation}>
          <ArrowLeft size={14} /> Back to Content
        </button>
      </div>

      <main className="panel">
        {loading ? (
          <div className="center-msg">Loading content detail...</div>
        ) : error || !item ? (
          <div className="error-box">
            <AlertTriangle size={14} /> {error ?? "Item not found"}
          </div>
        ) : (
          <>
            <h1 className="title">{item.type === "thread" ? item.title ?? "(untitled thread)" : `Post ${item.id.slice(-6)}`}</h1>
            <div className="author">by {item.author_display_name ?? item.author_username ?? item.author_id.slice(-6)}</div>

            <div className="meta-row">
              <span className={`chip type ${item.type}`}>{item.type}</span>
              {item.type === "thread" && item.status && <span className="chip">{item.status}</span>}
              <span className={`chip ${item.ai_score === null ? "warn" : "ai"}`}>
                {item.ai_score === null ? "AI pending" : `AI ${item.ai_score.toFixed(2)}`}
              </span>
              {item.is_flagged && <span className="chip warn">flagged</span>}
              {item.is_deleted && <span className="chip warn">deleted</span>}
              <span className="time">{relativeTime(item.created_at)}</span>
            </div>

            <div className="ai-note">{aiSummary(item.ai_score)}</div>

            <div className="actions">
              <button type="button" className="btn neutral" disabled={actionLoading !== null} onClick={handleRereport}>
                <Bot size={13} /> Re-report
              </button>
              <button type="button" className={`btn ${item.is_flagged ? "warn" : "ok"}`} disabled={actionLoading !== null} onClick={handleFlagToggle}>
                <Flag size={13} /> {item.is_flagged ? "Unflag" : "Flag"}
              </button>
              <button type="button" className="btn neutral" disabled={actionLoading !== null} onClick={handleEdit}>
                <Pencil size={13} /> Edit
              </button>
              <button type="button" className="btn neutral" disabled={actionLoading !== null} onClick={handleNotify}>
                <Bell size={13} /> Notify
              </button>
              {!item.is_deleted && (
                <button type="button" className="btn warn" disabled={actionLoading !== null} onClick={handleDelete}>
                  <Trash2 size={13} /> Delete
                </button>
              )}
              {item.type === "thread" && (
                <>
                  <select
                    className="admin-select"
                    value={item.status ?? "open"}
                    disabled={actionLoading !== null}
                    onChange={e => handleStatusChange(e.target.value as ThreadStatus)}
                  >
                    <option value="open">open</option>
                    <option value="closed">closed</option>
                    <option value="archived">archived</option>
                  </select>
                  <button type="button" className="btn neutral" disabled={actionLoading !== null} onClick={handlePinToggle}>
                    {item.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    {item.is_pinned ? "Unpin" : "Pin"}
                  </button>
                  <button type="button" className="btn neutral" onClick={() => router.push(`/threads/${item.id}`)}>
                    <Eye size={13} /> Open Thread
                  </button>
                </>
              )}
              {item.type === "post" && item.thread_id && (
                <button type="button" className="btn neutral" onClick={() => router.push(`/threads/${item.thread_id}`)}>
                  <Eye size={13} /> Open Thread
                </button>
              )}
            </div>

            <div className="content-box">
              <RichText content={item.content ?? ""} variant="full" />
            </div>
          </>
        )}
      </main>

      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}

      <style jsx>{`
        .detail-root {
          min-height: 100vh;
          padding: 16px;
          background:
            radial-gradient(circle at 10% 0%, rgba(103, 118, 230, 0.15), transparent 35%),
            radial-gradient(circle at 95% 0%, rgba(232, 133, 92, 0.15), transparent 30%),
            linear-gradient(165deg, #06080d 0%, #0a0e18 54%, #080c15 100%);
          color: #e4e9f9;
        }
        .head {
          max-width: 1200px;
          margin: 0 auto 10px;
        }
        .panel {
          max-width: 1200px;
          margin: 0 auto;
          border: 1px solid #1d2740;
          border-radius: 16px;
          background: linear-gradient(180deg, #111826 0%, #0f1521 62%, #0d121d 100%);
          padding: 20px;
        }
        .back-btn {
          border: 1px solid #2f3a58;
          background: #182135;
          color: #b8c0d9;
          border-radius: 9px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-family: inherit;
        }
        .title {
          margin: 0;
          font-family: var(--font-dm-serif), serif;
          font-size: 28px;
          line-height: 1.2;
        }
        .author {
          margin-top: 7px;
          font-size: 13px;
          color: #8a97b8;
        }
        .meta-row {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .chip {
          border: 1px solid #2f3a59;
          background: #172036;
          color: #aebadb;
          border-radius: 999px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
          padding: 2px 8px;
        }
        .chip.type.thread {
          color: #f6c1a2;
          border-color: rgba(240, 131, 74, 0.35);
          background: rgba(240, 131, 74, 0.17);
        }
        .chip.type.post {
          color: #a9bcff;
          border-color: rgba(113, 139, 255, 0.35);
          background: rgba(113, 139, 255, 0.16);
        }
        .chip.warn {
          color: #f6b0b0;
          border-color: rgba(240, 107, 107, 0.35);
          background: rgba(240, 107, 107, 0.17);
        }
        .chip.ai {
          color: #b8ccff;
          border-color: rgba(113, 139, 255, 0.35);
          background: rgba(113, 139, 255, 0.16);
        }
        .time {
          font-size: 11px;
          color: #7a87a8;
          margin-left: auto;
        }
        .ai-note {
          margin-top: 8px;
          color: #8f9bc1;
          font-size: 13px;
        }
        .actions {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }
        .btn {
          border: 1px solid #2f3a58;
          background: #182135;
          color: #b8c0d9;
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          font-family: inherit;
        }
        .btn.ok {
          color: #8ce6ba;
          background: rgba(61, 214, 140, 0.16);
          border-color: rgba(61, 214, 140, 0.3);
        }
        .btn.warn {
          color: #f6b0b0;
          background: rgba(240, 107, 107, 0.16);
          border-color: rgba(240, 107, 107, 0.3);
        }
        .btn.neutral {
          color: #cbd4ed;
        }
        .admin-select {
          border: 1px solid #2d3957;
          background: #131c2f;
          color: #e4e8f4;
          border-radius: 10px;
          padding: 7px 9px;
          font-size: 12px;
          font-family: inherit;
        }
        .content-box {
          margin-top: 14px;
          border: 1px solid #222d49;
          border-radius: 12px;
          background: #0f1627;
          padding: 14px;
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
          position: fixed;
          right: 18px;
          bottom: 18px;
          padding: 10px 13px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          z-index: 20;
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
      `}</style>
    </div>
  );
}
