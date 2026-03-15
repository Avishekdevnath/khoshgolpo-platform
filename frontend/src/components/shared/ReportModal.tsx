"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, Loader2, X } from "lucide-react";

type ReportReason = "spam" | "harassment" | "misinformation" | "nsfw" | "other";

const REASONS: { value: ReportReason; label: string; desc: string }[] = [
  { value: "spam", label: "Spam", desc: "Repetitive, promotional, or unsolicited content" },
  { value: "harassment", label: "Harassment", desc: "Personal attacks, threats, or targeted abuse" },
  { value: "misinformation", label: "Misinformation", desc: "Demonstrably false or misleading claims" },
  { value: "nsfw", label: "NSFW", desc: "Inappropriate or explicit content" },
  { value: "other", label: "Other", desc: "Something else not listed above" },
];

type Props = {
  targetType: "thread" | "post";
  onClose: () => void;
  onSubmit: (reason: ReportReason, detail: string) => Promise<void>;
};

export default function ReportModal({ targetType, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Focus trap on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSubmit(reason, detail);
      setDone(true);
      setTimeout(onClose, 1600);
    } catch {
      setError("Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="dialog-header">
          <div className="dialog-title" id="report-title">
            <Flag size={15} />
            Report {targetType === "thread" ? "Thread" : "Post"}
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {done ? (
          <div className="done-state">
            <div className="done-icon">✓</div>
            <div className="done-text">Report submitted. Our moderation team will review it.</div>
          </div>
        ) : (
          <>
            <div className="dialog-body">
              <div className="field-label">Why are you reporting this {targetType}?</div>
              <div className="reason-list">
                {REASONS.map(r => (
                  <label key={r.value} className={`reason-item ${reason === r.value ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="radio"
                    />
                    <div className="reason-text">
                      <span className="reason-label">{r.label}</span>
                      <span className="reason-desc">{r.desc}</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="field-label" style={{ marginTop: 14 }}>Additional details <span className="optional">(optional)</span></div>
              <textarea
                className="detail-input"
                rows={3}
                maxLength={500}
                placeholder="Describe the issue in more detail…"
                value={detail}
                onChange={e => setDetail(e.target.value)}
              />
              <div className="char-count">{detail.length}/500</div>

              {error && <div className="error-box">{error}</div>}
            </div>

            <div className="dialog-footer">
              <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-submit" onClick={() => void handleSubmit()} disabled={loading}>
                {loading ? <Loader2 size={13} className="spin" /> : <Flag size={13} />}
                Submit Report
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(4, 6, 14, 0.75);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(2px);
          animation: fadein 0.15s ease;
        }
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
        .dialog {
          background: #10131d; border: 1px solid #1e2741; border-radius: 16px;
          width: 100%; max-width: 460px; margin: 16px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.5);
          animation: slidein 0.15s ease;
          outline: none;
        }
        @keyframes slidein { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .dialog-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px 14px;
          border-bottom: 1px solid #1a2035;
        }
        .dialog-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 15px; font-weight: 700; color: #e4e8f4;
        }
        .close-btn {
          background: none; border: none; color: #636f8d; cursor: pointer;
          display: flex; align-items: center; padding: 4px; border-radius: 6px;
        }
        .close-btn:hover { color: #c5cfe6; background: #1a2236; }
        .dialog-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; }
        .field-label { font-size: 12px; font-weight: 600; color: #8591b3; }
        .optional { font-weight: 400; color: #4e5c80; }
        .reason-list { display: flex; flex-direction: column; gap: 4px; }
        .reason-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          border: 1px solid #1e2741; cursor: pointer;
          background: #0d1120;
          transition: border-color 0.12s, background 0.12s;
        }
        .reason-item.selected {
          border-color: rgba(240, 131, 74, 0.5);
          background: rgba(240, 131, 74, 0.06);
        }
        .reason-item:hover:not(.selected) { border-color: #2a3454; background: #111826; }
        .radio { margin-top: 2px; accent-color: #f0834a; flex-shrink: 0; }
        .reason-text { display: flex; flex-direction: column; gap: 1px; }
        .reason-label { font-size: 13px; font-weight: 600; color: #c5cfe6; }
        .reason-desc { font-size: 11px; color: #636f8d; }
        .detail-input {
          background: #0d1120; border: 1px solid #1e2741; border-radius: 10px;
          color: #c5cfe6; padding: 10px 12px; font-size: 13px;
          font-family: inherit; resize: none; outline: none; width: 100%;
          box-sizing: border-box;
        }
        .detail-input:focus { border-color: #f0834a; }
        .char-count { font-size: 11px; color: #4e5c80; text-align: right; margin-top: -4px; }
        .error-box {
          background: rgba(240, 107, 107, 0.1); border: 1px solid rgba(240, 107, 107, 0.25);
          border-radius: 8px; color: #f4b3b3; font-size: 12px; padding: 10px 12px;
        }
        .dialog-footer {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 14px 20px 18px;
          border-top: 1px solid #1a2035;
        }
        .btn-cancel {
          background: transparent; border: 1px solid #2a3454; border-radius: 8px;
          color: #8591b3; font-size: 13px; padding: 8px 16px; cursor: pointer;
        }
        .btn-cancel:hover { border-color: #435174; color: #c5cfe6; }
        .btn-submit {
          display: flex; align-items: center; gap: 6px;
          background: #f0834a; border: none; border-radius: 8px;
          color: #fff; font-size: 13px; font-weight: 600; padding: 8px 18px; cursor: pointer;
        }
        .btn-submit:hover:not(:disabled) { background: #f5954d; }
        .btn-submit:disabled { opacity: 0.55; cursor: not-allowed; }
        .done-state {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 36px 20px;
        }
        .done-icon {
          width: 48px; height: 48px; border-radius: 50%;
          background: rgba(61, 214, 140, 0.12); border: 1px solid rgba(61, 214, 140, 0.3);
          display: grid; place-items: center;
          font-size: 22px; color: #3dd68c;
        }
        .done-text { font-size: 13px; color: #8591b3; text-align: center; max-width: 280px; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
