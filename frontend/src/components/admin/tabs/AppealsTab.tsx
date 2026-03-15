import { Check, ExternalLink, Gavel, ShieldCheck, ShieldX, User } from "lucide-react";

import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import ScrollArea from "@/components/shared/ScrollArea";
import { relativeTime } from "@/lib/workspaceUtils";
import type { AdminAppealItem, AppealStatus } from "@/types/admin";

type AppealsTabProps = {
  appeals: AdminAppealItem[];
  total: number;
  pendingCount: number;
  loading: boolean;
  statusFilter: "" | AppealStatus;
  actionLoading: string | null;
  onStatusChange: (value: "" | AppealStatus) => void;
  onResolve: (item: AdminAppealItem, action: "approve" | "reject") => void;
  onViewContent: (item: AdminAppealItem) => void;
  onViewProfile: (userId: string) => void;
  onViewThread: (threadId: string) => void;
};

function absoluteTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function AppealsTab({
  appeals,
  total,
  pendingCount,
  loading,
  statusFilter,
  actionLoading,
  onStatusChange,
  onResolve,
  onViewContent,
  onViewProfile,
  onViewThread,
}: AppealsTabProps) {
  return (
    <div className="appeals-shell">
      <div className="toolbar">
        <AdminSectionHeader title="Moderation Appeals" countLabel={`${total} appeals • ${pendingCount} pending`} />
        <div className="filter-row">
          <select className="admin-select" value={statusFilter} onChange={e => onStatusChange(e.target.value as "" | AppealStatus)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <ScrollArea
        className="results"
        size="lg"
        tone="strong"
        style={{ flex: 1, minHeight: 0, overflowY: "scroll", paddingRight: 6 }}
      >
        {loading ? (
          <div className="center-msg">Loading appeals...</div>
        ) : appeals.length === 0 ? (
          <AdminEmptyState icon={Check} text="No appeals found for this filter." color="#8ca6ff" />
        ) : (
          <div className="appeal-list">
            {appeals.map(item => {
              const resolveKey = `resolve:${item.id}`;
              const pendingAction = actionLoading === resolveKey;
              const isPending = item.status === "pending";
              const author = item.appellant_display_name ?? item.appellant_username ?? item.appellant_id.slice(-6);
              const statusLabel = item.status.toUpperCase();
              const statusClass = item.status;
              const threadTarget = item.thread_id ?? (item.content_type === "thread" ? item.content_id : null);
              const targetLabel = `${item.content_type} ${item.content_id.slice(-8)}`;

              return (
                <div key={item.id} className="appeal-card">
                  <div className="appeal-head">
                    <div className="appeal-title-wrap">
                      <h3 className="appeal-title">{targetLabel}</h3>
                      <div className="appeal-meta">
                        <span className={`status-chip ${statusClass}`}>{statusLabel}</span>
                        <span className="meta-author">by {author}</span>
                        <span className="meta-time" title={absoluteTime(item.created_at)}>{relativeTime(item.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <p className="label">Appeal reason</p>
                    <p className="text">{item.reason}</p>
                  </div>

                  {item.notification_message && (
                    <div className="row">
                      <p className="label">Original moderation notice</p>
                      <p className="text muted">{item.notification_message}</p>
                    </div>
                  )}

                  {!isPending && (
                    <div className="row">
                      <p className="label">Resolution</p>
                      <p className="text">
                        {item.status === "approved" ? "Approved" : "Rejected"}
                        {item.resolved_at ? ` • ${relativeTime(item.resolved_at)}` : ""}
                        {item.resolved_by_display_name || item.resolved_by_username ? ` by ${item.resolved_by_display_name ?? item.resolved_by_username}` : ""}
                      </p>
                      {item.admin_note && <p className="text muted">{item.admin_note}</p>}
                    </div>
                  )}

                  <div className="appeal-actions">
                    <button type="button" className="tiny-btn neutral" onClick={() => onViewContent(item)}>
                      <Gavel size={12} /> Open content
                    </button>
                    <button type="button" className="tiny-btn neutral" onClick={() => onViewProfile(item.appellant_id)}>
                      <User size={12} /> User
                    </button>
                    {threadTarget && (
                      <button type="button" className="tiny-btn neutral" onClick={() => onViewThread(threadTarget)}>
                        <ExternalLink size={12} /> Thread
                      </button>
                    )}
                    {isPending && (
                      <>
                        <button
                          type="button"
                          className="tiny-btn ok"
                          disabled={pendingAction}
                          onClick={() => onResolve(item, "approve")}
                        >
                          <ShieldCheck size={12} /> {pendingAction ? "Processing..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          className="tiny-btn warn"
                          disabled={pendingAction}
                          onClick={() => onResolve(item, "reject")}
                        >
                          <ShieldX size={12} /> {pendingAction ? "Processing..." : "Reject"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <style jsx>{`
        .appeals-shell {
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
        .admin-select {
          border: 1px solid #2d3957;
          background: #131c2f;
          color: #e4e8f4;
          border-radius: 10px;
          padding: 9px 10px;
          font-size: 12px;
          font-family: inherit;
        }
        .results {
          min-height: 120px;
        }
        .center-msg {
          text-align: center;
          color: #636f8d;
          padding: 32px 0;
        }
        .appeal-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .appeal-card {
          border: 1px solid #2a3553;
          background: linear-gradient(180deg, #121a2c, #101626);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .appeal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .appeal-title-wrap {
          min-width: 0;
          flex: 1;
        }
        .appeal-title {
          margin: 0 0 6px;
          color: #ebf1ff;
          font-size: 14px;
          line-height: 1.25;
          word-break: break-word;
        }
        .appeal-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          color: #8f9abe;
          font-size: 12px;
        }
        .status-chip {
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .status-chip.pending {
          color: #f6c5ab;
          border: 1px solid rgba(240, 131, 74, 0.35);
          background: rgba(240, 131, 74, 0.16);
        }
        .status-chip.approved {
          color: #8ce6ba;
          border: 1px solid rgba(61, 214, 140, 0.35);
          background: rgba(61, 214, 140, 0.16);
        }
        .status-chip.rejected {
          color: #f6b0b0;
          border: 1px solid rgba(240, 107, 107, 0.35);
          background: rgba(240, 107, 107, 0.16);
        }
        .row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .label {
          margin: 0;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #7b86a7;
        }
        .text {
          margin: 0;
          font-size: 13px;
          color: #d6def7;
          line-height: 1.45;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .text.muted {
          color: #aeb8d7;
        }
        .appeal-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 2px;
        }
        .tiny-btn {
          border: 1px solid #2f3a58;
          background: #182135;
          color: #c3cde7;
          border-radius: 8px;
          padding: 6px 9px;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-family: inherit;
        }
        .tiny-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .tiny-btn.neutral {
          color: #c3d4ff;
          border-color: rgba(107, 138, 253, 0.28);
          background: rgba(107, 138, 253, 0.16);
        }
        .tiny-btn.ok {
          color: #8ce6ba;
          border-color: rgba(61, 214, 140, 0.35);
          background: rgba(61, 214, 140, 0.16);
        }
        .tiny-btn.warn {
          color: #f6b0b0;
          border-color: rgba(240, 107, 107, 0.35);
          background: rgba(240, 107, 107, 0.16);
        }
      `}</style>
    </div>
  );
}
