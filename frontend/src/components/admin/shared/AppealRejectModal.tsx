import { useEffect, useState } from "react";
import { ShieldX, X } from "lucide-react";

import type { AdminAppealItem } from "@/types/admin";

type AppealRejectModalProps = {
  appeal: AdminAppealItem;
  loading: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
};

const MAX_NOTE_LENGTH = 500;

export default function AppealRejectModal({
  appeal,
  loading,
  onClose,
  onSubmit,
}: AppealRejectModalProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose]);

  const trimmedNote = note.trim();
  const tooLong = trimmedNote.length > MAX_NOTE_LENGTH;
  const targetLabel = `${appeal.content_type} ${appeal.content_id.slice(-8)}`;

  async function handleSubmit() {
    if (loading) return;
    if (tooLong) {
      setError(`Note must be at most ${MAX_NOTE_LENGTH} characters.`);
      return;
    }

    setError(null);
    try {
      await onSubmit(trimmedNote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject appeal.");
    }
  }

  return (
    <div
      className="reject-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-appeal-modal-title"
      onClick={event => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div className="reject-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-head">
          <div className="head-title">
            <ShieldX size={16} />
            <h3 id="reject-appeal-modal-title">Reject appeal</h3>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Close reject appeal modal"
          >
            <X size={15} />
          </button>
        </div>

        <p className="modal-sub">You are rejecting appeal for {targetLabel}. Add an optional note for context.</p>

        <label htmlFor="appeal-reject-note">Optional rejection note</label>
        <textarea
          id="appeal-reject-note"
          value={note}
          onChange={event => setNote(event.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={5}
          disabled={loading}
          placeholder="Write a short rejection note (optional)"
        />

        <div className="meta-row">
          <span className={`count ${tooLong ? "bad" : ""}`}>{trimmedNote.length}/{MAX_NOTE_LENGTH}</span>
          {error && <span className="error">{error}</span>}
        </div>

        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => void handleSubmit()}
            disabled={loading || tooLong}
          >
            {loading ? "Rejecting..." : "Reject appeal"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .reject-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: rgba(6, 9, 17, 0.62);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .reject-modal {
          width: min(560px, 100%);
          border: 1px solid #243252;
          border-radius: 14px;
          background: linear-gradient(180deg, #121a2c, #101626);
          color: #e4e9f9;
          padding: 18px;
          box-shadow: 0 24px 54px rgba(0, 0, 0, 0.42);
        }
        .modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .head-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #f6b0b0;
        }
        .head-title h3 {
          margin: 0;
          font-family: var(--font-dm-serif), serif;
          font-size: 20px;
          line-height: 1.1;
          color: #ecf2ff;
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
        .close-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .modal-sub {
          margin: 0 0 12px;
          color: #9aa6c6;
          font-size: 13px;
          line-height: 1.45;
        }
        label {
          display: block;
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #7f8bab;
        }
        textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 110px;
          border-radius: 10px;
          border: 1px solid #2f3c5d;
          background: #151f34;
          color: #e4e9f9;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.5;
          resize: vertical;
          outline: none;
          font-family: inherit;
        }
        textarea:focus {
          border-color: #f0834a;
        }
        textarea:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .meta-row {
          margin-top: 8px;
          min-height: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .count {
          font-size: 11px;
          color: #7f8bab;
        }
        .count.bad {
          color: #f6b0b0;
        }
        .error {
          font-size: 12px;
          color: #f6b0b0;
          text-align: right;
        }
        .actions {
          margin-top: 14px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .btn {
          border: 1px solid transparent;
          border-radius: 9px;
          padding: 8px 13px;
          font-size: 12px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn.ghost {
          border-color: #2f3c5d;
          background: #182135;
          color: #9ca8c8;
        }
        .btn.danger {
          border-color: rgba(240, 107, 107, 0.38);
          background: rgba(240, 107, 107, 0.18);
          color: #f6b0b0;
        }
      `}</style>
    </div>
  );
}
