"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, UserPlus, X } from "lucide-react";

import PageLoader from "@/components/shared/PageLoader";
import PeopleWorkspaceShell from "@/components/people/PeopleWorkspaceShell";
import {
  acceptMessageRequest,
  cancelMessageRequest,
  getPendingRequests,
  getSentRequests,
  rejectMessageRequest,
} from "@/lib/connectionApi";
import { avatarSeed, initials, relativeTime } from "@/lib/workspaceUtils";
import { toProfilePath } from "@/lib/profileRouting";
import type { MessageRequestOut } from "@/types/connection";

type Tab = "received" | "sent";
type CardAction = "idle" | "loading" | "done";

// ─── Request card ─────────────────────────────────────────────────────────────

function RequestCard({
  req,
  tab,
  onAccept,
  onDecline,
  onCancel,
  actionState,
}: {
  req: MessageRequestOut;
  tab: Tab;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCancel: (id: string) => void;
  actionState: CardAction;
}) {
  const router = useRouter();
  const displayName = req.other_user_display_name ?? "Unknown User";
  const username = req.other_user_username ?? "unknown";
  const userId = req.other_user_id ?? (tab === "received" ? req.sender_id : req.recipient_id);
  const [av1, av2] = avatarSeed(userId);
  const done = actionState === "done";
  const busy = actionState === "loading";

  return (
    <article className="req-card">
      <button
        type="button"
        className="req-avatar-wrap"
        onClick={() => router.push(toProfilePath(userId))}
        aria-label={`View ${displayName}'s profile`}
      >
        <div className="req-avatar" style={{ background: `linear-gradient(135deg,${av1},${av2})` }}>
          {initials(displayName)}
        </div>
      </button>

      <div className="req-info">
        <button
          type="button"
          className="req-name"
          onClick={() => router.push(toProfilePath(userId))}
        >
          {displayName}
        </button>
        <div className="req-username">@{username}</div>
        {req.message && <p className="req-message">"{req.message}"</p>}
        <div className="req-time">
          <Clock size={11} />
          {relativeTime(req.created_at)}
        </div>
      </div>

      <div className="req-actions">
        {done ? (
          <span className="done-label">
            {tab === "received" ? "Accepted" : "Cancelled"}
          </span>
        ) : tab === "received" ? (
          <>
            <button
              type="button"
              className="btn-accept"
              disabled={busy}
              onClick={() => onAccept(req.id)}
            >
              <Check size={13} />
              {busy ? "…" : "Accept"}
            </button>
            <button
              type="button"
              className="btn-decline"
              disabled={busy}
              onClick={() => onDecline(req.id)}
            >
              <X size={13} />
              {busy ? "…" : "Decline"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-cancel"
            disabled={busy}
            onClick={() => onCancel(req.id)}
          >
            <X size={13} />
            {busy ? "…" : "Cancel"}
          </button>
        )}
      </div>

      <style jsx>{`
        .req-card {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 16px 18px; border-radius: 14px;
          border: 1px solid #1e2235;
          background: linear-gradient(180deg, #111422, #0f1118);
          transition: border-color 0.15s;
        }
        .req-card:hover { border-color: #252b40; }

        .req-avatar-wrap {
          border: none; background: transparent; padding: 0; cursor: pointer; flex-shrink: 0;
        }
        .req-avatar {
          width: 52px; height: 52px; border-radius: 14px;
          display: grid; place-items: center;
          font-size: 17px; font-weight: 700; color: #fff;
          box-shadow: 0 4px 14px rgba(0,0,0,0.3);
        }

        .req-info { flex: 1; min-width: 0; display: grid; gap: 3px; }
        .req-name {
          border: none; background: transparent; padding: 0; text-align: left;
          font-size: 15px; font-weight: 700; color: #dde2f2;
          cursor: pointer; font-family: inherit;
          transition: color 0.15s;
        }
        .req-name:hover { color: #f0834a; }
        .req-username { font-size: 12px; color: #505a72; }
        .req-message {
          margin: 4px 0 0; font-size: 12px; color: #8a93ae;
          font-style: italic; line-height: 1.5;
        }
        .req-time {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; color: #3d4460; margin-top: 4px;
        }

        .req-actions {
          display: flex; flex-direction: column; gap: 6px;
          flex-shrink: 0; align-items: flex-end;
        }
        .btn-accept, .btn-decline, .btn-cancel {
          display: inline-flex; align-items: center; gap: 5px;
          border-radius: 8px; padding: 7px 13px;
          font-size: 12px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
          min-width: 90px; justify-content: center;
        }
        .btn-accept {
          border: none;
          background: linear-gradient(135deg,#3dd68c,#29b472);
          color: #fff;
        }
        .btn-accept:hover:not(:disabled) { opacity: 0.88; }
        .btn-decline {
          border: 1px solid #252b40; background: #151927; color: #636f8d;
        }
        .btn-decline:hover:not(:disabled) { color: #f06b6b; border-color: rgba(240,107,107,0.4); }
        .btn-cancel {
          border: 1px solid #252b40; background: #151927; color: #636f8d;
        }
        .btn-cancel:hover:not(:disabled) { color: #f06b6b; border-color: rgba(240,107,107,0.4); }
        .btn-accept:disabled, .btn-decline:disabled, .btn-cancel:disabled {
          opacity: 0.45; cursor: not-allowed;
        }
        .done-label {
          font-size: 11px; font-weight: 700; border-radius: 999px;
          padding: 3px 10px; color: #3dd68c;
          background: rgba(61,214,140,0.1); border: 1px solid rgba(61,214,140,0.25);
        }

        @media (max-width: 640px) {
          .req-card { flex-wrap: wrap; }
          .req-actions { flex-direction: row; width: 100%; }
          .btn-accept, .btn-decline, .btn-cancel { flex: 1; }
        }
      `}</style>
    </article>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PeopleRequestsWorkspace() {
  const [tab, setTab] = useState<Tab>("received");
  const [received, setReceived] = useState<MessageRequestOut[]>([]);
  const [sent, setSent] = useState<MessageRequestOut[]>([]);
  const [receivedTotal, setReceivedTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMap, setActionMap] = useState<Record<string, CardAction>>({});
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rec, snt] = await Promise.all([getPendingRequests(), getSentRequests()]);
      setReceived(rec.data);
      setReceivedTotal(rec.total);
      setSent(snt.data);
      setSentTotal(snt.total);
    } catch {
      setError("Failed to load connection requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && received.length === 0 && sent.length === 0) {
    return <PageLoader />;
  }

  function setAction(id: string, state: CardAction) {
    setActionMap(prev => ({ ...prev, [id]: state }));
  }

  async function handleAccept(reqId: string) {
    setAction(reqId, "loading");
    try {
      await acceptMessageRequest(reqId);
      setAction(reqId, "done");
      setReceivedTotal(t => Math.max(0, t - 1));
      showToast("Connection accepted!");
    } catch {
      setAction(reqId, "idle");
      showToast("Failed to accept", "error");
    }
  }

  async function handleDecline(reqId: string) {
    setAction(reqId, "loading");
    try {
      await rejectMessageRequest(reqId);
      setAction(reqId, "done");
      setReceivedTotal(t => Math.max(0, t - 1));
      showToast("Request declined.");
    } catch {
      setAction(reqId, "idle");
      showToast("Failed to decline", "error");
    }
  }

  async function handleCancel(reqId: string) {
    setAction(reqId, "loading");
    try {
      await cancelMessageRequest(reqId);
      setAction(reqId, "done");
      setSentTotal(t => Math.max(0, t - 1));
      showToast("Request cancelled.");
    } catch {
      setAction(reqId, "idle");
      showToast("Failed to cancel", "error");
    }
  }

  const activeList = tab === "received" ? received : sent;
  const pendingReceived = receivedTotal - received.filter(r => actionMap[r.id] === "done").length;

  return (
    <>
      <PeopleWorkspaceShell
        title="Connection Requests"
        subtitle="Accept incoming requests or manage the ones you've sent."
        requestsBadge={pendingReceived > 0 ? pendingReceived : undefined}
      >
        {/* Tab switcher */}
        <div className="req-tabs">
          <button
            type="button"
            className={`req-tab${tab === "received" ? " active" : ""}`}
            onClick={() => setTab("received")}
          >
            <UserPlus size={14} />
            Received
            {receivedTotal > 0 && <span className="tab-count">{receivedTotal}</span>}
          </button>
          <button
            type="button"
            className={`req-tab${tab === "sent" ? " active" : ""}`}
            onClick={() => setTab("sent")}
          >
            <Clock size={14} />
            Sent
            {sentTotal > 0 && <span className="tab-count">{sentTotal}</span>}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="status-msg">Loading…</div>
        ) : error ? (
          <div className="status-msg error">{error}</div>
        ) : activeList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              {tab === "received" ? <UserPlus size={24} strokeWidth={1.4} /> : <Clock size={24} strokeWidth={1.4} />}
            </div>
            <p className="empty-title">
              {tab === "received" ? "No pending requests" : "No sent requests"}
            </p>
            <p className="empty-sub">
              {tab === "received"
                ? "When someone sends you a connection request, it will appear here."
                : "Requests you've sent that haven't been accepted yet will appear here."}
            </p>
          </div>
        ) : (
          <div className="req-list">
            {activeList.map(req => (
              <RequestCard
                key={req.id}
                req={req}
                tab={tab}
                actionState={actionMap[req.id] ?? "idle"}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </PeopleWorkspaceShell>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <style jsx>{`
        .req-tabs {
          display: flex; gap: 6px;
          border-bottom: 1px solid #1e2235;
          padding-bottom: 0; margin-bottom: 4px;
        }
        .req-tab {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; font-size: 13px; font-weight: 600;
          color: #636f8d; background: transparent; border: none;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
          cursor: pointer; font-family: inherit; transition: color 0.15s;
        }
        .req-tab:hover { color: #b5bfd8; }
        .req-tab.active { color: #f0834a; border-bottom-color: #f0834a; }
        .tab-count {
          min-width: 18px; height: 18px; padding: 0 5px;
          border-radius: 999px; background: rgba(240,131,74,0.15);
          border: 1px solid rgba(240,131,74,0.3); color: #f0834a;
          font-size: 10px; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center;
        }

        .req-list { display: flex; flex-direction: column; gap: 8px; }

        .status-msg {
          font-size: 13px; color: #636f8d; padding: 20px 0;
        }
        .status-msg.error { color: #f06b6b; }

        .empty-state {
          border: 1px dashed #1e2540; border-radius: 18px;
          padding: 52px 20px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
        }
        .empty-icon {
          width: 56px; height: 56px; border-radius: 16px;
          background: #0e111a; border: 1px solid #1e2235;
          display: grid; place-items: center; color: #3d4460; margin-bottom: 4px;
        }
        .empty-title { font-size: 16px; font-weight: 600; color: #576080; margin: 0; }
        .empty-sub { font-size: 13px; color: #3d4460; margin: 0; max-width: 320px; line-height: 1.6; }

        .toast {
          position: fixed; bottom: 24px; right: 24px; z-index: 60;
          border-radius: 10px; padding: 10px 16px;
          font-size: 13px; font-weight: 600;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none;
        }
        .toast.success { background: rgba(61,214,140,0.15); border: 1px solid rgba(61,214,140,0.35); color: #3dd68c; }
        .toast.error   { background: rgba(240,107,107,0.15); border: 1px solid rgba(240,107,107,0.35); color: #f06b6b; }
      `}</style>
    </>
  );
}
