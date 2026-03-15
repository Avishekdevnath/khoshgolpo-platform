type AdminSectionHeaderProps = {
  title: string;
  countLabel?: string;
};

export default function AdminSectionHeader({ title, countLabel }: AdminSectionHeaderProps) {
  return (
    <>
      <div className="sec-header">
        <h2 className="sec-title">{title}</h2>
        {countLabel && <span className="sec-count">{countLabel}</span>}
      </div>
      <style jsx>{`
        .sec-header {
          display: flex;
          align-items: center;
          gap: 10px;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 10px;
          border-bottom: 1px solid #202944;
        }
        .sec-title {
          font-family: var(--font-dm-serif), serif;
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          color: #eef3ff;
        }
        .sec-count {
          font-size: 11px;
          color: #a8b4d4;
          background: #162039;
          border: 1px solid #2b3553;
          border-radius: 999px;
          padding: 4px 11px;
          font-weight: 600;
          white-space: nowrap;
        }
      `}</style>
    </>
  );
}
