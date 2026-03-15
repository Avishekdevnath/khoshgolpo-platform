import { useEffect, useState } from "react";
import { X } from "lucide-react";

type AppealModalProps = {
  loading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
};

const DEFAULT_REASON = "Please review this moderation decision.";
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

export default function AppealModal({ loading, onClose, onSubmit }: AppealModalProps) {
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose]);

  const trimmedReason = reason.trim();
  const tooShort = trimmedReason.length < MIN_REASON_LENGTH;
  const tooLong = trimmedReason.length > MAX_REASON_LENGTH;

  async function handleSubmit() {
    if (loading) return;
    if (tooShort) {
      setError(`Reason must be at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }
    if (tooLong) {
      setError(`Reason must be at most ${MAX_REASON_LENGTH} characters.`);
      return;
    }

    setError(null);
    try {
      await onSubmit(trimmedReason);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit appeal.");
    }
  }

  return (
    <div
      className="appeal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appeal-modal-title"
      onClick={event => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div className="appeal-modal" onClick={event => event.stopPropagation()}>
        <div className="appeal-header">
          <h3 id="appeal-modal-title">Submit appeal</h3>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Close appeal modal"
          >
            <X size={16} />
          </button>
        </div>

        <p className="appeal-note">
          Explain why this moderation decision should be reviewed.
        </p>

        <label htmlFor="appeal-reason">Reason</label>
        <textarea
          id="appeal-reason"
          value={reason}
          onChange={event => setReason(event.target.value)}
          maxLength={MAX_REASON_LENGTH}
          disabled={loading}
          rows={5}
          placeholder="Write your appeal reason..."
        />

        <div className="meta-row">
          <span className={`count ${tooLong ? "bad" : ""}`}>
            {trimmedReason.length}/{MAX_REASON_LENGTH}
          </span>
          {error && <span className="error">{error}</span>}
        </div>

        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void handleSubmit()}
            disabled={loading || tooShort || tooLong}
          >
            {loading ? "Submitting..." : "Submit appeal"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .appeal-overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .appeal-modal {
          width: min(560px, 100%);
          border: 1px solid #1e2235;
          border-radius: 14px;
          background: linear-gradient(180deg, #121624, #101420);
          color: #e4e8f4;
          padding: 18px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
        }
        .appeal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .appeal-header h3 {
          margin: 0;
          font-family: var(--font-dm-serif), serif;
          font-size: 20px;
          line-height: 1.1;
        }
        .close-btn {
          border: 1px solid #2b324c;
          background: #151927;
          color: #8d98b8;
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
        .appeal-note {
          margin: 0 0 12px;
          color: #9aa4c2;
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
          color: #7e89a9;
        }
        textarea {
          width: 100%;
          box-sizing: border-box;
          resize: vertical;
          min-height: 110px;
          border: 1px solid #2b324c;
          background: #151927;
          color: #e4e8f4;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.5;
          outline: none;
          font-family: inherit;
        }
        textarea:focus {
          border-color: #f0834a;
        }
        textarea:disabled {
          opacity: 0.65;
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
          color: #7e89a9;
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
          border-radius: 9px;
          border: 1px solid transparent;
          padding: 8px 13px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn.ghost {
          border-color: #2b324c;
          background: #151927;
          color: #9aa4c2;
        }
        .btn.primary {
          border-color: rgba(240, 131, 74, 0.45);
          background: rgba(240, 131, 74, 0.18);
          color: #ffc2a0;
        }
      `}</style>
    </div>
  );
}
