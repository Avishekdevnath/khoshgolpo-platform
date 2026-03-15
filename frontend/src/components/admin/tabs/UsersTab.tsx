import { Ban, Download, Eye, Search, UserCheck, Users, X } from "lucide-react";
import { useState } from "react";

import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSkeleton from "@/components/admin/shared/AdminSkeleton";
import ScrollArea from "@/components/shared/ScrollArea";
import { avatarSeed, initials } from "@/lib/workspaceUtils";
import type { AdminUserItem, UserRole, UserSortOption } from "@/types/admin";

const ROLE_COLORS: Record<UserRole, { color: string; bg: string }> = {
  admin: { color: "#f0834a", bg: "rgba(240,131,74,0.12)" },
  moderator: { color: "#7c73f0", bg: "rgba(124,115,240,0.12)" },
  member: { color: "#3dd68c", bg: "rgba(61,214,140,0.12)" },
};

type UsersTabProps = {
  users: AdminUserItem[];
  total: number;
  search: string;
  sort: UserSortOption;
  roleFilter: UserRole | "";
  statusFilter: "active" | "inactive" | "";
  loading?: boolean;
  selectedIds: Set<string>;
  actionLoading: string | null;
  bulkLoading: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: UserSortOption) => void;
  onRoleFilterChange: (value: UserRole | "") => void;
  onStatusFilterChange: (value: "active" | "inactive" | "") => void;
  onRoleChange: (user: AdminUserItem, role: UserRole) => void;
  onStatusToggle: (user: AdminUserItem) => void;
  onViewProfile: (username: string) => void;
  onUserRowClick: (user: AdminUserItem) => void;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onBulkRoleChange: (role: UserRole) => void;
  onBulkActivate: () => void;
  onBulkDeactivate: () => void;
  onExport: (format: "csv" | "json") => void;
};

export default function UsersTab({
  users,
  total,
  search,
  sort,
  roleFilter,
  statusFilter,
  loading,
  selectedIds,
  actionLoading,
  bulkLoading,
  onSearchChange,
  onSortChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onRoleChange,
  onStatusToggle,
  onViewProfile,
  onUserRowClick,
  onToggleSelect,
  onToggleSelectAll,
  onBulkRoleChange,
  onBulkActivate,
  onBulkDeactivate,
  onExport,
}: UsersTabProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const allChecked = users.length > 0 && users.every(u => selectedIds.has(u.id));
  const someChecked = selectedIds.size > 0;

  return (
    <div className="users-shell">
      <div className="toolbar">
        <AdminSectionHeader title="Users" countLabel={`${total} total`} />

        <div className="toolbar-row">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              type="text"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search by username, email, or name..."
            />
            {search && (
              <button type="button" className="search-clear" onClick={() => onSearchChange("")}>
                <X size={13} />
              </button>
            )}
          </div>
          <select
            className="sort-select"
            value={sort}
            onChange={e => onSortChange(e.target.value as UserSortOption)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name_az">Name A-Z</option>
            <option value="name_za">Name Z-A</option>
          </select>
          <select
            className="sort-select"
            value={roleFilter}
            onChange={e => onRoleFilterChange(e.target.value as UserRole | "")}
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="member">Member</option>
          </select>
          <select
            className="sort-select"
            value={statusFilter}
            onChange={e => onStatusFilterChange(e.target.value as "active" | "inactive" | "")}
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="export-wrap">
            <button
              type="button"
              className="export-btn"
              onClick={() => setExportOpen(o => !o)}
              onBlur={() => setTimeout(() => setExportOpen(false), 150)}
              title="Export"
            >
              <Download size={13} />
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button type="button" onClick={() => { onExport("csv"); setExportOpen(false); }}>CSV</button>
                <button type="button" onClick={() => { onExport("json"); setExportOpen(false); }}>JSON</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ScrollArea
        className="results"
        size="lg"
        tone="strong"
        style={{ flex: 1, minHeight: 0, overflowY: "scroll", paddingRight: 6 }}
      >
        {loading && users.length === 0 ? (
          <AdminSkeleton rows={6} />
        ) : users.length === 0 ? (
          <AdminEmptyState icon={Users} text="No users found." />
        ) : (
          <div className="user-list">
            {/* Select-all header */}
            <div className="select-all-row">
              <label className="checkbox-wrap">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={e => onToggleSelectAll(e.target.checked)}
                />
                <span className="cb-label">
                  {allChecked ? "Deselect all" : "Select all"}
                </span>
              </label>
            </div>

            {users.map(user => {
              const [c1, c2] = avatarSeed(user.id);
              const roleCfg = ROLE_COLORS[user.role];
              const roleLoading = actionLoading === `role:${user.id}`;
              const statusLoading = actionLoading === `status:${user.id}`;
              const isSelected = selectedIds.has(user.id);
              return (
                <div
                  key={user.id}
                  className={`user-row ${isSelected ? "selected" : ""}`}
                  onClick={() => onUserRowClick(user)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter") onUserRowClick(user); }}
                >
                  <label className="checkbox-wrap" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => onToggleSelect(user.id, e.target.checked)}
                    />
                  </label>
                  <div className="ur-avatar" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>
                    {initials(user.display_name)}
                  </div>
                  <div className="ur-info">
                    <div className="ur-name">
                      {user.display_name}
                      {user.is_bot && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, border: "1px solid rgba(124,115,240,0.5)", color: "#9d97f0", background: "rgba(124,115,240,0.1)", letterSpacing: "0.04em", marginLeft: 5 }}>BOT</span>
                      )}
                    </div>
                    <div className="ur-username">@{user.username}</div>
                  </div>
                  <div className="ur-email">{user.email}</div>
                  <span className="ur-role" style={{ color: roleCfg.color, background: roleCfg.bg }}>
                    {user.role}
                  </span>
                  <span className={`ur-status ${user.is_active ? "active" : "inactive"}`}>
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                  <div className="ur-actions" onClick={e => e.stopPropagation()}>
                    <select
                      className="admin-select compact"
                      value={user.role}
                      disabled={roleLoading}
                      onChange={e => onRoleChange(user, e.target.value as UserRole)}
                    >
                      <option value="member">member</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      type="button"
                      className={`tiny-btn ${user.is_active ? "warn" : "ok"}`}
                      disabled={statusLoading}
                      onClick={() => onStatusToggle(user)}
                    >
                      {user.is_active ? <Ban size={12} /> : <UserCheck size={12} />}
                      {user.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" className="tiny-btn neutral" onClick={() => onViewProfile(user.username)}>
                      <Eye size={12} /> View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Bulk action bar */}
      {someChecked && (
        <div className="bulk-bar">
          <span className="bulk-count">{selectedIds.size} selected</span>
          <select
            className="admin-select compact"
            defaultValue=""
            disabled={bulkLoading}
            onChange={e => {
              const role = e.target.value as UserRole;
              if (role) {
                onBulkRoleChange(role);
                e.target.value = "";
              }
            }}
          >
            <option value="" disabled>Change role...</option>
            <option value="member">member</option>
            <option value="moderator">moderator</option>
            <option value="admin">admin</option>
          </select>
          <button type="button" className="tiny-btn ok" disabled={bulkLoading} onClick={onBulkActivate}>
            <UserCheck size={12} /> Activate
          </button>
          <button type="button" className="tiny-btn warn" disabled={bulkLoading} onClick={onBulkDeactivate}>
            <Ban size={12} /> Deactivate
          </button>
        </div>
      )}

      <style jsx>{`
        .users-shell {
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
        .toolbar-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .results {
          min-height: 120px;
        }
        .search-wrap {
          position: relative;
          flex: 1;
        }
        .search-wrap :global(.search-icon) {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #3d4460;
          pointer-events: none;
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
          outline: none;
        }
        .search-input::placeholder {
          color: #5f6a8b;
        }
        .search-input:focus {
          border-color: #55648e;
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
          padding: 4px;
        }
        .sort-select {
          border: 1px solid #2b3654;
          background: #131b2d;
          color: #e4e8f4;
          border-radius: 10px;
          padding: 0 12px;
          font-size: 12px;
          font-family: inherit;
          outline: none;
          cursor: pointer;
          white-space: nowrap;
        }
        .export-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .export-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 100%;
          min-height: 36px;
          border: 1px solid #2b3654;
          background: #131b2d;
          color: #8a96b8;
          border-radius: 10px;
          cursor: pointer;
          font-family: inherit;
        }
        .export-btn:hover {
          color: #e4e8f4;
          border-color: #3a4a70;
        }
        .export-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          background: #141c30;
          border: 1px solid #293553;
          border-radius: 8px;
          padding: 4px;
          z-index: 30;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 80px;
        }
        .export-menu button {
          background: transparent;
          border: none;
          color: #b8c4e0;
          font-size: 12px;
          font-family: inherit;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
        }
        .export-menu button:hover {
          background: #1e2a45;
          color: #e4e8f4;
        }
        .user-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .select-all-row {
          padding: 4px 14px;
        }
        .checkbox-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .checkbox-wrap input[type="checkbox"] {
          width: 15px;
          height: 15px;
          accent-color: #f0834a;
          cursor: pointer;
        }
        .cb-label {
          font-size: 11px;
          color: #8591b3;
        }
        .user-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 12px;
          background: linear-gradient(180deg, #121b2d, #101727);
          border: 1px solid #293553;
          flex-wrap: wrap;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .user-row:hover {
          border-color: #3a4a70;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
        }
        .user-row.selected {
          border-color: rgba(240, 131, 74, 0.4);
          background: linear-gradient(180deg, #15203a, #121a2f);
        }
        .ur-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }
        .ur-info {
          min-width: 0;
          flex: 1;
        }
        .ur-name {
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ur-username {
          font-size: 11px;
          color: #636f8d;
        }
        .ur-email {
          font-size: 12px;
          color: #8a96b8;
          min-width: 140px;
        }
        .ur-role {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 3px 9px;
          border-radius: 999px;
        }
        .ur-status {
          font-size: 11px;
          font-weight: 600;
        }
        .ur-status.active {
          color: #3dd68c;
        }
        .ur-status.inactive {
          color: #f06b6b;
        }
        .ur-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
          flex-wrap: wrap;
        }
        .admin-select {
          border: 1px solid #2e3958;
          background: #131c2f;
          color: #e4e8f4;
          border-radius: 8px;
          font-family: inherit;
        }
        .admin-select.compact {
          min-height: 32px;
          padding: 6px 8px;
          font-size: 11px;
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
        .tiny-btn.neutral {
          color: #c8d1ea;
        }
        .bulk-bar {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid rgba(240, 131, 74, 0.3);
          background: rgba(240, 131, 74, 0.08);
          animation: fadeUp 0.18s ease-out;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bulk-count {
          font-size: 12px;
          font-weight: 700;
          color: #f0a67a;
          margin-right: auto;
        }
        @media (max-width: 860px) {
          .ur-email {
            display: none;
          }
          .ur-actions {
            width: 100%;
            margin-left: 0;
          }
          .toolbar-row {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
