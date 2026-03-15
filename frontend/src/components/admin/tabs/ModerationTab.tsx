import { Bot, Check, ExternalLink, RefreshCw, Trash2, User } from "lucide-react";

import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import ScrollArea from "@/components/shared/ScrollArea";
import { relativeTime } from "@/lib/workspaceUtils";
import type { ModerationAction, ModerationItem } from "@/types/admin";

type ModerationTabProps = {
  items: ModerationItem[];
  total: number;
  flaggedPosts: number;
  flaggedThreads: number;
  selectedIds: string[];
  actionLoading: string | null;
  bulkLoading: boolean;
  refreshing: boolean;
  onToggleItem: (itemKey: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onModerate: (item: ModerationItem, action: ModerationAction) => void;
  onBulkModerate: (action: ModerationAction) => void;
  onCheckItem: (item: ModerationItem) => void;
  onRefresh: () => void;
  onViewThread?: (threadId: string) => void;
  onViewAuthor?: (username: string) => void;
};

function scoreColor(score: number | null): string {
  if (score === null) return "#636f8d";
  if (score >= 0.8) return "#f06b6b";
  if (score >= 0.6) return "#f0834a";
  if (score >= 0.3) return "#e5c07b";
  return "#3dd68c";
}

function scoreBg(score: number | null): string {
  if (score === null) return "rgba(99, 111, 141, 0.12)";
  if (score >= 0.8) return "rgba(240, 107, 107, 0.12)";
  if (score >= 0.6) return "rgba(240, 131, 74, 0.12)";
  if (score >= 0.3) return "rgba(229, 192, 123, 0.12)";
  return "rgba(61, 214, 140, 0.12)";
}

export default function ModerationTab({
  items,
  total,
  flaggedPosts,
  flaggedThreads,
  selectedIds,
  actionLoading,
  bulkLoading,
  refreshing,
  onToggleItem,
  onToggleAll,
  onModerate,
  onBulkModerate,
  onCheckItem,
  onRefresh,
  onViewThread,
  onViewAuthor,
}: ModerationTabProps) {
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <div className="mod-shell">
      <div className="toolbar">
        <AdminSectionHeader title="Moderation Queue" countLabel={`${total} queued • ${flaggedThreads} threads • ${flaggedPosts} posts`} />

        <div className="queue-actions">
          <button
            type="button"
            className="mod-btn neutral"
            disabled={refreshing}
            onClick={onRefresh}
            title="Reload moderation queue from server"
          >
            <RefreshCw size={13} /> {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {items.length > 0 && (
          <div className="bulk-bar">
            <label className="bulk-check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={e => onToggleAll(e.target.checked)}
                title={allSelected ? "Unselect all queued items" : "Select all queued items"}
              />
              <span>{selectedIds.length} selected of {items.length}</span>
            </label>
            <button
              type="button"
              className="mod-btn approve"
              disabled={selectedIds.length === 0 || bulkLoading}
              onClick={() => onBulkModerate("approve")}
              title="Approve selected items (clear flags and keep content)"
            >
              <Check size={13} /> Approve Selected
            </button>
            <button
              type="button"
              className="mod-btn reject"
              disabled={selectedIds.length === 0 || bulkLoading}
              onClick={() => onBulkModerate("reject")}
              title="Remove selected items (reject and soft-delete)"
            >
              <Trash2 size={13} /> Remove Selected
            </button>
          </div>
        )}
      </div>

      <ScrollArea
        className="results"
        size="lg"
        tone="strong"
        style={{ flex: 1, minHeight: 0, overflowY: "scroll", paddingRight: 6 }}
      >
        {items.length === 0 ? (
          <div className="empty-wrap">
            <AdminEmptyState
              icon={Check}
              text="All clear. No flagged content pending review."
              color="#3dd68c"
            />
          </div>
        ) : (
          <div className="mod-list">
            {items.map(item => {
              const author = item.author_display_name ?? item.author_username ?? item.author_id.slice(-6);
              const title = item.type === "thread" ? (item.title ?? "(untitled thread)") : `Post in thread ${item.thread_id?.slice(-6) ?? "unknown"}`;
              const itemKey = `${item.type}:${item.id}`;
              const isActioning = actionLoading?.endsWith(`:${itemKey}`) ?? false;
              const checking = actionLoading === `check:${itemKey}`;
              const checked = selectedIds.includes(itemKey);
              const threadTarget = item.type === "thread" ? item.id : item.thread_id;
              return (
                <div key={itemKey} className="mod-card">
                  <div className="mod-header">
                    <label className="bulk-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => onToggleItem(itemKey, e.target.checked)}
                        title={checked ? "Unselect this item" : "Select this item for bulk action"}
                      />
                      <span />
                    </label>
                    <div className="mod-title-wrap">
                      <h3 className="mod-title">{title}</h3>
                      <div className="mod-author-row">
                        <span className={`mod-type ${item.type}`}>{item.type}</span>
                        <span className="mod-author">{author}</span>
                        <span className="mod-time">{relativeTime(item.created_at)}</span>
                      </div>
                    </div>
                    <div
                      className="mod-score-badge"
                      style={{ color: scoreColor(item.ai_score), backgroundColor: scoreBg(item.ai_score) }}
                      title={item.ai_score !== null ? `AI risk score ${(item.ai_score * 100).toFixed(0)}%` : "AI risk score not available"}
                    >
                      {item.ai_score !== null ? `${(item.ai_score * 100).toFixed(0)}%` : "n/a"}
                    </div>
                  </div>

                  <p className="mod-content" title={item.content ?? ""}>
                    {oneLinePreview(item.content)}
                  </p>

                  <div className="mod-footer">
                    <div className="mod-meta-info">
                      <span className="mod-id">ID: {item.id.slice(-8)}</span>
                      {item.is_deleted && <span className="mod-badge deleted">Deleted</span>}
                      {item.is_flagged && <span className="mod-badge flagged">Flagged</span>}
                    </div>

                    <div className="mod-action-buttons">
                      {onViewAuthor && item.author_username && (
                        <button
                          type="button"
                          className="mod-btn link"
                          onClick={() => onViewAuthor(item.author_username!)}
                          title="Open author profile"
                        >
                          <User size={12} />
                        </button>
                      )}
                      {onViewThread && threadTarget && (
                        <button
                          type="button"
                          className="mod-btn link"
                          onClick={() => onViewThread(threadTarget)}
                          title="Open thread context"
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="mod-btn neutral"
                        disabled={isActioning}
                        onClick={() => onCheckItem(item)}
                        title="Re-run AI check and update risk score"
                      >
                        <Bot size={13} /> {checking ? "Checking..." : "Check"}
                      </button>
                      <button
                        type="button"
                        className="mod-btn approve"
                        disabled={isActioning}
                        onClick={() => onModerate(item, "approve")}
                        title="Approve this item (clear flag and keep content)"
                      >
                        <Check size={13} /> Approve
                      </button>
                      <button
                        type="button"
                        className="mod-btn reject"
                        disabled={isActioning}
                        onClick={() => onModerate(item, "reject")}
                        title="Remove this item (reject and soft-delete)"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <style jsx>{`
        .mod-shell {
          display: flex;
          flex-direction: column;
          gap: 10px;
          height: 100%;
          min-height: 0;
        }
        .toolbar {
          flex-shrink: 0;
          padding-bottom: 8px;
          background: linear-gradient(180deg, #101626 0%, rgba(16, 22, 38, 0.95) 70%, rgba(16, 22, 38, 0));
        }
        .queue-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 12px;
        }
        .results {
          min-height: 120px;
        }
        .bulk-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #2a3554;
          background: linear-gradient(180deg, #121a2c, #101626);
          border-radius: 12px;
          padding: 10px 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .bulk-check {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #9ba3be;
          margin-right: auto;
        }
        .bulk-check input {
          accent-color: #f0834a;
        }
        .mod-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .empty-wrap {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .mod-card {
          border: 1px solid #2a3553;
          background: linear-gradient(180deg, #121a2c, #101626);
          border-radius: 14px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.2s ease;
        }
        .mod-card:hover {
          border-color: #364561;
          box-shadow: 0 4px 12px rgba(240, 131, 74, 0.08);
        }
        .mod-header {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: space-between;
        }
        .mod-title-wrap {
          flex: 1;
          min-width: 0;
        }
        .mod-title {
          margin: 0 0 7px;
          font-size: 15px;
          font-weight: 700;
          color: #e9efff;
          line-height: 1.3;
        }
        .mod-author-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .mod-type {
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .mod-type.thread {
          color: #f6c1a2;
          border: 1px solid rgba(240, 131, 74, 0.35);
          background: rgba(240, 131, 74, 0.17);
        }
        .mod-type.post {
          color: #a9bcff;
          border: 1px solid rgba(113, 139, 255, 0.35);
          background: rgba(113, 139, 255, 0.16);
        }
        .mod-author {
          font-size: 13px;
          font-weight: 700;
          color: #e4e8f4;
        }
        .mod-time {
          font-size: 12px;
          color: #8591b3;
        }
        .mod-score-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .mod-content {
          font-size: 14px;
          color: #b0b8d1;
          line-height: 1.4;
          margin: 0;
          padding: 12px 14px;
          background: #0d1322;
          border-radius: 8px;
          border: 1px solid #202a43;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mod-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .mod-meta-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .mod-id {
          font-size: 11px;
          color: #5f6a8d;
          font-family: monospace;
        }
        .mod-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .mod-badge.deleted {
          background: rgba(240, 107, 107, 0.15);
          color: #f6b0b0;
        }
        .mod-badge.flagged {
          background: rgba(240, 131, 74, 0.15);
          color: #ffb380;
        }
        .mod-action-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .mod-btn {
          border: 1px solid transparent;
          border-radius: 7px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        .mod-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .mod-btn.approve {
          background: rgba(61, 214, 140, 0.18);
          color: #90e7be;
          border-color: rgba(61, 214, 140, 0.28);
        }
        .mod-btn.approve:hover:not(:disabled) {
          background: rgba(61, 214, 140, 0.25);
          border-color: rgba(61, 214, 140, 0.38);
        }
        .mod-btn.reject {
          background: rgba(240, 107, 107, 0.18);
          color: #f4b0b0;
          border-color: rgba(240, 107, 107, 0.28);
        }
        .mod-btn.reject:hover:not(:disabled) {
          background: rgba(240, 107, 107, 0.25);
          border-color: rgba(240, 107, 107, 0.38);
        }
        .mod-btn.neutral {
          background: rgba(107, 138, 253, 0.16);
          color: #c3d4ff;
          border-color: rgba(107, 138, 253, 0.28);
        }
        .mod-btn.neutral:hover:not(:disabled) {
          background: rgba(107, 138, 253, 0.24);
          border-color: rgba(107, 138, 253, 0.38);
        }
        .mod-btn.link {
          background: rgba(149, 163, 198, 0.12);
          color: #95a3c6;
          border-color: rgba(149, 163, 198, 0.2);
          padding: 6px 10px;
        }
        .mod-btn.link:hover:not(:disabled) {
          background: rgba(149, 163, 198, 0.2);
          color: #c5d3e8;
        }
      `}</style>
    </div>
  );
}

function oneLinePreview(value: string | null): string {
  if (!value) return "";
  return value
    .replace(/\r?\n+/g, " ")
    .replace(/[*_`>#~[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
