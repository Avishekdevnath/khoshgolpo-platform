import type { LucideIcon } from "lucide-react";

type AdminStatCardProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
};

export default function AdminStatCard({ icon: Icon, label, value, color }: AdminStatCardProps) {
  return (
    <>
      <div className="sc">
        <div className="sc-icon" style={{ background: `${color}15`, color }}>
          <Icon size={18} />
        </div>
        <div>
          <div className="sc-label">{label}</div>
          <div className="sc-value">{value}</div>
        </div>
      </div>
      <style jsx>{`
        .sc {
          border: 1px solid #28314c;
          background: linear-gradient(180deg, #121a2b 0%, #101727 100%);
          border-radius: 14px;
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: border-color 0.15s, transform 0.15s;
        }
        .sc:hover {
          border-color: #3a4668;
          transform: translateY(-1px);
        }
        .sc-icon {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .sc-label {
          font-size: 11px;
          color: #8490b2;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .sc-value {
          font-family: var(--font-dm-serif), serif;
          font-size: 26px;
          font-weight: 700;
          line-height: 1;
          color: #edf2ff;
        }
      `}</style>
    </>
  );
}
