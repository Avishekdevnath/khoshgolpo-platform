import type { LucideIcon } from "lucide-react";

type AdminEmptyStateProps = {
  icon: LucideIcon;
  text: string;
  color?: string;
};

export default function AdminEmptyState({ icon: Icon, text, color = "#636f8d" }: AdminEmptyStateProps) {
  return (
    <>
      <div className="empty-state">
        <Icon size={32} style={{ color }} />
        <p>{text}</p>
      </div>
      <style jsx>{`
        .empty-state {
          text-align: center;
          padding: 48px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          border: 1px dashed #2b3656;
          border-radius: 14px;
          background: rgba(16, 22, 36, 0.48);
        }
        .empty-state p {
          color: #94a0c2;
          font-size: 14px;
          margin: 0;
          max-width: 460px;
        }
      `}</style>
    </>
  );
}
