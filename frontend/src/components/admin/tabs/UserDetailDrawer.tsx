import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Calendar,
  ClipboardList,
  ExternalLink,
  MessageSquare,
  StickyNote,
  UserCheck,
  Users as UsersIcon,
  X,
} from "lucide-react";

import {
  addAdminUserNote,
  getAdminUserDetail,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "@/lib/adminApi";
import { profilePathFromUsername } from "@/lib/profileRouting";
import { avatarSeed, initials, relativeTime } from "@/lib/workspaceUtils";
import type { AdminUserDetail, AuditLogItem, UserRole } from "@/types/admin";

type UserDetailDrawerProps = {
  userId: string;
  onClose: () => void;
  onUserUpdated: () => void;
};

const ROLE_COLORS: Record<UserRole, { color: string; bg: string }> = {
  admin: { color: "#f0834a", bg: "rgba(240,131,74,0.12)" },
  moderator: { color: "#7c73f0", bg: "rgba(124,115,240,0.12)" },
  member: { color: "#3dd68c", bg: "rgba(61,214,140,0.12)" },
};

export default function UserDetailDrawer({ userId, onClose, onUserUpdated }: UserDetailDrawerProps) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminUserDetail(userId);
      setDetail(res);
    } catch {
      setError("Failed to load user detail.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleRoleChange(role: UserRole) {
    if (!detail || detail.role === role) return;
    setActionLoading("role");
    try {
      await updateAdminUserRole(userId, role);
      await fetchDetail();
      onUserUpdated();
      setToast({ type: "ok", text: "Role updated" });
    } catch {
      setToast({ type: "err", text: "Failed to update role" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStatusToggle() {
    if (!detail) return;
    const nextStatus = !detail.is_active;
    setActionLoading("status");
    try {
      await updateAdminUserStatus(userId, nextStatus);
      await fetchDetail();
      onUserUpdated();
      setToast({ type: "ok", text: nextStatus ? "User activated" : "User deactivated" });
    } catch {
      setToast({ type: "err", text: "Failed to update status" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddNote() {
    const trimmed = noteText.trim();
    if (!trimmed || noteLoading) return;
    setNoteLoading(true);
    try {
      const res = await addAdminUserNote(userId, trimmed);
      setDetail(res);
      setNoteText("");
      setToast({ type: "ok", text: "Note added" });
    } catch {
      setToast({ type: "err", text: "Failed to add note" });
    } finally {
      setNoteLoading(false);
    }
  }

  const hasUnusualActivity = Boolean(
    detail &&
      (detail.login_attempts > 0 ||
        (detail.locked_until ? new Date(detail.locked_until).getTime() > Date.now() : false)),
  );

  const [c1, c2] = detail ? avatarSeed(detail.id) : ["#555", "#777"];

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="User detail">
        {/* Header */}
        <div className="drawer-head">
          <span className="drawer-label">User Detail</span>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close drawer">
            <X size={15} />
          </button>
        </div>

        <div className="drawer-body">
          {loading ? (
            <div className="center-msg">Loading...</div>
          ) : error || !detail ? (
            <div className="center-msg err">{error ?? "User not found"}</div>
          ) : (
            <>
              {/* Identity */}
              <div className="identity">
                <div className="avatar" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>
                  {initials(detail.display_name)}
                </div>
                <div className="id-text">
                  <div className="id-name">{detail.display_name}</div>
                  <div className="id-username">@{detail.username}</div>
                  <div className="id-email">{detail.email}</div>
                </div>
              </div>

              {/* Bio */}
              {detail.bio && <p className="bio">{detail.bio}</p>}

              {/* Metadata */}
              <div className="meta-row">
                <Calendar size={12} />
                <span>Joined {relativeTime(detail.created_at)}</span>
                <span className="sep">|</span>
                <span>Updated {relativeTime(detail.updated_at)}</span>
              </div>

              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <MessageSquare size={14} />
                  <span className="stat-num">{detail.total_posts}</span>
                  <span className="stat-lbl">Posts</span>
                </div>
                <div className="stat-card">
                  <ClipboardList size={14} />
                  <span className="stat-num">{detail.total_threads}</span>
                  <span className="stat-lbl">Threads</span>
                </div>
                <div className="stat-card">
                  <UsersIcon size={14} />
                  <span className="stat-num">{detail.followers_count}</span>
                  <span className="stat-lbl">Followers</span>
                </div>
                <div className="stat-card">
                  <UsersIcon size={14} />
                  <span className="stat-num">{detail.following_count}</span>
                  <span className="stat-lbl">Following</span>
                </div>
              </div>

              {/* Actions */}
              <div className="section">
                <div className="section-title">Actions</div>
                <div className="action-row">
                  <label className="action-label">Role</label>
                  <select
                    className="admin-select"
                    value={detail.role}
                    disabled={actionLoading === "role"}
                    onChange={e => void handleRoleChange(e.target.value as UserRole)}
                  >
                    <option value="member">member</option>
                    <option value="moderator">moderator</option>
                    <option value="admin">admin</option>
                  </select>
                  <span className="role-pill" style={{ color: ROLE_COLORS[detail.role].color, background: ROLE_COLORS[detail.role].bg }}>
                    {detail.role}
                  </span>
                </div>
                <div className="action-row">
                  <label className="action-label">Status</label>
                  <button
                    type="button"
                    className={`tiny-btn ${detail.is_active ? "warn" : "ok"}`}
                    disabled={actionLoading === "status"}
                    onClick={() => void handleStatusToggle()}
                  >
                    {detail.is_active ? <Ban size={12} /> : <UserCheck size={12} />}
                    {detail.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <span className={`status-pill ${detail.is_active ? "active" : "inactive"}`}>
                    {detail.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {/* Security */}
              <div className="section">
                <div className="section-title">
                  <ClipboardList size={13} /> Security
                </div>
                <div className={`security-box ${hasUnusualActivity ? "warn" : ""}`}>
                  <div className="security-row">
                    <span>Last login:</span>
                    <strong>{detail.last_login ? relativeTime(detail.last_login) : "Never"}</strong>
                  </div>
                  <div className="security-row">
                    <span>Failed attempts:</span>
                    <strong>{detail.login_attempts}</strong>
                  </div>
                  <div className="security-row">
                    <span>Locked until:</span>
                    <strong>{detail.locked_until ? relativeTime(detail.locked_until) : "Not locked"}</strong>
                  </div>
                  {hasUnusualActivity && (
                    <p className="security-warn">
                      <AlertTriangle size={12} /> Unusual activity detected. Consider enforcing password change.
                    </p>
                  )}
                </div>
              </div>

              {/* Admin Notes */}
              <div className="section">
                <div className="section-title">
                  <StickyNote size={13} /> Admin Notes ({detail.admin_notes.length})
                </div>
                <div className="note-form">
                  <textarea
                    className="note-input"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note about this user..."
                    rows={2}
                    maxLength={500}
                    disabled={noteLoading}
                  />
                  <button
                    type="button"
                    className="tiny-btn primary"
                    disabled={!noteText.trim() || noteLoading}
                    onClick={() => void handleAddNote()}
                  >
                    {noteLoading ? "Adding..." : "Add note"}
                  </button>
                </div>
                {detail.admin_notes.length > 0 && (
                  <div className="notes-list">
                    {detail.admin_notes.map((n, idx) => (
                      <div key={idx} className="note-item">
                        <div className="note-meta">
                          {n.admin_display_name ?? "Admin"} &middot; {relativeTime(n.created_at)}
                        </div>
                        <div className="note-body">{n.note}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Audit */}
              <div className="section">
                <div className="section-title">
                  <ClipboardList size={13} /> Recent Activity ({detail.recent_audit_logs.length})
                </div>
                {detail.recent_audit_logs.length === 0 ? (
                  <p className="empty-sub">No recent audit entries.</p>
                ) : (
                  <div className="audit-list">
                    {detail.recent_audit_logs.map((log: AuditLogItem) => (
                      <div key={log.id} className="audit-item">
                        <span className={`severity ${log.severity}`}>{log.severity}</span>
                        <span className="audit-action">{log.action}</span>
                        <span className="audit-time">{relativeTime(log.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* View profile link */}
              <a
                className="profile-link"
                href={profilePathFromUsername(detail.username)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={12} /> View public profile
              </a>
            </>
          )}
        </div>

        {toast && (
          <div className={`drawer-toast ${toast.type}`}>{toast.text}</div>
        )}
      </div>

      <style jsx>{`
        .drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 89;
          background: rgba(6, 9, 17, 0.45);
        }
        .drawer {
          position: fixed;
          top: 0;
          right: 0;
          z-index: 90;
          width: min(480px, calc(100vw - 40px));
          height: 100vh;
          border-left: 1px solid #243252;
          background: linear-gradient(180deg, #121a2b, #101727);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.22s ease-out;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .drawer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid #1e2740;
          flex-shrink: 0;
        }
        .drawer-label {
          font-family: var(--font-dm-serif), serif;
          font-size: 18px;
        }
        .close-btn {
          border: 1px solid #2f3c5d;
          background: #182135;
          color: #8f9abe;
          border-radius: 8px;
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .drawer-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .center-msg {
          text-align: center;
          color: #7b86a6;
          padding: 40px 0;
        }
        .center-msg.err {
          color: #f6b0b0;
        }
        .identity {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }
        .id-text {
          min-width: 0;
        }
        .id-name {
          font-size: 16px;
          font-weight: 700;
        }
        .id-username {
          font-size: 13px;
          color: #8591b3;
        }
        .id-email {
          font-size: 12px;
          color: #636f8d;
          margin-top: 2px;
        }
        .bio {
          margin: 0;
          font-size: 13px;
          color: #9aa6c6;
          line-height: 1.5;
        }
        .meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #636f8d;
        }
        .sep {
          color: #2f3957;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .stat-card {
          border: 1px solid #293553;
          border-radius: 10px;
          background: #141d30;
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: #8591b3;
        }
        .stat-num {
          font-size: 18px;
          font-weight: 700;
          color: #e4e8f4;
        }
        .stat-lbl {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .section {
          border-top: 1px solid #1e2740;
          padding-top: 14px;
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #8591b3;
          margin-bottom: 10px;
        }
        .action-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .action-label {
          font-size: 12px;
          color: #8591b3;
          width: 50px;
          flex-shrink: 0;
        }
        .admin-select {
          border: 1px solid #2e3958;
          background: #131c2f;
          color: #e4e8f4;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 11px;
          font-family: inherit;
        }
        .role-pill {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 3px 9px;
          border-radius: 999px;
        }
        .status-pill {
          font-size: 11px;
          font-weight: 600;
        }
        .status-pill.active {
          color: #3dd68c;
        }
        .status-pill.inactive {
          color: #f06b6b;
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
        .tiny-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .tiny-btn.warn {
          color: #f6b2b2;
          background: rgba(240, 107, 107, 0.16);
          border-color: rgba(240, 107, 107, 0.3);
        }
        .tiny-btn.ok {
          color: #8ce6ba;
          background: rgba(61, 214, 140, 0.16);
          border-color: rgba(61, 214, 140, 0.3);
        }
        .tiny-btn.primary {
          color: #f0a67a;
          background: rgba(240, 131, 74, 0.16);
          border-color: rgba(240, 131, 74, 0.3);
        }
        .tiny-btn.neutral {
          color: #c8d1ea;
        }
        .security-box {
          border: 1px solid #243050;
          border-radius: 8px;
          background: #141d30;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .security-box.warn {
          border-color: rgba(240, 107, 107, 0.32);
          background: rgba(240, 107, 107, 0.08);
        }
        .security-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 11px;
          color: #97a2c1;
        }
        .security-row strong {
          color: #e4e8f4;
          font-weight: 600;
        }
        .security-warn {
          margin: 2px 0 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #f6b0b0;
        }
        .note-form {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          margin-bottom: 10px;
        }
        .note-input {
          flex: 1;
          border: 1px solid #2f3c5d;
          background: #151f34;
          color: #e4e9f9;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
          font-family: inherit;
          resize: vertical;
          outline: none;
          min-height: 40px;
        }
        .note-input:focus {
          border-color: #f0834a;
        }
        .notes-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .note-item {
          border: 1px solid #232e4a;
          border-radius: 8px;
          background: #141d30;
          padding: 8px 10px;
        }
        .note-meta {
          font-size: 10px;
          color: #636f8d;
          margin-bottom: 3px;
        }
        .note-body {
          font-size: 12px;
          color: #c8d1ea;
          line-height: 1.45;
        }
        .audit-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .audit-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 6px;
          background: #141d30;
          font-size: 11px;
        }
        .severity {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .severity.info {
          color: #7cc2f0;
          background: rgba(124, 194, 240, 0.12);
        }
        .severity.warning {
          color: #f0c34a;
          background: rgba(240, 195, 74, 0.12);
        }
        .severity.critical {
          color: #f06b6b;
          background: rgba(240, 107, 107, 0.12);
        }
        .audit-action {
          color: #c8d1ea;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .audit-time {
          color: #636f8d;
          flex-shrink: 0;
        }
        .empty-sub {
          margin: 0;
          font-size: 12px;
          color: #636f8d;
        }
        .profile-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #7c73f0;
          text-decoration: none;
          padding: 8px 0;
        }
        .profile-link:hover {
          color: #9b8ef8;
        }
        .drawer-toast {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          z-index: 5;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }
        .drawer-toast.ok {
          background: rgba(61, 214, 140, 0.2);
          color: #85e6ba;
          border: 1px solid rgba(61, 214, 140, 0.34);
        }
        .drawer-toast.err {
          background: rgba(240, 107, 107, 0.2);
          color: #f4b3b3;
          border: 1px solid rgba(240, 107, 107, 0.34);
        }
      `}</style>
    </>
  );
}
