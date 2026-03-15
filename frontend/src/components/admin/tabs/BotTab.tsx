"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Bot, ChevronRight, FileText, Loader2, MessageSquare, Pencil, Plus, RefreshCw, Settings, ToggleLeft, ToggleRight, Trash2, X, Zap } from "lucide-react";
import {
  archiveBotThread,
  createBot,
  deleteBotConfig,
  deleteBotPost,
  deleteBotThread,
  editBotPost,
  editBotThread,
  getBotActivity,
  getBotContent,
  listBots,
  setBotEnabled,
  triggerBotComment,
  triggerBotEngage,
  triggerBotThread,
  updateBotIdentity,
  updateBotSchedule,
} from "@/lib/botApi";
import type {
  BotActivityEntry,
  BotConfig,
  BotContentItem,
  CreateBotRequest,
  UpdateBotIdentityRequest,
  UpdateBotScheduleRequest,
} from "@/types/admin";

const BOT_BADGE = (
  <span
    style={{
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 6px",
      borderRadius: 4,
      border: "1px solid rgba(124, 115, 240, 0.5)",
      color: "#9d97f0",
      background: "rgba(124, 115, 240, 0.1)",
      letterSpacing: "0.04em",
    }}
  >
    BOT
  </span>
);

function formatTs(ts: string | null): string {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const SHARED_STYLES = `
  .field { display: flex; flex-direction: column; gap: 5px; }
  .label { font-size: 11px; font-weight: 600; color: #8591b3; text-transform: uppercase; letter-spacing: 0.04em; }
  .input { background: #151c2e; border: 1px solid #2a3454; border-radius: 8px; color: #e4e8f4; padding: 8px 12px; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; }
  .input:focus { border-color: #7c73f0; }
  .textarea { resize: vertical; font-family: inherit; }
  .section-divider { font-size: 11px; font-weight: 700; color: #7c73f0; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #1e2741; padding-bottom: 6px; }
  .form-error { color: #f4b3b3; background: rgba(240, 107, 107, 0.1); border: 1px solid rgba(240, 107, 107, 0.25); border-radius: 8px; padding: 10px 14px; font-size: 12px; }
  .btn-primary { display: flex; align-items: center; justify-content: center; gap: 6px; background: #7c73f0; border: none; border-radius: 8px; color: #fff; font-size: 13px; font-weight: 600; padding: 9px 0; cursor: pointer; width: 100%; }
  .btn-primary:hover:not(:disabled) { background: #8f88f5; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .tag-row { display: flex; gap: 8px; }
  .add-btn { background: #232d4a; border: 1px solid #2a3454; border-radius: 8px; color: #b7c3df; font-size: 12px; padding: 6px 12px; cursor: pointer; white-space: nowrap; }
  .add-btn:hover { background: #2b3960; }
  .tag-list { display: flex; flex-wrap: wrap; gap: 6px; min-height: 24px; }
  .tag { display: flex; align-items: center; gap: 4px; background: rgba(124, 115, 240, 0.12); border: 1px solid rgba(124, 115, 240, 0.3); border-radius: 6px; padding: 3px 8px; font-size: 12px; color: #b3adf5; }
  .tag button { background: none; border: none; color: #9d97f0; cursor: pointer; font-size: 14px; line-height: 1; padding: 0 0 0 2px; }
  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ─── Create Bot Panel ─────────────────────────────────────────────────────────

type CreatePanelProps = { onCreated: () => void; onCancel: () => void };

function CreateBotPanel({ onCreated, onCancel }: CreatePanelProps) {
  const [form, setForm] = useState<CreateBotRequest>({
    username: "",
    display_name: "",
    email: "",
    bio: "",
    avatar_url: "",
    persona: "",
    topic_seeds: [],
    channels: [],
    thread_interval_hours: 6,
    comment_interval_hours: 2,
    engage_interval_hours: 3,
    max_threads_per_day: 2,
    max_comments_per_day: 10,
    min_thread_replies: 0,
    enabled: false,
  });
  const [topicInput, setTopicInput] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = form.username.trim().length >= 3 && form.display_name.trim().length >= 1 && form.email.trim().includes("@");
  const set = (key: keyof CreateBotRequest, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));

  const addTopic = () => {
    const t = topicInput.trim();
    if (t && !form.topic_seeds?.includes(t)) set("topic_seeds", [...(form.topic_seeds ?? []), t]);
    setTopicInput("");
  };

  const addChannel = () => {
    const c = channelInput.trim();
    if (c && !form.channels?.includes(c)) set("channels", [...(form.channels ?? []), c]);
    setChannelInput("");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await createBot(form);
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create bot");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-panel">
      <div className="create-header"><Bot size={16} /><span>Create AI Bot Account</span></div>

      <div className="form-grid">
        <label className="field">
          <span className="label">Username *</span>
          <input className="input" value={form.username} onChange={e => set("username", e.target.value)} placeholder="khoshbot" />
        </label>
        <label className="field">
          <span className="label">Display Name *</span>
          <input className="input" value={form.display_name} onChange={e => set("display_name", e.target.value)} placeholder="KhoshBot" />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          <span className="label">Email *</span>
          <input className="input" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="bot@khoshgolpo.internal" />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          <span className="label">Bio</span>
          <textarea className="input textarea" value={form.bio} onChange={e => set("bio", e.target.value)} rows={2} />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          <span className="label">Avatar URL</span>
          <input className="input" value={form.avatar_url} onChange={e => set("avatar_url", e.target.value)} placeholder="https://... (optional)" />
        </label>
      </div>

      <div className="section-divider">Persona (GPT system prompt)</div>
      <textarea className="input textarea persona-input" value={form.persona} onChange={e => set("persona", e.target.value)} rows={4}
        placeholder="You are a curious, warm community member. You enjoy thoughtful conversation and keep things concise. Never reveal you are an AI." />

      <div className="section-divider">Topic Seeds</div>
      <div className="tag-row">
        <input className="input" style={{ flex: 1 }} value={topicInput} onChange={e => setTopicInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTopic()} placeholder="e.g. Philosophy" />
        <button type="button" className="add-btn" onClick={addTopic}>Add</button>
      </div>
      <div className="tag-list">
        {form.topic_seeds?.map(t => (
          <span key={t} className="tag">{t}
            <button type="button" onClick={() => set("topic_seeds", form.topic_seeds?.filter(x => x !== t))}>×</button>
          </span>
        ))}
      </div>

      <div className="section-divider">Channels</div>
      <div className="tag-row">
        <input className="input" style={{ flex: 1 }} value={channelInput} onChange={e => setChannelInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addChannel()} placeholder="e.g. general" />
        <button type="button" className="add-btn" onClick={addChannel}>Add</button>
      </div>
      <div className="tag-list">
        {form.channels?.map(c => (
          <span key={c} className="tag">{c}
            <button type="button" onClick={() => set("channels", form.channels?.filter(x => x !== c))}>×</button>
          </span>
        ))}
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn-primary-sm" disabled={!valid || loading} onClick={() => void handleSubmit()}>
          {loading ? <Loader2 size={14} className="spin" /> : <Bot size={14} />}
          Create Bot Account
        </button>
      </div>

      <style jsx>{`
        .create-panel { display: flex; flex-direction: column; gap: 14px; }
        .create-header { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: #e4e8f4; margin-bottom: 4px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .persona-input { min-height: 100px; }
        .form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
        .btn-ghost { background: transparent; border: 1px solid #2a3454; border-radius: 8px; color: #8591b3; font-size: 13px; padding: 8px 16px; cursor: pointer; }
        .btn-ghost:hover { border-color: #435174; color: #c5cfe6; }
        .btn-primary-sm { display: flex; align-items: center; gap: 6px; background: #7c73f0; border: none; border-radius: 8px; color: #fff; font-size: 13px; font-weight: 600; padding: 8px 18px; cursor: pointer; }
        .btn-primary-sm:hover:not(:disabled) { background: #8f88f5; }
        .btn-primary-sm:disabled { opacity: 0.5; cursor: not-allowed; }
        ${SHARED_STYLES}
      `}</style>
    </div>
  );
}

// ─── Identity Panel ───────────────────────────────────────────────────────────

type IdentityPanelProps = {
  bot: BotConfig;
  onSaved: (updated: BotConfig) => void;
  onTrigger: (type: "thread" | "comment" | "engage") => Promise<void>;
  onDelete: () => void;
  activity: BotActivityEntry[];
  activityLoading: boolean;
  triggerLoading: string | null;
};

function IdentityPanel({ bot, onSaved, onTrigger, onDelete, activity, activityLoading, triggerLoading }: IdentityPanelProps) {
  const [form, setForm] = useState<UpdateBotIdentityRequest>({
    display_name: bot.display_name,
    bio: "",
    avatar_url: bot.avatar_url ?? "",
    persona: bot.persona,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({ display_name: bot.display_name, bio: "", avatar_url: bot.avatar_url ?? "", persona: bot.persona });
  }, [bot.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBotIdentity(bot.id, form);
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save identity");
    } finally {
      setSaving(false);
    }
  };

  const actionLabel: Record<string, string> = {
    bot_create_thread: "Created thread",
    bot_comment: "Posted comment",
    bot_engage: "Engaged",
    bot_error: "Error",
    bot_created: "Bot created",
    bot_enabled: "Enabled",
    bot_disabled: "Disabled",
    bot_identity_updated: "Identity updated",
    bot_schedule_updated: "Schedule updated",
  };

  return (
    <div className="identity-panel">
      <div className="panel-title">
        {bot.avatar_url ? (
          <img src={bot.avatar_url} alt={bot.display_name} className="avatar" />
        ) : (
          <div className="avatar avatar-placeholder"><Bot size={18} /></div>
        )}
        <div>
          <div className="bot-name">{bot.display_name} {BOT_BADGE}</div>
          <div className="bot-username">@{bot.username}</div>
        </div>
      </div>

      {/* Daily counters */}
      <div className="counter-row">
        <div className="counter">
          <span className="counter-val">{bot.threads_created_today}</span>
          <span className="counter-label">Threads today</span>
        </div>
        <div className="counter">
          <span className="counter-val">{bot.comments_posted_today}</span>
          <span className="counter-label">Comments today</span>
        </div>
        <div className="counter">
          <span className="counter-val">{formatTs(bot.last_thread_at)}</span>
          <span className="counter-label">Last thread</span>
        </div>
        <div className="counter">
          <span className="counter-val">{formatTs(bot.last_comment_at)}</span>
          <span className="counter-label">Last comment</span>
        </div>
      </div>

      <div className="field">
        <span className="label">Display Name</span>
        <input className="input" value={form.display_name ?? ""} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} />
      </div>
      <div className="field">
        <span className="label">Bio</span>
        <textarea className="input textarea" value={form.bio ?? ""} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={2} />
      </div>
      <div className="field">
        <span className="label">Avatar URL</span>
        <div className="avatar-row">
          <input className="input" style={{ flex: 1 }} value={form.avatar_url ?? ""} onChange={e => setForm(p => ({ ...p, avatar_url: e.target.value }))} />
          {form.avatar_url && <img src={form.avatar_url} alt="" className="avatar-preview" />}
        </div>
      </div>
      <div className="field">
        <span className="label">Persona (GPT system prompt)</span>
        <textarea className="input textarea" value={form.persona ?? ""} onChange={e => setForm(p => ({ ...p, persona: e.target.value }))} rows={4} />
      </div>

      {error && <div className="form-error">{error}</div>}
      <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleSave()}>
        {saving ? <Loader2 size={13} className="spin" /> : null}
        {saved ? "Saved!" : "Save Identity"}
      </button>

      <div className="section-divider">Test Triggers</div>
      <div className="trigger-row">
        {(["thread", "comment", "engage"] as const).map(type => (
          <button key={type} type="button" className="trigger-btn" disabled={!!triggerLoading} onClick={() => void onTrigger(type)}>
            {triggerLoading === type ? <Loader2 size={12} className="spin" /> : <Zap size={12} />}
            {type === "thread" ? "Thread Now" : type === "comment" ? "Comment Now" : "Engage Now"}
          </button>
        ))}
      </div>

      <div className="section-divider">Recent Activity</div>
      {activityLoading ? (
        <div className="activity-empty">Loading…</div>
      ) : activity.length === 0 ? (
        <div className="activity-empty">No activity yet.</div>
      ) : (
        <div className="activity-list">
          {activity.map(entry => (
            <div key={entry.id} className={`activity-row ${entry.action === "bot_error" ? "error" : ""}`}>
              <span className="activity-time">{formatTs(entry.created_at)}</span>
              <span className="activity-action">{actionLabel[entry.action] ?? entry.action}</span>
              {typeof entry.details?.title === "string" && <span className="activity-detail">— &ldquo;{entry.details.title.slice(0, 60)}&rdquo;</span>}
              {typeof entry.details?.error === "string" && <span className="activity-detail error-text">— {entry.details.error.slice(0, 80)}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="section-divider danger-section">Danger Zone</div>
      <button type="button" className="btn-delete" onClick={onDelete}>
        <Trash2 size={13} />Delete Bot Config
      </button>

      <style jsx>{`
        .identity-panel { display: flex; flex-direction: column; gap: 14px; }
        .panel-title { display: flex; align-items: center; gap: 12px; padding-bottom: 4px; border-bottom: 1px solid #1e2741; margin-bottom: 2px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .avatar-placeholder { width: 40px; height: 40px; border-radius: 50%; background: #1e2741; display: grid; place-items: center; color: #7c73f0; }
        .bot-name { font-size: 15px; font-weight: 700; color: #e4e8f4; display: flex; align-items: center; gap: 6px; }
        .bot-username { font-size: 12px; color: #636f8d; margin-top: 2px; }
        .counter-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
        .counter { background: #0f1826; border: 1px solid #1e2741; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
        .counter-val { font-size: 13px; font-weight: 700; color: #e4e8f4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .counter-label { font-size: 10px; color: #4e5c80; text-transform: uppercase; letter-spacing: 0.04em; }
        .avatar-row { display: flex; align-items: center; gap: 8px; }
        .avatar-preview { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid #2a3454; flex-shrink: 0; }
        .danger-section { color: #f06b6b; border-color: rgba(240, 107, 107, 0.2); }
        .trigger-row { display: flex; gap: 8px; }
        .trigger-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; background: #1a2236; border: 1px solid #2a3454; border-radius: 8px; color: #b7c3df; font-size: 12px; padding: 8px 4px; cursor: pointer; }
        .trigger-btn:hover:not(:disabled) { border-color: #f0834a; color: #f0834a; }
        .trigger-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .activity-list { display: flex; flex-direction: column; gap: 6px; }
        .activity-row { display: flex; align-items: baseline; gap: 8px; font-size: 12px; color: #8591b3; padding: 4px 0; border-bottom: 1px solid #13192a; }
        .activity-row.error { color: #f4b3b3; }
        .activity-time { font-size: 11px; color: #4e5c80; flex-shrink: 0; }
        .activity-action { font-weight: 600; color: #b7c3df; }
        .activity-detail { color: #6b7a9c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .error-text { color: #f4b3b3; }
        .activity-empty { color: #4e5c80; font-size: 12px; text-align: center; padding: 16px 0; }
        .btn-delete { display: flex; align-items: center; gap: 6px; background: rgba(240, 107, 107, 0.1); border: 1px solid rgba(240, 107, 107, 0.3); border-radius: 8px; color: #f4b3b3; font-size: 12px; padding: 8px 14px; cursor: pointer; }
        .btn-delete:hover { background: rgba(240, 107, 107, 0.18); }
        ${SHARED_STYLES}
      `}</style>
    </div>
  );
}

// ─── Schedule Panel ───────────────────────────────────────────────────────────

type SchedulePanelProps = { bot: BotConfig; onSaved: (updated: BotConfig) => void };

type IntervalKey = "thread_interval_hours" | "comment_interval_hours" | "engage_interval_hours";
type UnitMap = Record<IntervalKey, "hrs" | "min">;

function hoursToDisplay(hours: number, unit: "hrs" | "min"): string {
  if (unit === "min") return String(Math.round(hours * 60));
  // Show clean number: no trailing .0 for whole numbers
  return hours % 1 === 0 ? String(hours) : String(hours);
}

function displayToHours(val: string, unit: "hrs" | "min"): number | null {
  const n = parseFloat(val);
  if (isNaN(n) || n <= 0) return null;
  return unit === "min" ? n / 60 : n;
}

function SchedulePanel({ bot, onSaved }: SchedulePanelProps) {
  const [units, setUnits] = useState<UnitMap>({
    thread_interval_hours: "hrs",
    comment_interval_hours: "hrs",
    engage_interval_hours: "hrs",
  });
  // Display values in current unit (string for free editing)
  const [nums, setNums] = useState({
    thread_interval_hours: hoursToDisplay(bot.thread_interval_hours, "hrs"),
    comment_interval_hours: hoursToDisplay(bot.comment_interval_hours, "hrs"),
    engage_interval_hours: hoursToDisplay(bot.engage_interval_hours, "hrs"),
    max_threads_per_day: String(bot.max_threads_per_day),
    max_comments_per_day: String(bot.max_comments_per_day),
    min_thread_replies: String(bot.min_thread_replies),
  });
  const [seeds, setSeeds] = useState<string[]>([...bot.topic_seeds]);
  const [channels, setChannels] = useState<string[]>([...bot.channels]);
  const [topicInput, setTopicInput] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const u: UnitMap = { thread_interval_hours: "hrs", comment_interval_hours: "hrs", engage_interval_hours: "hrs" };
    setUnits(u);
    setNums({
      thread_interval_hours: hoursToDisplay(bot.thread_interval_hours, "hrs"),
      comment_interval_hours: hoursToDisplay(bot.comment_interval_hours, "hrs"),
      engage_interval_hours: hoursToDisplay(bot.engage_interval_hours, "hrs"),
      max_threads_per_day: String(bot.max_threads_per_day),
      max_comments_per_day: String(bot.max_comments_per_day),
      min_thread_replies: String(bot.min_thread_replies),
    });
    setSeeds([...bot.topic_seeds]);
    setChannels([...bot.channels]);
  }, [bot.id]);

  const setNum = (key: keyof typeof nums, value: string) => {
    setNums(p => ({ ...p, [key]: value }));
  };

  const switchUnit = (key: IntervalKey, newUnit: "hrs" | "min") => {
    const oldUnit = units[key];
    if (oldUnit === newUnit) return;
    // Convert current display value to hours, then to new unit display
    const hours = displayToHours(nums[key], oldUnit);
    setUnits(p => ({ ...p, [key]: newUnit }));
    if (hours !== null) {
      setNums(p => ({ ...p, [key]: hoursToDisplay(hours, newUnit) }));
    }
  };

  const addTopic = () => {
    const t = topicInput.trim();
    if (t && !seeds.includes(t)) setSeeds(p => [...p, t]);
    setTopicInput("");
  };

  const addChannel = () => {
    const c = channelInput.trim();
    if (c && !channels.includes(c)) setChannels(p => [...p, c]);
    setChannelInput("");
  };

  const handleSave = async () => {
    const parseInt0 = (v: string) => { const n = parseInt(v, 10); return isNaN(n) || n < 0 ? null : n; };
    const errs: string[] = [];
    const thread_interval_hours = displayToHours(nums.thread_interval_hours, units.thread_interval_hours);
    const comment_interval_hours = displayToHours(nums.comment_interval_hours, units.comment_interval_hours);
    const engage_interval_hours = displayToHours(nums.engage_interval_hours, units.engage_interval_hours);
    const max_threads_per_day = parseInt0(nums.max_threads_per_day);
    const max_comments_per_day = parseInt0(nums.max_comments_per_day);
    const min_thread_replies = parseInt0(nums.min_thread_replies);
    const minHours = (h: number | null, label: string) => {
      if (h === null || h < (1 / 60)) errs.push(`${label} must be at least 1 minute`);
    };
    minHours(thread_interval_hours, "Thread interval");
    minHours(comment_interval_hours, "Comment interval");
    minHours(engage_interval_hours, "Engage interval");
    if (max_threads_per_day === null) errs.push("Max threads/day must be a number");
    if (max_comments_per_day === null) errs.push("Max comments/day must be a number");
    if (min_thread_replies === null) errs.push("Min replies must be a number");
    if (errs.length > 0) { setError(errs.join(" · ")); return; }

    const payload: UpdateBotScheduleRequest = {
      topic_seeds: seeds,
      channels,
      thread_interval_hours: thread_interval_hours!,
      comment_interval_hours: comment_interval_hours!,
      engage_interval_hours: engage_interval_hours!,
      max_threads_per_day: max_threads_per_day!,
      max_comments_per_day: max_comments_per_day!,
      min_thread_replies: min_thread_replies!,
    };

    setSaving(true);
    setError(null);
    try {
      const updated = await updateBotSchedule(bot.id, payload);
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="schedule-panel">

      {/* ── Posting Intervals ── */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-icon interval-icon">⏱</div>
          <div>
            <div className="section-title">Posting Intervals</div>
            <div className="section-sub">How often each job runs</div>
          </div>
        </div>
        <div className="num-grid">
          {([
            { key: "thread_interval_hours" as const, label: "Thread", emoji: "📝" },
            { key: "comment_interval_hours" as const, label: "Comment", emoji: "💬" },
            { key: "engage_interval_hours" as const, label: "Engage", emoji: "🔥" },
          ]).map(({ key, label, emoji }) => (
            <div key={key} className="num-card">
              <div className="num-card-top">
                <div className="num-emoji">{emoji}</div>
                <div className="unit-toggle">
                  <button type="button" className={`unit-btn ${units[key] === "hrs" ? "active" : ""}`} onClick={() => switchUnit(key, "hrs")}>hrs</button>
                  <button type="button" className={`unit-btn ${units[key] === "min" ? "active" : ""}`} onClick={() => switchUnit(key, "min")}>min</button>
                </div>
              </div>
              <div className="num-label">{label}</div>
              <input
                className="num-input"
                type="number"
                min={units[key] === "min" ? 1 : 0.01}
                step={units[key] === "min" ? 1 : 0.5}
                value={nums[key]}
                onChange={e => setNum(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Daily Limits ── */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-icon limit-icon">📊</div>
          <div>
            <div className="section-title">Daily Limits</div>
            <div className="section-sub">Caps reset at midnight UTC</div>
          </div>
        </div>
        <div className="num-grid">
          {([
            { key: "max_threads_per_day" as const, label: "Max Threads / day", emoji: "📝" },
            { key: "max_comments_per_day" as const, label: "Max Comments / day", emoji: "💬" },
            { key: "min_thread_replies" as const, label: "Min Replies to comment", emoji: "🪄" },
          ]).map(({ key, label, emoji }) => (
            <div key={key} className="num-card">
              <div className="num-card-top">
                <div className="num-emoji">{emoji}</div>
              </div>
              <div className="num-label">{label}</div>
              <input
                className="num-input"
                type="number"
                min={0}
                value={nums[key]}
                onChange={e => setNum(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Topic Seeds ── */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-icon seed-icon">🌱</div>
          <div>
            <div className="section-title">Topic Seeds</div>
            <div className="section-sub">Themes the bot draws inspiration from</div>
          </div>
        </div>
        <div className="chip-input-row">
          <input
            className="chip-input"
            value={topicInput}
            onChange={e => setTopicInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTopic()}
            placeholder="e.g. AI ethics, stoicism, remote work…"
          />
          <button type="button" className="chip-add-btn" onClick={addTopic} disabled={!topicInput.trim()}>Add</button>
        </div>
        <div className="chip-list">
          {seeds.map(t => (
            <span key={t} className="chip seed-chip">
              {t}
              <button type="button" onClick={() => setSeeds(p => p.filter(x => x !== t))}>×</button>
            </span>
          ))}
          {seeds.length === 0 && (
            <span className="chip-empty">No seeds — bot will write freely across all topics</span>
          )}
        </div>
      </div>

      {/* ── Channels ── */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-icon channel-icon">📡</div>
          <div>
            <div className="section-title">Channels</div>
            <div className="section-sub">Where the bot posts threads</div>
          </div>
        </div>
        <div className="chip-input-row">
          <input
            className="chip-input"
            value={channelInput}
            onChange={e => setChannelInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addChannel()}
            placeholder="e.g. general, tech, career…"
          />
          <button type="button" className="chip-add-btn" onClick={addChannel} disabled={!channelInput.trim()}>Add</button>
        </div>
        <div className="chip-list">
          {channels.map(c => (
            <span key={c} className="chip channel-chip">
              # {c}
              <button type="button" onClick={() => setChannels(p => p.filter(x => x !== c))}>×</button>
            </span>
          ))}
          {channels.length === 0 && (
            <span className="chip-empty">No channels — bot posts across all available channels</span>
          )}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <button type="button" className="save-btn" disabled={saving} onClick={() => void handleSave()}>
        {saving
          ? <><Loader2 size={14} className="spin" /> Saving…</>
          : saved
            ? <><span className="check">✓</span> Saved!</>
            : <><Settings size={14} /> Save Schedule</>
        }
      </button>

      <style jsx>{`
        .schedule-panel { display: flex; flex-direction: column; gap: 12px; }

        /* Section cards */
        .section-card {
          background: #0c1423;
          border: 1px solid #1a2338;
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .section-head { display: flex; align-items: center; gap: 12px; }
        .section-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: grid; place-items: center; font-size: 17px; flex-shrink: 0;
        }
        .interval-icon { background: rgba(124,115,240,0.12); border: 1px solid rgba(124,115,240,0.2); }
        .limit-icon    { background: rgba(240,131,74,0.10);  border: 1px solid rgba(240,131,74,0.2); }
        .seed-icon     { background: rgba(61,214,140,0.10);  border: 1px solid rgba(61,214,140,0.2); }
        .channel-icon  { background: rgba(96,165,250,0.10);  border: 1px solid rgba(96,165,250,0.2); }
        .section-title { font-size: 13px; font-weight: 700; color: #e4e8f4; }
        .section-sub   { font-size: 11px; color: #4e5c80; margin-top: 2px; }

        /* Number grid */
        .num-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .num-card {
          background: #111926;
          border: 1px solid #1e2741;
          border-radius: 10px;
          padding: 12px 12px 10px;
          display: flex; flex-direction: column; gap: 8px;
          transition: border-color 0.15s;
        }
        .num-card:focus-within { border-color: #7c73f0; }
        .num-card-top { display: flex; align-items: center; justify-content: space-between; }
        .num-emoji { font-size: 16px; line-height: 1; }
        .unit-toggle { display: flex; background: #0d1525; border: 1px solid #1e2741; border-radius: 6px; overflow: hidden; }
        .unit-btn {
          background: none; border: none; color: #4e5c80; font-size: 10px; font-weight: 700;
          padding: 3px 7px; cursor: pointer; letter-spacing: 0.04em; transition: all 0.12s;
        }
        .unit-btn:hover { color: #8591b3; }
        .unit-btn.active { background: #7c73f0; color: #fff; }
        .num-label { font-size: 10px; font-weight: 600; color: #6b7a9c; text-transform: uppercase; letter-spacing: 0.05em; margin-top: -4px; }
        .num-input {
          width: 100%; background: #0d1525; border: 1px solid #232e46;
          border-radius: 7px; color: #e4e8f4; font-size: 20px; font-weight: 700;
          padding: 6px 8px; outline: none; text-align: center;
          -moz-appearance: textfield; box-sizing: border-box;
        }
        .num-input::-webkit-outer-spin-button,
        .num-input::-webkit-inner-spin-button { -webkit-appearance: none; }
        .num-input:focus { border-color: #7c73f0; background: #0f1930; }

        /* Chip inputs */
        .chip-input-row { display: flex; gap: 8px; }
        .chip-input {
          flex: 1; background: #111926; border: 1px solid #1e2741;
          border-radius: 9px; color: #c5cfe6; font-size: 13px;
          padding: 8px 12px; outline: none; font-family: inherit;
        }
        .chip-input:focus { border-color: #7c73f0; background: #131f33; }
        .chip-input::placeholder { color: #3a4a68; }
        .chip-add-btn {
          background: rgba(124,115,240,0.14); border: 1px solid rgba(124,115,240,0.3);
          border-radius: 9px; color: #9d97f0; font-size: 12px; font-weight: 600;
          padding: 0 14px; cursor: pointer; white-space: nowrap;
          transition: background 0.15s;
        }
        .chip-add-btn:hover:not(:disabled) { background: rgba(124,115,240,0.24); }
        .chip-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .chip-list { display: flex; flex-wrap: wrap; gap: 6px; min-height: 28px; align-items: center; }
        .chip {
          display: inline-flex; align-items: center; gap: 5px;
          border-radius: 20px; padding: 4px 10px 4px 12px;
          font-size: 12px; font-weight: 500; line-height: 1;
        }
        .seed-chip {
          background: rgba(61,214,140,0.08); border: 1px solid rgba(61,214,140,0.22); color: #5ecb9e;
        }
        .channel-chip {
          background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.22); color: #7ec8fa;
        }
        .chip button {
          background: none; border: none; cursor: pointer;
          font-size: 13px; line-height: 1; padding: 0; opacity: 0.5;
          color: inherit; transition: opacity 0.12s;
        }
        .chip button:hover { opacity: 1; }
        .chip-empty { font-size: 11px; color: #3a4a68; font-style: italic; }

        /* Save button */
        .save-btn {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          background: linear-gradient(135deg, #7c73f0, #6c64e0);
          border: none; border-radius: 10px;
          color: #fff; font-size: 13px; font-weight: 700;
          padding: 11px 0; cursor: pointer; width: 100%;
          box-shadow: 0 4px 16px rgba(124,115,240,0.25);
          transition: opacity 0.15s, box-shadow 0.15s;
        }
        .save-btn:hover:not(:disabled) {
          opacity: 0.92;
          box-shadow: 0 6px 20px rgba(124,115,240,0.35);
        }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
        .check { font-size: 15px; }

        .form-error {
          background: rgba(240,107,107,0.08); border: 1px solid rgba(240,107,107,0.25);
          border-radius: 10px; color: #f4b3b3; font-size: 12px; padding: 10px 14px;
        }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Content Panel ────────────────────────────────────────────────────────────

type EditState = { id: string; title: string; body: string } | null;
type ContentPanelProps = { bot: BotConfig };

function ContentPanel({ bot }: ContentPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<BotContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editState, setEditState] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const showToast = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const reload = () => {
    setLoading(true);
    getBotContent(bot.id)
      .then(res => setItems(res.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [bot.id]);

  const openEdit = (item: BotContentItem) => {
    setEditState({ id: item.id, title: item.title ?? "", body: item.body });
  };

  const saveEdit = async (item: BotContentItem) => {
    if (!editState) return;
    setSaving(true);
    try {
      if (item.kind === "thread") {
        await editBotThread(item.id, editState.title, editState.body);
      } else {
        await editBotPost(item.id, editState.body);
      }
      showToast("ok", "Saved");
      setEditState(null);
      reload();
    } catch {
      showToast("err", "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: BotContentItem) => {
    if (!confirm(`Delete this ${item.kind}? This cannot be undone.`)) return;
    setActionBusy(item.id + "-del");
    try {
      if (item.kind === "thread") await deleteBotThread(item.id);
      else await deleteBotPost(item.id);
      showToast("ok", `${item.kind === "thread" ? "Thread" : "Post"} deleted`);
      reload();
    } catch {
      showToast("err", "Delete failed");
    } finally {
      setActionBusy(null);
    }
  };

  const handleArchive = async (item: BotContentItem) => {
    setActionBusy(item.id + "-arch");
    try {
      await archiveBotThread(item.id);
      showToast("ok", "Thread archived");
      reload();
    } catch {
      showToast("err", "Archive failed");
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) return (
    <div className="center-empty"><Loader2 size={20} className="spin" style={{ color: "#4e5c80" }} /></div>
  );

  if (items.length === 0) return (
    <div className="center-empty">
      <FileText size={28} style={{ color: "#2b3654" }} />
      <p>No content authored by this bot yet.</p>
      <p>Use &ldquo;Thread Now&rdquo; or &ldquo;Comment Now&rdquo; in Identity tab to trigger a job.</p>
    </div>
  );

  const isEditing = (id: string) => editState?.id === id;

  return (
    <div className="content-panel">
      {toast && (
        <div className={`cp-toast ${toast.type}`}>{toast.text}</div>
      )}
      <div className="content-summary">
        Showing last {items.length} items —{" "}
        <strong>{items.filter(i => i.kind === "thread").length}</strong> threads,{" "}
        <strong>{items.filter(i => i.kind === "post").length}</strong> comments
      </div>
      <div className="content-list">
        {items.map(item => (
          <div key={item.id} className={`content-item ${item.is_flagged ? "flagged" : ""} ${item.is_deleted ? "deleted" : ""}`}>
            <div className="item-meta">
              <span className={`kind-badge ${item.kind}`}>{item.kind === "thread" ? <FileText size={10} /> : <MessageSquare size={10} />} {item.kind}</span>
              {item.is_flagged && <span className="flag-badge">Flagged</span>}
              {item.is_deleted && <span className="del-badge">Deleted</span>}
              {item.ai_score != null && (
                <span className={`score-badge ${item.ai_score >= 0.8 ? "high" : item.ai_score >= 0.6 ? "mid" : ""}`}>
                  AI {Math.round(item.ai_score * 100)}%
                </span>
              )}
              <span className="item-time">{formatTs(item.created_at)}</span>
              {!item.is_deleted && !isEditing(item.id) && (
                <div className="item-actions">
                  <button
                    className="act-btn edit"
                    title="Edit"
                    onClick={() => openEdit(item)}
                  ><Pencil size={11} /></button>
                  {item.kind === "thread" && (
                    <button
                      className="act-btn archive"
                      title="Archive"
                      disabled={actionBusy === item.id + "-arch"}
                      onClick={() => handleArchive(item)}
                    >
                      {actionBusy === item.id + "-arch" ? <Loader2 size={11} className="spin" /> : <Archive size={11} />}
                    </button>
                  )}
                  <button
                    className="act-btn delete"
                    title="Delete"
                    disabled={actionBusy === item.id + "-del"}
                    onClick={() => handleDelete(item)}
                  >
                    {actionBusy === item.id + "-del" ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />}
                  </button>
                </div>
              )}
              {isEditing(item.id) && (
                <button className="act-btn cancel-edit" title="Cancel" onClick={() => setEditState(null)}>
                  <X size={11} /> Cancel
                </button>
              )}
            </div>

            {isEditing(item.id) ? (
              <div className="edit-form">
                {item.kind === "thread" && (
                  <input
                    className="edit-title-input"
                    value={editState!.title}
                    onChange={e => setEditState(s => s ? { ...s, title: e.target.value } : s)}
                    placeholder="Thread title"
                    maxLength={160}
                  />
                )}
                <textarea
                  className="edit-body-input"
                  value={editState!.body}
                  onChange={e => setEditState(s => s ? { ...s, body: e.target.value } : s)}
                  placeholder={item.kind === "thread" ? "Thread body…" : "Post content…"}
                  rows={item.kind === "thread" ? 12 : 5}
                />
                <div className="edit-footer">
                  <span className="edit-chars">{editState!.body.length} chars</span>
                  <button className="save-btn" disabled={saving} onClick={() => saveEdit(item)}>
                    {saving ? <><Loader2 size={11} className="spin" /> Saving…</> : "Save changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="item-clickable"
                role="button"
                tabIndex={0}
                title={`Open ${item.kind}`}
                onClick={() => {
                  const dest = item.kind === "thread"
                    ? `/threads/${item.id}`
                    : `/threads/${item.thread_id}`;
                  router.push(dest);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const dest = item.kind === "thread"
                      ? `/threads/${item.id}`
                      : `/threads/${item.thread_id}`;
                    router.push(dest);
                  }
                }}
              >
                {item.title && <div className="item-title">{item.title}</div>}
                {item.thread_title && <div className="item-parent">in &ldquo;{item.thread_title}&rdquo;</div>}
                <div className="item-body">{item.body.slice(0, 320)}{item.body.length > 320 ? "…" : ""}</div>
                {item.tags.length > 0 && (
                  <div className="item-tags">
                    {item.tags.map(t => <span key={t} className="item-tag">{t}</span>)}
                  </div>
                )}
                {item.kind === "thread" && item.post_count != null && (
                  <div className="item-replies">{item.post_count} {item.post_count === 1 ? "reply" : "replies"}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .content-panel { display: flex; flex-direction: column; gap: 12px; position: relative; }
        .cp-toast { position: sticky; top: 0; z-index: 10; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; text-align: center; }
        .cp-toast.ok { background: rgba(61, 214, 140, 0.15); color: #3dd68c; border: 1px solid rgba(61, 214, 140, 0.3); }
        .cp-toast.err { background: rgba(240, 107, 107, 0.12); color: #f06b6b; border: 1px solid rgba(240, 107, 107, 0.3); }
        .content-summary { font-size: 12px; color: #636f8d; }
        .content-summary strong { color: #b7c3df; }
        .content-list { display: flex; flex-direction: column; gap: 8px; }
        .content-item { background: #0f1826; border: 1px solid #1e2741; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; transition: border-color 0.15s; }
        .content-item:hover { border-color: #2a3454; }
        .content-item.flagged { border-color: rgba(240, 131, 74, 0.35); background: rgba(240, 131, 74, 0.04); }
        .content-item.deleted { opacity: 0.5; }
        .item-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .kind-badge { display: flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
        .kind-badge.thread { background: rgba(124, 115, 240, 0.12); color: #9d97f0; border: 1px solid rgba(124, 115, 240, 0.3); }
        .kind-badge.post { background: rgba(61, 214, 140, 0.08); color: #5ecb9e; border: 1px solid rgba(61, 214, 140, 0.25); }
        .flag-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(240, 131, 74, 0.12); color: #f0834a; border: 1px solid rgba(240, 131, 74, 0.3); }
        .del-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(240, 107, 107, 0.1); color: #f06b6b; border: 1px solid rgba(240, 107, 107, 0.25); }
        .score-badge { font-size: 10px; padding: 2px 5px; border-radius: 4px; font-weight: 600; background: rgba(100, 116, 160, 0.12); color: #8591b3; }
        .score-badge.mid { background: rgba(240, 131, 74, 0.1); color: #f0834a; }
        .score-badge.high { background: rgba(240, 107, 107, 0.1); color: #f06b6b; }
        .item-time { font-size: 10px; color: #4e5c80; margin-left: auto; }
        .item-actions { display: flex; align-items: center; gap: 4px; margin-left: 6px; }
        .act-btn { display: flex; align-items: center; gap: 3px; border: none; border-radius: 5px; padding: 3px 7px; font-size: 11px; cursor: pointer; font-weight: 600; transition: background 0.15s, color 0.15s; }
        .act-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .act-btn.edit { background: rgba(124, 115, 240, 0.12); color: #9d97f0; }
        .act-btn.edit:hover:not(:disabled) { background: rgba(124, 115, 240, 0.22); }
        .act-btn.archive { background: rgba(240, 131, 74, 0.1); color: #f0834a; }
        .act-btn.archive:hover:not(:disabled) { background: rgba(240, 131, 74, 0.2); }
        .act-btn.delete { background: rgba(240, 107, 107, 0.1); color: #f06b6b; }
        .act-btn.delete:hover:not(:disabled) { background: rgba(240, 107, 107, 0.2); }
        .act-btn.cancel-edit { background: rgba(100, 116, 160, 0.1); color: #8591b3; }
        .act-btn.cancel-edit:hover { background: rgba(100, 116, 160, 0.18); }
        .item-clickable { cursor: pointer; display: flex; flex-direction: column; gap: 6px; }
        .item-clickable:hover .item-title { color: #a49cf5; text-decoration: underline; text-underline-offset: 3px; }
        .item-title { font-size: 14px; font-weight: 700; color: #e4e8f4; line-height: 1.3; transition: color 0.15s; }
        .item-parent { font-size: 11px; color: #636f8d; }
        .item-body { font-size: 12px; color: #8591b3; line-height: 1.5; white-space: pre-wrap; }
        .item-tags { display: flex; gap: 4px; flex-wrap: wrap; }
        .item-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(124, 115, 240, 0.08); color: #7c73f0; border: 1px solid rgba(124, 115, 240, 0.2); }
        .item-replies { font-size: 11px; color: #4e5c80; }
        .edit-form { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
        .edit-title-input { background: #151c2e; border: 1px solid #2a3454; border-radius: 7px; color: #e4e8f4; padding: 7px 10px; font-size: 13px; font-weight: 600; outline: none; width: 100%; box-sizing: border-box; }
        .edit-title-input:focus { border-color: #7c73f0; }
        .edit-body-input { background: #151c2e; border: 1px solid #2a3454; border-radius: 7px; color: #e4e8f4; padding: 8px 10px; font-size: 12px; outline: none; width: 100%; box-sizing: border-box; resize: vertical; font-family: inherit; line-height: 1.6; }
        .edit-body-input:focus { border-color: #7c73f0; }
        .edit-footer { display: flex; align-items: center; justify-content: space-between; }
        .edit-chars { font-size: 11px; color: #4e5c80; }
        .save-btn { display: flex; align-items: center; gap: 5px; background: #7c73f0; color: #fff; border: none; border-radius: 7px; padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
        .save-btn:hover:not(:disabled) { background: #6b63d9; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .center-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #4e5c80; font-size: 12px; text-align: center; padding: 40px 16px; }
        .center-empty p { margin: 0; max-width: 260px; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Main BotTab ──────────────────────────────────────────────────────────────

type RightTab = "identity" | "schedule" | "content";
type Toast = { type: "ok" | "err"; text: string };

export default function BotTab() {
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("identity");
  const [enableLoading, setEnableLoading] = useState<string | null>(null);
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);
  const [activity, setActivity] = useState<BotActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadBots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listBots();
      setBots(res.data);
    } catch {
      showToast("err", "Failed to load bots");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBots(); }, [loadBots]);

  const loadActivity = useCallback(async (configId: string) => {
    setActivityLoading(true);
    try {
      setActivity(await getBotActivity(configId));
    } catch {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadActivity(selectedId);
  }, [selectedId, loadActivity]);

  const handleToggleEnabled = async (bot: BotConfig) => {
    setEnableLoading(bot.id);
    try {
      const updated = await setBotEnabled(bot.id, !bot.enabled);
      setBots(prev => prev.map(b => (b.id === bot.id ? updated : b)));
      showToast("ok", updated.enabled ? `${updated.display_name} enabled` : `${updated.display_name} disabled`);
    } catch {
      showToast("err", "Failed to update bot status");
    } finally {
      setEnableLoading(null);
    }
  };

  const handleTrigger = async (type: "thread" | "comment" | "engage") => {
    if (!selectedId) return;
    setTriggerLoading(type);
    try {
      const fns = { thread: triggerBotThread, comment: triggerBotComment, engage: triggerBotEngage };
      await fns[type](selectedId);
      showToast("ok", `${type} job triggered`);
      await loadActivity(selectedId);
    } catch {
      showToast("err", `Failed to trigger ${type} job`);
    } finally {
      setTriggerLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const bot = bots.find(b => b.id === selectedId);
    if (!window.confirm(`Delete bot config for ${bot?.display_name ?? "this bot"}? (User account is preserved.)`)) return;
    try {
      await deleteBotConfig(selectedId);
      setBots(prev => prev.filter(b => b.id !== selectedId));
      setSelectedId(null);
      showToast("ok", "Bot config deleted");
    } catch {
      showToast("err", "Failed to delete bot config");
    }
  };

  const handleIdentitySaved = (updated: BotConfig) => {
    setBots(prev => prev.map(b => (b.id === updated.id ? updated : b)));
    showToast("ok", "Identity saved");
  };

  const handleScheduleSaved = (updated: BotConfig) => {
    setBots(prev => prev.map(b => (b.id === updated.id ? updated : b)));
    showToast("ok", "Schedule saved");
  };

  const handleCreated = async () => {
    setCreating(false);
    await loadBots();
    showToast("ok", "Bot account created");
  };

  const selectedBot = bots.find(b => b.id === selectedId) ?? null;

  const RIGHT_TABS: { key: RightTab; label: string }[] = [
    { key: "identity", label: "Identity" },
    { key: "schedule", label: "Schedule" },
    { key: "content", label: "Content" },
  ];

  return (
    <div className="bot-tab">
      {/* Left panel — bot list */}
      <div className="list-panel">
        <div className="list-header">
          <div className="list-title"><Bot size={14} /><span>AI Bots ({bots.length})</span></div>
          <button type="button" className="new-btn" onClick={() => { setCreating(true); setSelectedId(null); }}>
            <Plus size={13} />New Bot
          </button>
        </div>

        {loading ? (
          <div className="list-empty"><Loader2 size={20} className="spin" /></div>
        ) : bots.length === 0 ? (
          <div className="list-empty">No bots yet. Create one.</div>
        ) : (
          <div className="bot-list">
            {bots.map(bot => (
              <div
                key={bot.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedId === bot.id}
                className={`bot-card ${selectedId === bot.id ? "selected" : ""}`}
                onClick={() => { setSelectedId(bot.id); setCreating(false); setRightTab("identity"); }}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(bot.id);
                    setCreating(false);
                    setRightTab("identity");
                  }
                }}
              >
                <div className="card-left">
                  {bot.avatar_url
                    ? <img src={bot.avatar_url} alt={bot.display_name} className="card-avatar" />
                    : <div className="card-avatar avatar-ph"><Bot size={14} /></div>
                  }
                  <div className="card-info">
                    <div className="card-name"><span>{bot.display_name}</span>{BOT_BADGE}</div>
                    <div className="card-username">@{bot.username}</div>
                    <div className="card-counters">
                      {bot.threads_created_today}T · {bot.comments_posted_today}C today
                    </div>
                  </div>
                </div>
                <div className="card-right">
                  <button
                    type="button"
                    className={`toggle-btn ${bot.enabled ? "on" : "off"}`}
                    disabled={enableLoading === bot.id}
                    onClick={e => { e.stopPropagation(); void handleToggleEnabled(bot); }}
                    title={bot.enabled ? "Disable bot" : "Enable bot"}
                  >
                    {enableLoading === bot.id ? <Loader2 size={16} className="spin" /> : bot.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                  <ChevronRight size={14} className="card-chevron" />
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="refresh-link" onClick={() => void loadBots()}>
          <RefreshCw size={12} />Refresh
        </button>
      </div>

      {/* Right panel */}
      <div className="right-panel">
        {creating ? (
          <CreateBotPanel onCreated={() => void handleCreated()} onCancel={() => setCreating(false)} />
        ) : selectedBot ? (
          <>
            <div className="right-tabs">
              {RIGHT_TABS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  className={`right-tab ${rightTab === t.key ? "active" : ""}`}
                  onClick={() => setRightTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="right-body">
              {rightTab === "identity" && (
                <IdentityPanel
                  bot={selectedBot}
                  onSaved={handleIdentitySaved}
                  onTrigger={handleTrigger}
                  onDelete={() => void handleDelete()}
                  activity={activity}
                  activityLoading={activityLoading}
                  triggerLoading={triggerLoading}
                />
              )}
              {rightTab === "schedule" && (
                <SchedulePanel bot={selectedBot} onSaved={handleScheduleSaved} />
              )}
              {rightTab === "content" && (
                <ContentPanel bot={selectedBot} />
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Bot size={32} style={{ color: "#2b3654" }} />
            <p>Select a bot to edit its identity, schedule, or view content.</p>
            <p>Or create a new bot account using the button on the left.</p>
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}

      <style jsx>{`
        .bot-tab { display: flex; gap: 0; height: 100%; min-height: 0; overflow: hidden; }
        .list-panel { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid #1e2741; overflow: hidden; }
        .list-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #1e2741; }
        .list-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #e4e8f4; }
        .new-btn { display: flex; align-items: center; gap: 5px; background: rgba(124, 115, 240, 0.15); border: 1px solid rgba(124, 115, 240, 0.35); border-radius: 7px; color: #9d97f0; font-size: 12px; font-weight: 600; padding: 5px 10px; cursor: pointer; }
        .new-btn:hover { background: rgba(124, 115, 240, 0.24); }
        .bot-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
        .bot-card { display: flex; align-items: center; justify-content: space-between; width: 100%; background: #111926; border: 1px solid #1c2640; border-radius: 10px; padding: 10px 12px; cursor: pointer; text-align: left; gap: 8px; }
        .bot-card:focus-visible { outline: 2px solid rgba(124, 115, 240, 0.85); outline-offset: 2px; }
        .bot-card:hover { border-color: #2b3654; background: #141e32; }
        .bot-card.selected { border-color: #7c73f0; background: rgba(124, 115, 240, 0.08); }
        .card-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .card-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .avatar-ph { background: #1e2741; display: grid; place-items: center; color: #7c73f0; }
        .card-info { flex: 1; min-width: 0; }
        .card-name { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: #e4e8f4; }
        .card-username { font-size: 11px; color: #636f8d; margin-top: 1px; }
        .card-counters { font-size: 10px; color: #4e5c80; margin-top: 3px; }
        .card-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .toggle-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; padding: 2px; }
        .toggle-btn.on { color: #3dd68c; }
        .toggle-btn.off { color: #4e5c80; }
        .toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .card-chevron { color: #4e5c80; }
        .list-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #4e5c80; font-size: 12px; gap: 8px; flex-direction: column; padding: 32px 16px; text-align: center; }
        .refresh-link { display: flex; align-items: center; justify-content: center; gap: 5px; background: none; border: none; border-top: 1px solid #1e2741; color: #4e5c80; font-size: 11px; padding: 10px; cursor: pointer; }
        .refresh-link:hover { color: #8591b3; }
        .right-panel { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; }
        .right-tabs { display: flex; gap: 2px; padding: 12px 24px 0; border-bottom: 1px solid #1e2741; flex-shrink: 0; }
        .right-tab { background: none; border: none; border-bottom: 2px solid transparent; color: #636f8d; font-size: 13px; font-weight: 600; padding: 8px 14px; cursor: pointer; margin-bottom: -1px; }
        .right-tab:hover { color: #b7c3df; }
        .right-tab.active { color: #7c73f0; border-bottom-color: #7c73f0; }
        .right-body { flex: 1; overflow-y: auto; padding: 24px; }
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; color: #4e5c80; font-size: 13px; text-align: center; }
        .empty-state p { margin: 0; max-width: 280px; }
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 10px 16px; border-radius: 10px; font-size: 12px; font-weight: 600; z-index: 99; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .toast.ok { background: rgba(61,214,140,0.16); color: #85e6ba; border: 1px solid rgba(61,214,140,0.34); }
        .toast.err { background: rgba(240,107,107,0.16); color: #f4b3b3; border: 1px solid rgba(240,107,107,0.34); }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
