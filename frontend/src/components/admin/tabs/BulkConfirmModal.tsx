import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

import type { UserRole } from "@/types/admin";

type BulkConfirmModalProps = {
  count: number;
  actionType: "role" | "activate" | "deactivate";
  newRole?: UserRole;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function BulkConfirmModal({
  count,
  actionType,
  newRole,
  loading,
  onClose,
  onConfirm,
}: BulkConfirmModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose]);

  const label =
    actionType === "role"
      ? `Change role to "${newRole}" for ${count} user(s)`
      : actionType === "activate"
        ? `Activate ${count} user(s)`
        : `Deactivate ${count} user(s)`;

  const confirmLabel =
    actionType === "role"
      ? "Change role"
      : actionType === "activate"
        ? "Activate"
        : "Deactivate";

  const isDanger = actionType === "deactivate";

  return (
    <div
      className="bcm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-confirm-title"
      onClick={event => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div className="bcm-modal" onClick={event => event.stopPropagation()}>
        <div className="bcm-head">
          <div className="head-title">
            <AlertTriangle size={16} />
            <h3 id="bulk-confirm-title">Confirm bulk action</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose} disabled={loading} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <p className="bcm-desc">{label}</p>
        <p className="bcm-warn">This action will be applied immediately to all selected users.</p>

        <div className="bcm-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${isDanger ? "danger" : "primary"}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>

      <style jsx>{`
        .bcm-overlay {
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
        .bcm-modal {
          width: min(460px, 100%);
          border: 1px solid #243252;
          border-radius: 14px;
          background: linear-gradient(180deg, #121a2c, #101626);
          color: #e4e9f9;
          padding: 18px;
          box-shadow: 0 24px 54px rgba(0, 0, 0, 0.42);
        }
        .bcm-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .head-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #f0834a;
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
        .bcm-desc {
          margin: 0 0 6px;
          font-size: 14px;
          font-weight: 600;
          color: #e4e9f9;
        }
        .bcm-warn {
          margin: 0 0 16px;
          font-size: 12px;
          color: #8591b3;
        }
        .bcm-actions {
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
        .btn.primary {
          border-color: rgba(240, 131, 74, 0.38);
          background: rgba(240, 131, 74, 0.18);
          color: #f0a67a;
        }
      `}</style>
    </div>
  );
}
