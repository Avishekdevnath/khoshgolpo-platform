"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Edit2, MessageSquare, MoreHorizontal } from "lucide-react";

import PageLoader from "@/components/shared/PageLoader";
import WorkspaceShell from "@/components/app/WorkspaceShell";
import { apiGet, apiPatch } from "@/lib/api";
import { getFollowStatus } from "@/lib/followApi";
import { useAuthStore } from "@/store/authStore";
import { avatarSeed, initials, relativeTime } from "@/lib/workspaceUtils";
import FollowButton from "@/components/shared/FollowButton";
import ConnectionButton from "@/components/shared/ConnectionButton";
import FollowersModal from "@/components/shared/FollowersModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserOut = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  bio: string | null;
  role: "member" | "moderator" | "admin";
  is_active: boolean;
  is_bot?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  created_at: string;
  updated_at: string;
};

type ThreadOut = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  author_id: string;
  post_count: number;
  status: "open" | "closed" | "archived";
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type ThreadListResponse = {
  data: ThreadOut[];
  page: number;
  limit: number;
  total: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJoinDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const ROLE_CFG = {
  admin:     { label: "Admin",     color: "#f0834a", bg: "rgba(240,131,74,0.12)",  border: "rgba(240,131,74,0.3)" },
  moderator: { label: "Moderator", color: "#7c73f0", bg: "rgba(124,115,240,0.12)", border: "rgba(124,115,240,0.3)" },
  member:    { label: "Member",    color: "#3dd68c", bg: "rgba(61,214,140,0.12)",  border: "rgba(61,214,140,0.3)" },
};

const THREAD_STATUS_CFG = {
  open:     { label: "Open",     color: "#3dd68c" },
  closed:   { label: "Closed",   color: "#f0834a" },
  archived: { label: "Archived", color: "#636f8d" },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  const sk: React.CSSProperties = { borderRadius: 6, background: "#1a1f2e", animation: "sk 1.4s ease infinite" };
  return (
    <div>
      <div style={{ height: 148, background: "linear-gradient(135deg,#14182a,#0f1118)", animation: "sk 1.4s ease infinite" }} />
      <div style={{ padding: "0 28px 28px" }}>
        <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#1e2540", border: "4px solid #10131d", marginTop: -44, marginBottom: 16, animation: "sk 1.4s ease infinite" }} />
        <div style={{ ...sk, width: "40%", height: 26, marginBottom: 10 }} />
        <div style={{ ...sk, width: "22%", height: 14, marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <div style={{ ...sk, width: 70, height: 22, borderRadius: 999 }} />
          <div style={{ ...sk, width: 58, height: 22, borderRadius: 999 }} />
        </div>
        <div style={{ ...sk, width: "100%", height: 13, marginBottom: 8 }} />
        <div style={{ ...sk, width: "65%", height: 13, marginBottom: 24 }} />
        {[0, 1, 2].map(i => (
          <div key={i} style={{ ...sk, height: 72, borderRadius: 12, marginBottom: 8, animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Thread card ──────────────────────────────────────────────────────────────

function ThreadCard({ thread, onClick }: { thread: ThreadOut; onClick: () => void }) {
  const sc = THREAD_STATUS_CFG[thread.status] ?? THREAD_STATUS_CFG.open;
  return (
    <button type="button" className="tcard" onClick={onClick}>
      <div className="tc-head">
        <span className="tc-title">{thread.title}</span>
        <span className="tc-status" style={{ color: sc.color }}>{sc.label}</span>
      </div>
      {thread.tags.length > 0 && (
        <div className="tc-tags">
          {thread.tags.map(tag => <span key={tag} className="tc-tag">#{tag}</span>)}
        </div>
      )}
      <div className="tc-meta">
        <span className="tc-replies">
          <MessageSquare size={11} />
          {thread.post_count} {thread.post_count === 1 ? "reply" : "replies"}
        </span>
        <span className="tc-time">{relativeTime(thread.created_at)}</span>
      </div>
      <style jsx>{`
        .tcard {
          display: block; width: 100%; text-align: left;
          border: 1px solid #1e2235; border-radius: 12px;
          background: linear-gradient(180deg,#111422,#0f1118);
          padding: 16px 18px; cursor: pointer; transition: all 0.16s; font-family: inherit;
        }
        .tcard:hover {
          border-color: #272e48;
          background: linear-gradient(180deg,#141827,#111422);
          box-shadow: 0 4px 20px rgba(0,0,0,0.35);
          transform: translateY(-1px);
        }
        .tc-head { display: flex; align-items: flex-start; gap: 10px; justify-content: space-between; margin-bottom: 10px; }
        .tc-title { font-size: 14px; font-weight: 600; color: #dde2f2; line-height: 1.45; margin: 0; flex: 1; text-align: left; }
        .tc-status { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; flex-shrink: 0; padding-top: 2px; }
        .tc-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
        .tc-tag { font-size: 10px; font-weight: 600; color: #7c73f0; background: rgba(124,115,240,0.1); border: 1px solid rgba(124,115,240,0.2); border-radius: 999px; padding: 2px 8px; }
        .tc-meta { display: flex; align-items: center; gap: 12px; border-top: 1px solid #181c28; padding-top: 10px; }
        .tc-replies { font-size: 11px; color: #6b738f; display: inline-flex; align-items: center; gap: 4px; }
        .tc-time { font-size: 11px; color: #3d4460; margin-left: auto; }
      `}</style>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type UserProfileWorkspaceProps = {
  userId: string;
};

export default function UserProfileWorkspace({ userId }: UserProfileWorkspaceProps) {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();

  // ── Profile data ─────────────────────────────────────────────────────────
  const [profileUser, setProfileUser]       = useState<UserOut | null>(null);
  const [threads, setThreads]               = useState<ThreadOut[]>([]);
  const [threadTotal, setThreadTotal]       = useState(0);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"followers" | "following">("followers");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followsYou, setFollowsYou] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // ── Mobile menu ─────────────────────────────────────────────────────────
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen]);

  // ── Admin edit modal ────────────────────────────────────────────────────
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfileUser(null);
    setThreads([]);
    setThreadTotal(0);

    async function load() {
      try {
        const u = await apiGet<UserOut>(`users/${encodeURIComponent(userId)}`);
        if (cancelled) return;
        setProfileUser(u);

        // Fetch follow status + counts
        try {
          const fs = await getFollowStatus(u.id);
          if (!cancelled) {
            setIsFollowing(fs.is_following);
            setFollowsYou(fs.follows_you);
            setFollowersCount(fs.followers_count);
            setFollowingCount(fs.following_count);
          }
        } catch {
          // Non-fatal
        }

        setThreadsLoading(true);
        try {
          const t = await apiGet<ThreadListResponse>(
            `threads?author_id=${encodeURIComponent(u.id)}&limit=10&sort=newest`
          );
          if (!cancelled) { setThreads(t.data); setThreadTotal(t.total); }
        } catch {
          // Non-fatal: profile still renders without threads
        } finally {
          if (!cancelled) setThreadsLoading(false);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [userId]);

  const roleCfg      = profileUser ? (ROLE_CFG[profileUser.role] ?? ROLE_CFG.member) : null;
  const [pav1, pav2] = avatarSeed(profileUser?.id ?? userId);
  const isOwnProfile = Boolean(currentUser && profileUser && currentUser.id === profileUser.id);
  const isAdmin = currentUser?.role === "admin";

  function openAdminEdit() {
    if (!profileUser) return;
    setEditDisplayName(profileUser.display_name);
    setEditBio(profileUser.bio ?? "");
    setEditMsg(null);
    setAdminEditOpen(true);
  }

  async function handleAdminEditSave() {
    if (!profileUser || !editDisplayName.trim()) return;
    setEditSaving(true);
    setEditMsg(null);
    try {
      const updated = await apiPatch<UserOut>(`admin/users/${profileUser.id}/profile`, {
        display_name: editDisplayName.trim(),
        bio: editBio.trim() || null,
      });
      setProfileUser(updated);
      setEditMsg({ type: "ok", text: "Profile updated" });
      setTimeout(() => setAdminEditOpen(false), 800);
    } catch {
      setEditMsg({ type: "err", text: "Failed to update profile" });
    } finally {
      setEditSaving(false);
    }
  }

  if (loading && !profileUser) {
    return <PageLoader />;
  }

  return (
    <>
      <WorkspaceShell wrapPanel={false}>
        <section className="ws-panel main-panel">
          <div className="main-scroll ws-scroll">

          <div className="back-row">
            <button type="button" className="back-btn" onClick={() => router.back()}>
              <ArrowLeft size={14} /> Back
            </button>
            {isOwnProfile && <span className="own-badge">Your profile</span>}
          </div>

          {loading && <ProfileSkeleton />}

          {!loading && error && (
            <div className="error-banner">
              <span>{error}</span>
              <button type="button" onClick={() => router.push("/threads")}>Go to Threads</button>
            </div>
          )}

          {!loading && !error && profileUser && (
            <>
              {/* ── Cover banner ── */}
              <div className="cover" style={{
                background: `linear-gradient(135deg, ${pav1}26 0%, ${pav2}18 50%, #0f1118 100%),
                             linear-gradient(180deg, #131828 0%, #0f1118 100%)`
              }}>
                <div className="cover-shimmer" style={{
                  background: `radial-gradient(ellipse at 25% 60%, ${pav1}1f 0%, transparent 55%)`
                }} />
              </div>

              {/* ── Profile header ── */}
              <div className="profile-header">
                <div className="avatar-row">
                  <div className="profile-av-wrap">
                    <div className="profile-av" style={{ background: `linear-gradient(135deg,${pav1},${pav2})` }}>
                      {initials(profileUser.display_name)}
                    </div>
                    {profileUser.is_active && <span className="av-online-dot" />}
                  </div>

                  {/* Desktop action buttons */}
                  <div className="avatar-actions desktop-actions">
                    {isOwnProfile && (
                      <button type="button" className="edit-btn" onClick={() => router.push("/settings")}>
                        <Edit2 size={12} /> Edit profile
                      </button>
                    )}
                    {!isOwnProfile && (
                      <div className="action-btns">
                        {isAdmin && (
                          <button type="button" className="edit-btn" onClick={openAdminEdit}>
                            <Edit2 size={12} /> Edit
                          </button>
                        )}
                        <ConnectionButton userId={profileUser.id} />
                        <FollowButton
                          userId={profileUser.id}
                          initialFollowing={isFollowing}
                          followsYou={followsYou}
                          onFollowChange={(following, fCount, fgCount) => {
                            setIsFollowing(following);
                            setFollowersCount(fCount);
                            setFollowingCount(fgCount);
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Mobile "..." menu */}
                  <div className="mobile-menu-wrap" ref={mobileMenuRef}>
                    <button
                      type="button"
                      className="mobile-menu-trigger"
                      onClick={() => setMobileMenuOpen(o => !o)}
                      aria-label="Profile actions"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {mobileMenuOpen && (
                      <div className="mobile-menu-dropdown">
                        {!isOwnProfile && (
                          <>
                            <div className="mobile-menu-item-wrap" onClick={closeMobileMenu}>
                              <FollowButton
                                userId={profileUser.id}
                                initialFollowing={isFollowing}
                                followsYou={followsYou}
                                onFollowChange={(following, fCount, fgCount) => {
                                  setIsFollowing(following);
                                  setFollowersCount(fCount);
                                  setFollowingCount(fgCount);
                                }}
                              />
                            </div>
                            <div className="mobile-menu-item-wrap" onClick={closeMobileMenu}>
                              <ConnectionButton userId={profileUser.id} />
                            </div>
                            {isAdmin && (
                              <button
                                type="button"
                                className="mobile-menu-item"
                                onClick={() => { closeMobileMenu(); openAdminEdit(); }}
                              >
                                <Edit2 size={14} /> Admin Edit
                              </button>
                            )}
                          </>
                        )}
                        {isOwnProfile && (
                          <button
                            type="button"
                            className="mobile-menu-item"
                            onClick={() => { closeMobileMenu(); router.push("/settings"); }}
                          >
                            <Edit2 size={14} /> Edit profile
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <h1 className="profile-name">{profileUser.display_name}</h1>
                {profileUser.is_bot && (
                  <div style={{ fontSize: 12, color: "#9d97f0", marginBottom: 2 }}>Automated Account</div>
                )}
                <div className="profile-username-row">
                  <span className="profile-username">@{profileUser.username}</span>
                  {profileUser.gender && (
                    <span className="profile-gender">{profileUser.gender}</span>
                  )}
                </div>

                <div className="profile-badges">
                  {roleCfg && (
                    <span className="badge-pill"
                      style={{ color: roleCfg.color, background: roleCfg.bg, border: `1px solid ${roleCfg.border}` }}>
                      {roleCfg.label}
                    </span>
                  )}
                  <span className="badge-pill" style={
                    profileUser.is_active
                      ? { color: "#3dd68c", background: "rgba(61,214,140,0.1)", border: "1px solid rgba(61,214,140,0.25)" }
                      : { color: "#f06b6b", background: "rgba(240,107,107,0.1)", border: "1px solid rgba(240,107,107,0.25)" }
                  }>
                    {profileUser.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {profileUser.bio && <p className="profile-bio">{profileUser.bio}</p>}

                <div className="follow-stats-row">
                  <button
                    className="follow-stat-btn"
                    onClick={() => {
                      setModalType("followers");
                      setFollowersModalOpen(true);
                    }}
                  >
                    <strong className="follow-stat-num">{followersCount}</strong> followers
                  </button>
                  <button
                    className="follow-stat-btn"
                    onClick={() => {
                      setModalType("following");
                      setFollowingModalOpen(true);
                    }}
                  >
                    <strong className="follow-stat-num">{followingCount}</strong> following
                  </button>
                </div>

                <div className="stats-row">
                  <div className="stat">
                    <span className="stat-value">{threadTotal}</span>
                    <span className="stat-label">{threadTotal === 1 ? "Thread" : "Threads"}</span>
                  </div>
                  <div className="stat-divider" />
                  <div className="stat">
                    <Calendar size={12} style={{ color: "#4a5270" }} />
                    <span className="stat-label">Joined {formatJoinDate(profileUser.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* ── Threads ── */}
              <div className="threads-section">
                <div className="section-header">
                  <span className="section-title">Threads</span>
                  {threadTotal > 0 && <span className="section-count">{threadTotal}</span>}
                </div>

                {threadsLoading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ height: 72, border: "1px solid #1e2235", borderRadius: 12, background: "#10131d", animation: `sk 1.4s ease infinite ${i * 0.12}s` }} />
                    ))}
                  </div>
                )}

                {!threadsLoading && threads.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <MessageSquare size={22} strokeWidth={1.5} />
                    </div>
                    <p className="empty-title">No threads yet</p>
                    <p className="empty-sub">
                      {isOwnProfile
                        ? "Start a conversation in the threads section."
                        : `${profileUser.display_name} hasn\u2019t posted any threads yet.`}
                    </p>
                  </div>
                )}

                {!threadsLoading && threads.length > 0 && (
                  <div className="threads-list">
                    {threads.map(t => (
                      <ThreadCard key={t.id} thread={t} onClick={() => router.push(`/threads/${t.id}`)} />
                    ))}
                    {threadTotal > threads.length && (
                      <p className="showing-note">Showing {threads.length} of {threadTotal} threads</p>
                    )}
                  </div>
                )}
              </div>

              {followersModalOpen && (
                <FollowersModal
                  userId={profileUser.id}
                  type={modalType}
                  onClose={() => setFollowersModalOpen(false)}
                />
              )}
              {followingModalOpen && (
                <FollowersModal
                  userId={profileUser.id}
                  type={modalType}
                  onClose={() => setFollowingModalOpen(false)}
                />
              )}

              {/* ── Admin Edit Modal ── */}
              {adminEditOpen && (
                <div className="modal-overlay" onClick={() => setAdminEditOpen(false)} role="dialog" aria-modal="true" aria-labelledby="admin-edit-title">
                  <div className="modal-box" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3 id="admin-edit-title" className="modal-title">Edit User Profile</h3>
                      <button type="button" className="modal-close" onClick={() => setAdminEditOpen(false)}>&times;</button>
                    </div>
                    <label className="modal-label">Display Name</label>
                    <input
                      className="modal-input"
                      type="text"
                      value={editDisplayName}
                      onChange={e => setEditDisplayName(e.target.value)}
                      maxLength={80}
                    />
                    <label className="modal-label">Bio</label>
                    <textarea
                      className="modal-input modal-textarea"
                      value={editBio}
                      onChange={e => setEditBio(e.target.value)}
                      maxLength={280}
                      rows={3}
                      placeholder="User bio..."
                    />
                    <div className="modal-hint">{editBio.length}/280</div>
                    {editMsg && (
                      <div className={`modal-msg ${editMsg.type === "ok" ? "msg-ok" : "msg-err"}`}>{editMsg.text}</div>
                    )}
                    <button
                      type="button"
                      className="modal-save"
                      disabled={editSaving || !editDisplayName.trim()}
                      onClick={handleAdminEditSave}
                    >
                      {editSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </section>
      </WorkspaceShell>

      <style jsx>{`
        .main-scroll { flex: 1; padding-bottom: 40px; position: relative; }

        /* Back row — floats above cover */
        .back-row {
          display: flex; align-items: center; gap: 10px;
          padding: 16px 20px; position: absolute; z-index: 10;
        }
        .back-btn {
          border: 1px solid rgba(30,34,53,0.7); background: rgba(12,14,22,0.7);
          backdrop-filter: blur(8px); color: #b8c0d8;
          border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 5px;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .back-btn:hover { color: #e4e8f4; border-color: #2d3450; background: rgba(20,24,38,0.88); }
        .own-badge {
          font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
          color: #f0834a; background: rgba(12,14,22,0.7); border: 1px solid rgba(240,131,74,0.35);
          backdrop-filter: blur(8px); border-radius: 999px; padding: 3px 10px;
        }

        /* Error */
        .error-banner {
          margin: 60px 24px 0; border: 1px solid rgba(240,107,107,0.35);
          background: rgba(240,107,107,0.08); color: #fca5a5;
          border-radius: 10px; padding: 16px; font-size: 13px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .error-banner button {
          border: 1px solid rgba(240,107,107,0.3); background: transparent;
          color: #fca5a5; border-radius: 7px; padding: 5px 12px;
          font-size: 12px; cursor: pointer; font-family: inherit; white-space: nowrap;
        }

        /* Cover banner */
        .cover {
          height: 148px; width: 100%; position: relative; overflow: hidden; flex-shrink: 0;
          border-radius: 13px 13px 0 0;
        }
        .cover-shimmer { position: absolute; inset: 0; }

        /* Profile header */
        .profile-header { padding: 0 28px 24px; border-bottom: 1px solid #181c28; }
        .avatar-row { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 14px; }
        .profile-av-wrap { position: relative; margin-top: -44px; flex-shrink: 0; }
        .profile-av {
          width: 88px; height: 88px; border-radius: 50%;
          display: grid; place-items: center;
          font-family: var(--font-dm-serif),serif; font-size: 26px; font-weight: 700; color: #fff;
          border: 4px solid #10131d;
          box-shadow: 0 0 0 1px #1e2235, 0 8px 28px rgba(0,0,0,0.55);
        }
        .av-online-dot {
          position: absolute; bottom: 6px; right: 4px;
          width: 13px; height: 13px; border-radius: 50%;
          background: #3dd68c; border: 2.5px solid #10131d;
        }
        .avatar-actions { display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .action-btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

        /* Mobile menu — hidden on desktop */
        .mobile-menu-wrap { display: none; position: relative; }
        .mobile-menu-trigger {
          width: 36px; height: 36px; border-radius: 10px;
          border: 1px solid #252b40; background: rgba(16,19,29,0.9);
          backdrop-filter: blur(8px);
          color: #8a93ae; cursor: pointer;
          display: grid; place-items: center;
          transition: all 0.15s; font-family: inherit;
        }
        .mobile-menu-trigger:hover { color: #e4e8f4; border-color: #2d3450; background: #1a1f30; }
        .mobile-menu-dropdown {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
          min-width: 200px;
          background: linear-gradient(180deg,#141827,#0f1118);
          border: 1px solid #252b40; border-radius: 12px;
          padding: 6px; box-shadow: 0 12px 40px rgba(0,0,0,0.55);
          animation: menuSlideIn 0.15s ease;
        }
        @keyframes menuSlideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .mobile-menu-item-wrap {
          padding: 0; cursor: pointer;
        }
        .mobile-menu-item-wrap :global(button) {
          width: 100% !important; justify-content: flex-start !important;
          border-radius: 8px !important; padding: 10px 12px !important;
          font-size: 13px !important; font-weight: 600 !important;
          border: none !important; background: transparent !important;
          color: #8a93ae !important; opacity: 1 !important;
          font-family: inherit !important; transition: all 0.12s !important;
        }
        .mobile-menu-item-wrap :global(button:hover) {
          background: rgba(255,255,255,0.04) !important; color: #e4e8f4 !important;
        }
        .mobile-menu-item-wrap :global(button:disabled) {
          opacity: 0.5 !important; cursor: wait !important;
        }
        .mobile-menu-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; border: none; background: transparent;
          color: #8a93ae; font-size: 13px; font-weight: 600;
          padding: 10px 12px; border-radius: 8px;
          cursor: pointer; font-family: inherit; transition: all 0.12s;
        }
        .mobile-menu-item:hover { background: rgba(255,255,255,0.04); color: #e4e8f4; }
        .edit-btn {
          border: 1px solid #252b40; background: #131722; color: #8a93ae;
          border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 6px;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .edit-btn:hover { color: #e4e8f4; border-color: #2d3450; background: #1a1f30; }

        .profile-name {
          font-family: var(--font-dm-serif),serif; font-size: 24px; line-height: 1.2;
          margin: 0 0 4px; color: #eceef8; letter-spacing: -0.01em;
          word-break: break-word;
        }
        .profile-username-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .profile-username { font-size: 13px; color: #505a72; }
        .profile-gender {
          font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
          color: #7c73f0; background: rgba(124,115,240,0.1); border: 1px solid rgba(124,115,240,0.2);
          border-radius: 999px; padding: 2px 8px;
        }
        .profile-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .badge-pill { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 3px 10px; }
        .profile-bio {
          font-size: 13.5px; line-height: 1.7; color: #8a93ae;
          margin: 0 0 16px; max-width: 580px; word-break: break-word;
        }

        /* Follow stats row */
        .follow-stats-row { display: flex; gap: 20px; margin-bottom: 16px; }
        .follow-stat-btn {
          background: none; border: none; color: #8a96b5; cursor: pointer;
          padding: 0; font-size: 13px; font-family: inherit;
          transition: color 0.15s;
        }
        .follow-stat-btn:hover { color: #c7cee2; }
        .follow-stat-num { color: #e4e8f4; font-weight: 700; }

        /* Stats row */
        .stats-row {
          display: inline-flex; align-items: center; gap: 16px;
          background: #0e111a; border: 1px solid #1a1f2e;
          border-radius: 10px; padding: 10px 16px;
        }
        .stat { display: flex; align-items: center; gap: 6px; }
        .stat-value { font-size: 16px; font-weight: 700; color: #e4e8f4; line-height: 1; }
        .stat-label { font-size: 12px; color: #576080; }
        .stat-divider { width: 1px; height: 18px; background: #1e2235; }

        /* Threads section */
        .threads-section { padding: 22px 28px 0; }
        .section-header { display: flex; align-items: baseline; gap: 6px; margin-bottom: 14px; }
        .section-title { font-size: 11px; font-weight: 700; color: #505a72; text-transform: uppercase; letter-spacing: 0.1em; }
        .section-count {
          font-size: 11px; font-weight: 700; color: #505a72;
        }
        .threads-list { display: flex; flex-direction: column; gap: 8px; }
        .showing-note { font-size: 11px; color: #3d4460; text-align: center; margin: 10px 0 0; }

        /* Empty state */
        .empty-state {
          border: 1px dashed #1e2540; border-radius: 14px;
          text-align: center; padding: 48px 20px;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
        }
        .empty-icon {
          width: 52px; height: 52px; border-radius: 14px;
          background: #0e111a; border: 1px solid #1e2235;
          display: grid; place-items: center; color: #3d4460; margin-bottom: 4px;
        }
        .empty-title { font-size: 15px; font-weight: 600; color: #576080; margin: 0; }
        .empty-sub { font-size: 12px; color: #3d4460; margin: 0; max-width: 280px; line-height: 1.6; }

        /* Skeleton animation */
        @keyframes sk { 0%,100% { opacity: .3 } 50% { opacity: .7 } }

        /* Admin edit modal */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
          display: grid; place-items: center;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-box {
          background: linear-gradient(180deg,#12162a,#0e111d); border: 1px solid #252b40;
          border-radius: 14px; padding: 24px; width: 420px; max-width: 90vw;
          box-shadow: 0 16px 48px rgba(0,0,0,0.5);
        }
        .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .modal-title { font-family: var(--font-dm-serif),serif; font-size: 18px; color: #eceef8; margin: 0; }
        .modal-close {
          border: none; background: transparent; color: #636f8d; font-size: 22px;
          cursor: pointer; padding: 0 4px; line-height: 1; transition: color 0.15s;
        }
        .modal-close:hover { color: #e4e8f4; }
        .modal-label { display: block; font-size: 11px; font-weight: 700; color: #505a72; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; margin-top: 12px; }
        .modal-input {
          width: 100%; border: 1px solid #1e2235; background: #151927; color: #e4e8f4;
          border-radius: 8px; padding: 10px 12px; font-size: 13px; font-family: inherit;
          transition: border-color 0.15s; outline: none; box-sizing: border-box;
        }
        .modal-input:focus { border-color: #f0834a; }
        .modal-textarea { resize: vertical; min-height: 60px; }
        .modal-hint { font-size: 11px; color: #3d4460; text-align: right; margin-top: 4px; }
        .modal-msg { font-size: 12px; border-radius: 6px; padding: 8px 12px; margin-top: 12px; }
        .msg-ok { color: #3dd68c; background: rgba(61,214,140,0.1); border: 1px solid rgba(61,214,140,0.25); }
        .msg-err { color: #f06b6b; background: rgba(240,107,107,0.1); border: 1px solid rgba(240,107,107,0.25); }
        .modal-save {
          margin-top: 16px; width: 100%; border: none; border-radius: 8px;
          background: linear-gradient(135deg,#f0834a,#e06c30); color: #fff;
          font-size: 13px; font-weight: 700; padding: 10px 0; cursor: pointer;
          transition: opacity 0.15s; font-family: inherit;
        }
        .modal-save:hover:not(:disabled) { opacity: 0.9; }
        .modal-save:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Tablet ── */
        @media (max-width: 860px) {
          .profile-header { padding: 0 20px 20px; }
          .threads-section { padding: 20px 20px 0; }
        }

        /* ── Mobile ── */
        @media (max-width: 640px) {
          .cover { height: 100px; border-radius: 0; }
          .back-row { padding: 8px 12px; }

          .profile-header { padding: 0 14px 16px; }

          /* Show mobile menu, hide desktop actions */
          .desktop-actions { display: none !important; }
          .mobile-menu-wrap { display: block; }

          /* Avatar row: keep horizontal, avatar left, menu button right */
          .avatar-row {
            flex-direction: row; align-items: flex-end;
            justify-content: space-between; gap: 0;
            margin-bottom: 8px;
          }
          .profile-av-wrap { margin-top: -32px; }
          .profile-av { width: 68px; height: 68px; font-size: 20px; border-width: 3px; }
          .av-online-dot { width: 10px; height: 10px; bottom: 3px; right: 2px; border-width: 2px; }

          /* Tighter name / username */
          .profile-name { font-size: 19px; margin-bottom: 2px; }
          .profile-username { font-size: 12px; }
          .profile-username-row { margin-bottom: 6px; }

          /* Smaller badges */
          .profile-badges { margin-bottom: 8px; gap: 5px; }
          .badge-pill { font-size: 10px; padding: 2px 8px; }

          /* Bio */
          .profile-bio { font-size: 13px; line-height: 1.55; margin-bottom: 12px; }

          /* Follow stats — compact, same line */
          .follow-stats-row { gap: 14px; margin-bottom: 10px; }
          .follow-stat-btn { font-size: 12px; }

          /* Stats row — inline, subtle */
          .stats-row {
            display: inline-flex; width: auto; gap: 10px;
            padding: 7px 12px; border-radius: 8px;
            background: rgba(14,17,26,0.6); border-color: #151927;
          }
          .stat-value { font-size: 14px; }
          .stat-label { font-size: 10px; }
          .stat-divider { height: 14px; }

          /* Threads section */
          .threads-section { padding: 14px 14px 0; }
          .section-header { margin-bottom: 10px; }

          .empty-state { padding: 28px 14px; }
          .empty-icon { width: 44px; height: 44px; border-radius: 12px; }

          .error-banner { margin: 50px 14px 0; flex-direction: column; text-align: center; }
        }

        /* Thread card mobile overrides */
        @media (max-width: 640px) {
          .threads-list :global(.tcard) {
            padding: 12px 14px !important;
            border-radius: 10px !important;
          }
        }

        /* ── Very small screens ── */
        @media (max-width: 400px) {
          .profile-header { padding: 0 12px 14px; }
          .threads-section { padding: 12px 12px 0; }
          .cover { height: 80px; }
          .profile-av { width: 60px; height: 60px; font-size: 18px; }
          .profile-av-wrap { margin-top: -28px; }
          .profile-name { font-size: 18px; }
          .stats-row { flex-direction: column; gap: 6px; align-items: flex-start; width: 100%; }
          .stat-divider { width: 100%; height: 1px; }
        }
      `}</style>
    </>
  );
}
