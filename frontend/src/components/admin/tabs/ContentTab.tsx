import { Bell, Bot, Eye, FileText, Flag, Pencil, Pin, PinOff, Search, Trash2, X } from "lucide-react";

import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import ScrollArea from "@/components/shared/ScrollArea";
import { relativeTime } from "@/lib/workspaceUtils";
import type { AdminContentItem, ThreadStatus } from "@/types/admin";

type ContentTabProps = {
  items: AdminContentItem[];
  total: number;
  missingAiReports: number;
  loading: boolean;
  title?: string;
  countLabel?: string;
  lockDeletedFilter?: boolean;
  hideBulkAiAction?: boolean;
  search: string;
  contentType: "all" | "thread" | "post";
  statusFilter: "" | ThreadStatus;
  deletedFilter: "" | "true" | "false";
  flaggedFilter: "" | "true" | "false";
  actionLoading: string | null;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: "all" | "thread" | "post") => void;
  onStatusChange: (value: "" | ThreadStatus) => void;
  onDeletedChange: (value: "" | "true" | "false") => void;
  onFlaggedChange: (value: "" | "true" | "false") => void;
  onDeleteItem: (item: AdminContentItem) => void;
  onRereportMissing: () => void;
  onOpenItem: (item: AdminContentItem) => void;
  onRereportItem: (item: AdminContentItem) => void;
  onFlagToggle: (item: AdminContentItem) => void;
  onEditItem: (item: AdminContentItem) => void;
  onNotifyItem: (item: AdminContentItem) => void;
  onThreadStatusChange: (item: AdminContentItem, status: ThreadStatus) => void;
  onThreadPinToggle: (item: AdminContentItem) => void;
  onViewThread: (threadId: string) => void;
};

function aiSummary(score: number | null): { short: string; long: string } {
  if (score === null) {
    return {
      short: "AI pending",
      long: "AI report is not generated yet.",
    };
  }
  if (score >= 0.8) {
    return {
      short: `High risk ${score.toFixed(2)}`,
      long: `High risk content (score ${score.toFixed(2)}). Usually auto-flag range.`,
    };
  }
  if (score >= 0.6) {
    return {
      short: `Warning ${score.toFixed(2)}`,
      long: `Warning range (score ${score.toFixed(2)}). Should be reviewed by admin.`,
    };
  }
  if (score >= 0.3) {
    return {
      short: `Medium ${score.toFixed(2)}`,
      long: `Medium risk (score ${score.toFixed(2)}). Check context before action.`,
    };
  }
  return {
    short: `Safe ${score.toFixed(2)}`,
    long: `Likely safe content (score ${score.toFixed(2)}).`,
  };
}

export default function ContentTab({
  items,
  total,
  missingAiReports,
  loading,
  title,
  countLabel,
  lockDeletedFilter = false,
  hideBulkAiAction = false,
  search,
  contentType,
  statusFilter,
  deletedFilter,
  flaggedFilter,
  actionLoading,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onDeletedChange,
  onFlaggedChange,
  onDeleteItem,
  onRereportMissing,
  onOpenItem,
  onRereportItem,
  onFlagToggle,
  onEditItem,
  onNotifyItem,
  onThreadStatusChange,
  onThreadPinToggle,
  onViewThread,
}: ContentTabProps) {
  const rereportMissingLoading = actionLoading === "rereport:missing";
  const headerTitle = title ?? "Content Control";
  const headerCountLabel = countLabel ?? `${total} items`;

  return (
    <div className="content-shell">
      <div className="toolbar">
        <AdminSectionHeader title={headerTitle} countLabel={headerCountLabel} />

        <div className="filter-row">
          <div className="search-wrap grow">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              type="text"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search titles, post content..."
            />
            {search && (
              <button type="button" className="search-clear" onClick={() => onSearchChange("")}>
                <X size={13} />
              </button>
            )}
          </div>

          <select className="admin-select" value={contentType} onChange={e => onTypeChange(e.target.value as "all" | "thread" | "post")}>
            <option value="all">All</option>
            <option value="thread">Threads</option>
            <option value="post">Posts</option>
          </select>
          <select
            className="admin-select"
            value={deletedFilter}
            onChange={e => onDeletedChange(e.target.value as "" | "true" | "false")}
            disabled={lockDeletedFilter}
            title={lockDeletedFilter ? "Removed collection always shows deleted content only" : undefined}
          >
            <option value="">Any state</option>
            <option value="false">Active</option>
            <option value="true">Deleted</option>
          </select>
          <select
            className="admin-select"
            value={statusFilter}
            onChange={e => onStatusChange(e.target.value as "" | ThreadStatus)}
            disabled={contentType === "post"}
          >
            <option value="">Any status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
          <select
            className="admin-select"
            value={flaggedFilter}
            onChange={e => onFlaggedChange(e.target.value as "" | "true" | "false")}
          >
            <option value="">Any flag</option>
            <option value="true">Flagged</option>
            <option value="false">Not flagged</option>
          </select>
          {!hideBulkAiAction && (
            <button
              type="button"
              className="bulk-ai-btn"
              disabled={missingAiReports <= 0 || rereportMissingLoading}
              onClick={onRereportMissing}
              title={missingAiReports <= 0 ? "All listed content already has AI reports" : "Run AI re-report for items with missing reports"}
            >
              <Bot size={13} />
              {rereportMissingLoading ? "Running..." : `AI Re-report Missing (${missingAiReports})`}
            </button>
          )}
        </div>
      </div>

      <ScrollArea
        className="results"
        size="lg"
        tone="strong"
        style={{ flex: 1, minHeight: 0, overflowY: "scroll", paddingRight: 6 }}
      >
        {loading ? (
          <div className="center-msg">Loading content...</div>
        ) : items.length === 0 ? (
          <AdminEmptyState icon={FileText} text="No content found for current filters." />
        ) : (
          <div className="content-list">
            {items.map(item => {
              const deleting = actionLoading === `delete:${item.type}:${item.id}`;
              const rereporting = actionLoading === `rereport:${item.type}:${item.id}`;
              const flagging = actionLoading === `flag:${item.type}:${item.id}`;
              const editing = actionLoading === `edit:${item.type}:${item.id}`;
              const notifying = actionLoading === `notify:${item.type}:${item.id}`;
              const statusLoading = actionLoading === `status:${item.id}`;
              const pinLoading = actionLoading === `pin:${item.id}`;
              const flagged = Boolean(item.is_flagged);
              const ai = aiSummary(item.ai_score);
              const title = item.type === "thread" ? item.title ?? "(untitled thread)" : `Post in thread ${item.thread_id?.slice(-6)}`;
              const author = item.author_display_name ?? item.author_username ?? item.author_id.slice(-6);

              return (
                <div key={`${item.type}:${item.id}`} className="content-card">
                  <div className="content-head">
                    <div className="content-title">{title}</div>
                  </div>
                  <div className="content-author">by {author}</div>
                  <div className="meta-row">
                    <span className={`chip type ${item.type}`}>{item.type}</span>
                    {item.type === "thread" && item.status && <span className="chip">{item.status}</span>}
                    <span className={`chip ${item.ai_score === null ? "warn" : "ai"}`}>
                      {ai.short}
                    </span>
                    {flagged && <span className="chip warn">flagged</span>}
                    {item.is_deleted && <span className="chip warn">deleted</span>}
                    <span className="time">{relativeTime(item.created_at)}</span>
                  </div>
                  <div className="ai-note">{ai.long}</div>

                  <p className="content-preview" title={item.content ?? ""}>
                    {oneLinePreview(item.content)}
                  </p>

                  <div className="actions">
                    <button type="button" className="tiny-btn neutral" onClick={() => onOpenItem(item)}>
                      <Eye size={12} /> Moderate
                    </button>
                    {item.type === "thread" && (
                      <>
                        <select
                          className="admin-select compact"
                          value={item.status ?? "open"}
                          disabled={statusLoading}
                          onChange={e => onThreadStatusChange(item, e.target.value as ThreadStatus)}
                        >
                          <option value="open">open</option>
                          <option value="closed">closed</option>
                          <option value="archived">archived</option>
                        </select>
                        <button type="button" className="tiny-btn neutral" disabled={pinLoading} onClick={() => onThreadPinToggle(item)}>
                          {item.is_pinned ? <PinOff size={12} /> : <Pin size={12} />}
                          {item.is_pinned ? "Unpin" : "Pin"}
                        </button>
                        <button type="button" className="tiny-btn neutral" onClick={() => onViewThread(item.id)}>
                          <Eye size={12} /> View
                        </button>
                      </>
                    )}
                    {item.type === "post" && item.thread_id && (
                      <button type="button" className="tiny-btn neutral" onClick={() => onViewThread(item.thread_id!)}>
                        <Eye size={12} /> Thread
                      </button>
                    )}
                    <button type="button" className="tiny-btn neutral" disabled={rereporting} onClick={() => onRereportItem(item)}>
                      <Bot size={12} /> {rereporting ? "..." : "Re-report"}
                    </button>
                    <button type="button" className={`tiny-btn ${flagged ? "warn" : "ok"}`} disabled={flagging} onClick={() => onFlagToggle(item)}>
                      <Flag size={12} /> {flagged ? "Unflag" : "Flag"}
                    </button>
                    <button type="button" className="tiny-btn neutral" disabled={editing} onClick={() => onEditItem(item)}>
                      <Pencil size={12} /> Edit
                    </button>
                    <button type="button" className="tiny-btn neutral" disabled={notifying} onClick={() => onNotifyItem(item)}>
                      <Bell size={12} /> Notify
                    </button>
                    {!item.is_deleted && (
                      <button type="button" className="tiny-btn warn" disabled={deleting} onClick={() => onDeleteItem(item)}>
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <style jsx>{`
        .content-shell {
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
        .filter-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .grow {
          flex: 1;
        }
        .search-wrap {
          position: relative;
        }
        .search-wrap :global(.search-icon) {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #3d4460;
        }
        .search-input {
          width: 100%;
          border: 1px solid #2b3654;
          background: #131b2d;
          color: #e4e8f4;
          border-radius: 10px;
          padding: 10px 14px 10px 38px;
          font-size: 13px;
          font-family: inherit;
        }
        .search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: #636f8d;
          cursor: pointer;
        }
        .admin-select {
          border: 1px solid #2d3957;
          background: #131c2f;
          color: #e4e8f4;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 12px;
          font-family: inherit;
        }
        .admin-select.compact {
          padding: 6px 8px;
          min-height: 32px;
          font-size: 11px;
        }
        .bulk-ai-btn {
          border: 1px solid rgba(91, 125, 220, 0.45);
          background: rgba(91, 125, 220, 0.18);
          color: #b8ccff;
          border-radius: 10px;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-family: inherit;
        }
        .bulk-ai-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .center-msg {
          text-align: center;
          color: #636f8d;
          padding: 32px 0;
        }
        .results {
          min-height: 120px;
        }
        .content-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .content-card {
          border: 1px solid #2a3553;
          border-radius: 14px;
          background: linear-gradient(180deg, #121a2c, #101626);
          padding: 14px 16px;
        }
        .content-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .content-title {
          font-size: 15px;
          font-weight: 700;
          color: #e9efff;
        }
        .content-author {
          margin-top: 5px;
          font-size: 12px;
          color: #8a97b8;
        }
        .meta-row {
          margin-top: 8px;
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
          font-size: 12px;
        }
        .content-preview {
          margin: 10px 0 0;
          color: #aab2cb;
          font-size: 13px;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .actions {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tiny-btn {
          border: 1px solid #2f3a58;
          background: #182135;
          color: #b8c0d9;
          border-radius: 8px;
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-family: inherit;
        }
        .tiny-btn.warn {
          color: #f6b0b0;
          background: rgba(240, 107, 107, 0.16);
          border-color: rgba(240, 107, 107, 0.3);
        }
        .tiny-btn.ok {
          color: #8ce6ba;
          background: rgba(61, 214, 140, 0.16);
          border-color: rgba(61, 214, 140, 0.3);
        }
        .tiny-btn.neutral {
          color: #cbd4ed;
        }
      `}</style>
    </div>
  );
}

function oneLinePreview(value: string | null): string {
  if (!value) return "";
  const compact = value
    .replace(/\r?\n+/g, " ")
    .replace(/[*_`>#~[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return compact;
}
