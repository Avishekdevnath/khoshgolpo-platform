export default function AdminSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="sk-circle" />
          <div className="sk-lines">
            <div className="sk-bar" style={{ width: "50%" }} />
            <div className="sk-bar" style={{ width: "30%" }} />
          </div>
          <div className="sk-bar-end" style={{ width: "20%" }} />
        </div>
      ))}
      <style jsx>{`
        .skeleton-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 4px 0;
        }
        .skeleton-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 12px;
          background: #111826;
          border: 1px solid #1e2740;
        }
        .sk-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #1c2844;
          flex-shrink: 0;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        .sk-lines {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sk-bar {
          height: 10px;
          border-radius: 6px;
          background: #1c2844;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        .sk-bar-end {
          height: 10px;
          border-radius: 6px;
          background: #1c2844;
          animation: shimmer 1.4s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
