"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ClipboardList, Eye, EyeOff, Key, Lock, Save, Sparkles, User as UserIcon } from "lucide-react";

import PageLoader from "@/components/shared/PageLoader";
import WorkspaceShell from "@/components/app/WorkspaceShell";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { avatarSeed, initials, relativeTime } from "@/lib/workspaceUtils";
import FeedTopicsSettings from "@/components/settings/FeedTopicsSettings";

function slugCooldownDaysLeft(changedAt: string | null | undefined): number {
  if (!changedAt) return 0;
  const cooldownUntil = new Date(changedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  const diff = cooldownUntil - Date.now();
  return diff > 0 ? Math.ceil(diff / (24 * 60 * 60 * 1000)) : 0;
}

type Tab = "profile" | "feed" | "password" | "activity";
type ActivityCategory = "all" | "security" | "content" | "account" | "system";

type ActivityItem = {
  id: string;
  action: string;
  actor_id: string | null;
  target_type: string;
  target_id: string | null;
  severity: "info" | "warning" | "critical";
  result: "success" | "failed";
  request_id: string | null;
  ip: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type ActivityListResponse = {
  data: ActivityItem[];
  page: number;
  limit: number;
  total: number;
};

export default function SettingsWorkspace() {
  const router = useRouter();
  const { user, accessToken, setUser } = useAuthStore();
  const [authHydrated, setAuthHydrated] = useState(false);

  const [tab, setTab] = useState<Tab>("profile");

  // Profile form
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Profile slug editor
  const slugCooldownLeft = slugCooldownDaysLeft(user?.profile_slug_changed_at);
  const slugLocked = slugCooldownLeft > 0;
  const [slugDraft, setSlugDraft] = useState(user?.profile_slug ?? user?.username ?? "");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [slugMessage, setSlugMessage] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugMsg, setSlugMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [favAnimal, setFavAnimal] = useState("");
  const [favPerson, setFavPerson] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Activity tab
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityCategory, setActivityCategory] = useState<ActivityCategory>("all");
  const [activityPage, setActivityPage] = useState(1);
  const [activityLimit] = useState(12);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? "");
      setLastName(user.last_name ?? "");
      setGender(user.gender ?? "");
      setBio(user.bio ?? "");
      setSlugDraft(user.profile_slug ?? user.username ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (slugLocked) return;
    const normalized = slugDraft.trim().toLowerCase();
    if (!normalized || normalized === (user?.profile_slug ?? user?.username)) {
      setSlugStatus("idle");
      setSlugMessage("");
      return;
    }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const res = await apiGet<{ available: boolean; reason?: string }>(
          `users/me/profile-slug/check?slug=${encodeURIComponent(normalized)}`
        );
        if (res.available) {
          setSlugStatus("available");
          setSlugMessage("Available");
        } else {
          setSlugStatus("taken");
          setSlugMessage(res.reason ?? "Not available");
        }
      } catch {
        setSlugStatus("invalid");
        setSlugMessage("Could not check availability");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slugDraft, user?.profile_slug, user?.username, slugLocked]);

  useEffect(() => {
    if (tab !== "activity") return;
    let cancelled = false;
    const loadActivity = async () => {
      setActivityLoading(true);
      setActivityError(null);
      try {
        const query = new URLSearchParams({
          page: String(activityPage),
          limit: String(activityLimit),
          category: activityCategory,
        }).toString();
        const res = await apiGet<ActivityListResponse>(`users/me/activity?${query}`);
        if (cancelled) return;
        setActivityItems(res.data);
        setActivityTotal(res.total);
      } catch {
        if (cancelled) return;
        setActivityError("Failed to load activity log.");
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    };
    void loadActivity();
    return () => {
      cancelled = true;
    };
  }, [activityCategory, activityLimit, activityPage, tab]);

  useEffect(() => {
    setAuthHydrated(useAuthStore.persist.hasHydrated());
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setAuthHydrated(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authHydrated) return;
    if (user && accessToken) return;
    router.replace("/login?from=/settings");
  }, [accessToken, authHydrated, router, user]);

  if (!authHydrated || !user || !accessToken) {
    return <PageLoader />;
  }

  const [av1, av2] = avatarSeed(user.id);

  async function handleProfileSave() {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const updated = await apiPatch<{
        id: string; username: string; email: string; display_name: string;
        bio: string | null; role: "member" | "moderator" | "admin";
        is_active: boolean; first_name: string | null; last_name: string | null;
        gender: string | null; created_at: string; updated_at: string;
      }>("users/me", {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        gender: gender || null,
        bio: bio.trim() || null,
      });
      setUser(updated);
      setProfileMsg({ type: "ok", text: "Profile updated" });
    } catch {
      setProfileMsg({ type: "err", text: "Failed to update profile" });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSlugSave() {
    setSlugSaving(true);
    setSlugMsg(null);
    try {
      const updated = await apiPost<typeof user>("users/me/profile-slug", {
        slug: slugDraft.trim().toLowerCase(),
      });
      setUser(updated);
      setSlugMsg({ type: "ok", text: "Profile URL updated" });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Failed to update";
      setSlugMsg({ type: "err", text: msg });
    } finally {
      setSlugSaving(false);
    }
  }

  async function handlePasswordChange() {
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "err", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: "err", text: "Password must be at least 6 characters" });
      return;
    }
    if (!currentPassword && !recoveryCode && !favAnimal && !favPerson) {
      setPwMsg({ type: "err", text: "Provide your current password or a security answer" });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await apiPost<{ message: string }>("auth/change-password", {
        new_password: newPassword,
        ...(currentPassword ? { current_password: currentPassword } : {}),
        ...(recoveryCode ? { recovery_code: recoveryCode } : {}),
        ...(favAnimal ? { fav_animal: favAnimal } : {}),
        ...(favPerson ? { fav_person: favPerson } : {}),
      });
      setPwMsg({ type: "ok", text: "Password changed successfully" });
      setCurrentPassword("");
      setRecoveryCode("");
      setFavAnimal("");
      setFavPerson("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwMsg({ type: "err", text: "Verification failed — check your current password or security answers" });
    } finally {
      setPwSaving(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof UserIcon }[] = [
    { key: "profile", label: "Profile", icon: UserIcon },
    { key: "feed", label: "Feed", icon: Sparkles },
    { key: "password", label: "Password", icon: Key },
    { key: "activity", label: "Activity", icon: ClipboardList },
  ];

  return (
    <>
      <WorkspaceShell wrapPanel={false}>
        <section className="ws-panel main-panel">
          <div className="main-scroll ws-scroll">
          {/* Top bar */}
          <div className="top-bar">
            <button type="button" className="back-btn" onClick={() => router.back()}>
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="page-title">Settings</h1>
          </div>

          {/* User header + tabs */}
          <div className="settings-header">
            <div className="user-row">
              <div className="header-avatar" style={{ background: `linear-gradient(135deg,${av1},${av2})` }}>
                {initials(user.display_name)}
              </div>
              <div className="header-info">
                <div className="header-name">{user.display_name}</div>
                <div className="header-username">@{user.username}</div>
              </div>
            </div>
            <div className="tab-row">
              {tabs.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`tab-btn ${tab === t.key ? "active" : ""}`}
                    onClick={() => setTab(t.key)}
                  >
                    <Icon size={14} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className={`settings-content${tab === "feed" ? " wide" : ""}`}>
            {tab === "profile" && (
              <div className="section">
                <h2 className="sec-title">Edit Profile</h2>
                <p className="sec-desc">Update your name, gender, and bio. Your display name is derived from first + last name.</p>

                <div className="name-row-edit">
                  <div>
                    <label className="field-label">First Name</label>
                    <input
                      className="field-input"
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      maxLength={50}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="field-label">Last Name</label>
                    <input
                      className="field-input"
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      maxLength={50}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <label className="field-label">
                  Gender <span className="field-optional">optional</span>
                </label>
                <div className="gender-pills">
                  {["Male", "Female", "Non-binary", "Prefer not to say"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`gender-pill${gender === opt ? " active" : ""}`}
                      onClick={() => setGender(prev => prev === opt ? "" : opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                <label className="field-label">Bio</label>
                <textarea
                  className="field-input field-textarea"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder="Tell us about yourself..."
                />
                <div className="field-hint">{bio.length}/280</div>

                {profileMsg && (
                  <div className={`msg ${profileMsg.type}`}>
                    {profileMsg.type === "ok" && <Check size={13} />} {profileMsg.text}
                  </div>
                )}

                <button
                  type="button"
                  className="save-btn"
                  disabled={profileSaving}
                  onClick={handleProfileSave}
                >
                  <Save size={14} /> {profileSaving ? "Saving..." : "Save Changes"}
                </button>

                {/* Profile URL (slug) editor */}
                <div className="slug-section">
                  <label className="field-label">
                    Profile URL
                    <span className="field-optional">once per 30 days</span>
                  </label>
                  <p className="slug-hint">
                    Shareable profile link. Your @{user?.username} handle stays permanent.
                  </p>

                  {slugLocked ? (
                    <div className="slug-locked">
                      Profile URL locked for {slugCooldownLeft} more day{slugCooldownLeft === 1 ? "" : "s"}.
                    </div>
                  ) : (
                    <>
                      <div className="slug-input-row">
                        <span className="slug-prefix">khoshgolpo.com/</span>
                        <input
                          className={`field-input slug-input${slugStatus === "taken" || slugStatus === "invalid" ? " input-error" : ""}`}
                          type="text"
                          value={slugDraft}
                          onChange={e => setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                          maxLength={30}
                          placeholder={user?.username ?? "your-slug"}
                          spellCheck={false}
                        />
                        {slugStatus === "checking" && <span className="slug-status checking">Checking...</span>}
                        {slugStatus === "available" && <span className="slug-status ok">Available</span>}
                        {(slugStatus === "taken" || slugStatus === "invalid") && (
                          <span className="slug-status err">{slugMessage}</span>
                        )}
                      </div>

                      {slugMsg && (
                        <div className={`msg ${slugMsg.type}`} style={{ marginTop: "8px" }}>
                          {slugMsg.type === "ok" && <Check size={13} />} {slugMsg.text}
                        </div>
                      )}

                      <button
                        type="button"
                        className="save-btn"
                        style={{ marginTop: "12px" }}
                        disabled={
                          slugSaving ||
                          slugStatus === "taken" ||
                          slugStatus === "invalid" ||
                          slugStatus === "checking"
                        }
                        onClick={handleSlugSave}
                      >
                        <Save size={14} /> {slugSaving ? "Saving..." : "Update URL"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {tab === "feed" && <FeedTopicsSettings />}

            {tab === "password" && (
              <div className="section">
                <h2 className="sec-title">Change Password</h2>
                <p className="sec-desc">
                  Enter your current password, or provide a security answer (recovery code, favorite animal, or favorite person).
                </p>

                <label className="field-label"><Lock size={12} /> Current Password</label>
                <div className="password-wrap">
                  <input
                    className="field-input password-input"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Your current password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="pw-toggle-btn"
                    onClick={() => setShowCurrentPassword(prev => !prev)}
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <div className="or-divider">
                  <span className="or-line" />
                  <span className="or-text">or use a security answer</span>
                  <span className="or-line" />
                </div>

                <label className="field-label">Recovery Code</label>
                <input
                  className="field-input"
                  type="text"
                  value={recoveryCode}
                  onChange={e => setRecoveryCode(e.target.value)}
                  placeholder="Your recovery code"
                  autoComplete="off"
                />

                <label className="field-label">Favorite Animal</label>
                <input
                  className="field-input"
                  type="text"
                  value={favAnimal}
                  onChange={e => setFavAnimal(e.target.value)}
                  placeholder="Your answer"
                  autoComplete="off"
                />

                <label className="field-label">Favorite Person</label>
                <input
                  className="field-input"
                  type="text"
                  value={favPerson}
                  onChange={e => setFavPerson(e.target.value)}
                  placeholder="Your answer"
                  autoComplete="off"
                />

                <div className="pw-divider" />

                <label className="field-label">New Password</label>
                <div className="password-wrap">
                  <input
                    className="field-input password-input"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="pw-toggle-btn"
                    onClick={() => setShowNewPassword(prev => !prev)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  >
                    {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <label className="field-label">Confirm New Password</label>
                <div className="password-wrap">
                  <input
                    className="field-input password-input"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="pw-toggle-btn"
                    onClick={() => setShowConfirmPassword(prev => !prev)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {pwMsg && (
                  <div className={`msg ${pwMsg.type}`}>
                    {pwMsg.type === "ok" && <Check size={13} />} {pwMsg.text}
                  </div>
                )}

                <button
                  type="button"
                  className="save-btn"
                  disabled={pwSaving || !newPassword}
                  onClick={handlePasswordChange}
                >
                  <Key size={14} /> {pwSaving ? "Changing..." : "Change Password"}
                </button>
              </div>
            )}

            {tab === "activity" && (
              <div className="section">
                <h2 className="sec-title">Account Activity</h2>
                <p className="sec-desc">
                  Security, account, content, and system events related to your profile.
                </p>

                <div className="activity-filter-row">
                  {(["all", "security", "content", "account", "system"] as ActivityCategory[]).map(category => (
                    <button
                      key={category}
                      type="button"
                      className={`activity-chip ${activityCategory === category ? "active" : ""}`}
                      onClick={() => {
                        setActivityCategory(category);
                        setActivityPage(1);
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {activityError && <div className="activity-error">{activityError}</div>}

                {activityLoading ? (
                  <div className="activity-empty">Loading activity...</div>
                ) : activityItems.length === 0 ? (
                  <div className="activity-empty">No activity found for this filter.</div>
                ) : (
                  <div className="activity-list">
                    {activityItems.map(item => (
                      <article key={item.id} className="activity-row">
                        <div className="activity-head">
                          <span className={`activity-severity ${item.severity}`}>{item.severity}</span>
                          <strong className="activity-action">{item.action.replaceAll("_", " ")}</strong>
                          <span className={`activity-result ${item.result}`}>{item.result}</span>
                          <span className="activity-time" title={item.created_at}>{relativeTime(item.created_at)}</span>
                        </div>
                        <div className="activity-meta">
                          <span>{item.target_type}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                <div className="activity-pagination">
                  <span>
                    Page {activityPage}
                    {activityTotal > 0 ? ` of ${Math.max(1, Math.ceil(activityTotal / activityLimit))}` : ""}
                  </span>
                  <div className="activity-page-actions">
                    <button
                      type="button"
                      className="page-btn"
                      disabled={activityLoading || activityPage <= 1}
                      onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                    >
                      <ChevronLeft size={13} /> Prev
                    </button>
                    <button
                      type="button"
                      className="page-btn"
                      disabled={activityLoading || activityPage >= Math.max(1, Math.ceil(activityTotal / activityLimit))}
                      onClick={() => setActivityPage(prev => prev + 1)}
                    >
                      Next <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </section>
      </WorkspaceShell>

      <style jsx>{`
        .main-scroll {
          flex: 1;
          padding-bottom: 40px;
        }

        .top-bar {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 28px; border-bottom: 1px solid #1e2235; flex-shrink: 0;
        }
        .back-btn {
          border: 1px solid #252b40; background: transparent; color: #9ba3be;
          border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 5px;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .back-btn:hover { color: #e4e8f4; border-color: #3a4160; }
        .page-title {
          font-family: var(--font-dm-serif), serif;
          font-size: 20px; font-weight: 700; margin: 0;
        }

        .settings-header {
          padding: 24px 28px 0;
          border-bottom: 1px solid #1e2235;
        }
        .user-row {
          display: flex; align-items: center; gap: 14px; margin-bottom: 20px;
        }
        .header-avatar {
          width: 52px; height: 52px; border-radius: 50%;
          display: grid; place-items: center;
          font-size: 18px; font-weight: 700; color: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .header-info { min-width: 0; }
        .header-name { font-size: 16px; font-weight: 700; color: #e4e8f4; }
        .header-username { font-size: 13px; color: #636f8d; margin-top: 1px; }

        .tab-row { display: flex; gap: 4px; }
        .tab-btn {
          border: none; background: transparent; color: #9ba3be;
          padding: 10px 16px; font-size: 13px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 6px;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
        }
        .tab-btn:hover { color: #d5dbee; }
        .tab-btn.active {
          color: #f0834a; border-bottom-color: #f0834a;
        }

        .settings-content {
          padding: 28px 28px 0;
          max-width: 520px;
        }
        .settings-content.wide {
          max-width: 720px;
        }

        .section {}
        .sec-title {
          font-family: var(--font-dm-serif), serif;
          font-size: 18px; font-weight: 700; margin: 0 0 4px;
        }
        .sec-desc {
          font-size: 13px; color: #636f8d; margin: 0 0 20px; line-height: 1.5;
        }
        .field-label {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 600; color: #8690ad;
          margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .name-row-edit { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .name-row-edit .field-label { margin-top: 0; }
        .field-optional {
          font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
          background: rgba(124,115,240,0.12); color: #8a7ff0;
          border-radius: 4px; padding: 1px 5px; margin-left: 2px;
        }
        .gender-pills { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 4px; }
        .gender-pill {
          padding: 6px 13px; border-radius: 999px;
          border: 1px solid #252b40; background: #151927; color: #7f89a7;
          font-size: 12px; font-weight: 500; cursor: pointer;
          transition: all 0.15s; font-family: inherit;
        }
        .gender-pill:hover { border-color: #f0834a; color: #e4e8f4; }
        .gender-pill.active { border-color: #f0834a; background: rgba(240,131,74,0.1); color: #f0834a; }
        .field-input {
          width: 100%; border: 1px solid #252b40; background: #151927;
          color: #e4e8f4; border-radius: 8px; padding: 10px 14px;
          font-size: 14px; font-family: inherit; outline: none;
          transition: border-color 0.15s;
        }
        .password-wrap {
          position: relative;
        }
        .password-input {
          padding-right: 40px;
        }
        .pw-toggle-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: #7f89a7;
          cursor: pointer;
          padding: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }
        .pw-toggle-btn:hover {
          color: #c8d1ea;
          background: rgba(127, 137, 167, 0.12);
        }
        .field-input:focus { border-color: #f0834a; }
        .field-input::placeholder { color: #3d4460; }
        .field-textarea { resize: vertical; min-height: 72px; }
        .field-hint { font-size: 11px; color: #3d4460; text-align: right; margin-top: 4px; }

        .or-divider {
          display: flex; align-items: center; gap: 12px; margin: 20px 0;
        }
        .or-line { flex: 1; height: 1px; background: #1e2235; }
        .or-text { font-size: 11px; color: #505a72; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }

        .pw-divider { height: 1px; background: #1e2235; margin: 20px 0; }

        .msg {
          display: flex; align-items: center; gap: 6px;
          font-size: 13px; padding: 8px 12px; border-radius: 8px; margin-top: 14px;
        }
        .msg.ok { color: #3dd68c; background: rgba(61,214,140,0.08); border: 1px solid rgba(61,214,140,0.2); }
        .msg.err { color: #f06b6b; background: rgba(240,107,107,0.08); border: 1px solid rgba(240,107,107,0.2); }

        .save-btn {
          margin-top: 20px; border: none;
          background: linear-gradient(135deg,#f0834a,#e06c30); color: #fff;
          border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 8px;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .save-btn:hover:not(:disabled) { opacity: 0.9; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .activity-filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 4px 0 12px;
        }
        .activity-chip {
          border: 1px solid #252b40;
          background: #151927;
          color: #7f89a7;
          border-radius: 999px;
          padding: 5px 12px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          cursor: pointer;
          font-family: inherit;
        }
        .activity-chip.active {
          color: #f0834a;
          border-color: rgba(240, 131, 74, 0.45);
          background: rgba(240, 131, 74, 0.1);
        }
        .activity-error {
          margin-top: 10px;
          color: #f6b0b0;
          border: 1px solid rgba(240, 107, 107, 0.25);
          background: rgba(240, 107, 107, 0.08);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
        }
        .activity-empty {
          border: 1px solid #252b40;
          border-radius: 10px;
          background: #141a28;
          color: #7f89a7;
          font-size: 12px;
          padding: 16px;
          text-align: center;
        }
        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 10px;
        }
        .activity-row {
          border: 1px solid #252b40;
          border-radius: 10px;
          background: #141a28;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .activity-head {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .activity-severity {
          font-size: 9px;
          font-weight: 700;
          border-radius: 4px;
          text-transform: uppercase;
          padding: 2px 6px;
          letter-spacing: 0.05em;
        }
        .activity-severity.info {
          color: #7cc2f0;
          background: rgba(124, 194, 240, 0.14);
        }
        .activity-severity.warning {
          color: #f0c34a;
          background: rgba(240, 195, 74, 0.14);
        }
        .activity-severity.critical {
          color: #f06b6b;
          background: rgba(240, 107, 107, 0.14);
        }
        .activity-action {
          font-size: 12px;
          color: #d8def1;
          text-transform: capitalize;
        }
        .activity-result {
          font-size: 10px;
          border-radius: 999px;
          padding: 2px 8px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .activity-result.success {
          color: #8ce6ba;
          background: rgba(61, 214, 140, 0.14);
        }
        .activity-result.failed {
          color: #f6b0b0;
          background: rgba(240, 107, 107, 0.14);
        }
        .activity-time {
          margin-left: auto;
          color: #7f89a7;
          font-size: 11px;
        }
        .activity-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 11px;
          color: #7f89a7;
        }
        .activity-pagination {
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #7f89a7;
          font-size: 11px;
        }
        .activity-page-actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .page-btn {
          border: 1px solid #252b40;
          background: #151927;
          color: #aeb8d6;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-family: inherit;
        }
        .page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .slug-section {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #1a1f2e;
        }
        .slug-hint {
          font-size: 12px;
          color: #4f5878;
          margin: 0 0 10px;
          line-height: 1.5;
        }
        .slug-locked {
          font-size: 12px;
          color: #7c73f0;
          background: #13162a;
          border: 1px solid #2a2f50;
          border-radius: 8px;
          padding: 10px 14px;
        }
        .slug-input-row {
          display: flex;
          align-items: center;
          border: 1px solid #252b40;
          border-radius: 8px;
          overflow: hidden;
          background: #151927;
        }
        .slug-prefix {
          padding: 10px 12px;
          font-size: 13px;
          color: #505a72;
          background: #0e111a;
          border-right: 1px solid #252b40;
          white-space: nowrap;
          user-select: none;
          flex-shrink: 0;
        }
        .slug-input {
          border: none;
          border-radius: 0;
          flex: 1;
          background: transparent;
          padding-left: 10px;
          min-width: 0;
        }
        .slug-input:focus { border: none; box-shadow: none; }
        .slug-status {
          font-size: 11px;
          font-weight: 600;
          padding: 0 12px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .slug-status.ok    { color: #3dd68c; }
        .slug-status.err   { color: #f06b6b; }
        .slug-status.checking { color: #7c73f0; }
        .input-error { border-color: #f06b6b !important; }

        @media (max-width: 860px) {
          .settings-header { padding: 20px 20px 0; }
          .settings-content { padding: 24px 20px 0; }
          .settings-content.wide { max-width: none; }
          .header-avatar { width: 40px; height: 40px; font-size: 14px; }
        }
      `}</style>
    </>
  );
}
