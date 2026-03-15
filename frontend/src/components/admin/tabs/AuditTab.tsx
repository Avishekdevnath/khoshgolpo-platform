import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ClipboardList, Copy, Download, Search } from "lucide-react";

import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSkeleton from "@/components/admin/shared/AdminSkeleton";
import ScrollArea from "@/components/shared/ScrollArea";
import { relativeTime } from "@/lib/workspaceUtils";
import type { AuditLogItem, AuditResult, AuditSeverity } from "@/types/admin";

type AuditTabProps = {
  logs: AuditLogItem[];
  total: number;
  loading: boolean;
  page: number;
  totalPages: number;
  action: string;
  targetType: string;
  severity: "" | AuditSeverity;
  result: "" | AuditResult;
  actorId: string;
  requestId: string;
  dateFrom: string;
  dateTo: string;
  onActionChange: (value: string) => void;
  onTargetTypeChange: (value: string) => void;
  onSeverityChange: (value: "" | AuditSeverity) => void;
  onResultChange: (value: "" | AuditResult) => void;
  onActorIdChange: (value: string) => void;
  onRequestIdChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onPageChange: (value: number) => void;
  onExport: (format: "csv" | "json") => void;
};

function absoluteTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function targetLabel(log: AuditLogItem): string {
  if (log.target_display_name) return log.target_display_name;
  if (!log.target_id) return log.target_type;
  return `${log.target_type}:${log.target_id.slice(-8)}`;
}

function actorLabel(log: AuditLogItem): string {
  if (log.actor_display_name) return log.actor_display_name;
  if (!log.actor_id) return "-";
  return log.actor_id.slice(-8);
}

function actorDetailLabel(log: AuditLogItem): string {
  if (log.actor_display_name && log.actor_username) {
    return `${log.actor_display_name} (@${log.actor_username})`;
  }
  if (log.actor_display_name) return log.actor_display_name;
  return log.actor_id ?? "-";
}

function targetDetailLabel(log: AuditLogItem): string {
  if (log.target_display_name) return log.target_display_name;
  if (!log.target_id) return log.target_type;
  return `${log.target_type} (${log.target_id})`;
}

function cssClassForSeverity(severity: AuditSeverity): string {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "info";
}

function cssClassForResult(result: AuditResult): string {
  if (result === "failed") return "failed";
  return "success";
}

export default function AuditTab({
  logs,
  total,
  loading,
  page,
  totalPages,
  action,
  targetType,
  severity,
  result,
  actorId,
  requestId,
  dateFrom,
  dateTo,
  onActionChange,
  onTargetTypeChange,
  onSeverityChange,
  onResultChange,
  onActorIdChange,
  onRequestIdChange,
  onDateFromChange,
  onDateToChange,
  onPageChange,
  onExport,
}: AuditTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Local debounced state for text inputs
  const [localAction, setLocalAction] = useState(action);
  const [localActorId, setLocalActorId] = useState(actorId);
  const [localRequestId, setLocalRequestId] = useState(requestId);

  // Sync local state when parent value changes (e.g. URL navigation)
  useEffect(() => { setLocalAction(action); }, [action]);
  useEffect(() => { setLocalActorId(actorId); }, [actorId]);
  useEffect(() => { setLocalRequestId(requestId); }, [requestId]);

  // Debounce: fire parent onChange 300ms after local change
  useEffect(() => {
    const t = setTimeout(() => onActionChange(localAction), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localAction]);
  useEffect(() => {
    const t = setTimeout(() => onActorIdChange(localActorId), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localActorId]);
  useEffect(() => {
    const t = setTimeout(() => onRequestIdChange(localRequestId), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localRequestId]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const activeSelectedId = useMemo(() => {
    if (selectedId && logs.some(log => log.id === selectedId)) return selectedId;
    return logs[0]?.id ?? null;
  }, [logs, selectedId]);

  const selectedLog = useMemo(() => logs.find(log => log.id === activeSelectedId) ?? null, [activeSelectedId, logs]);

  const rawJson = useMemo(() => {
    if (!selectedLog) return "";
    return JSON.stringify(selectedLog, null, 2);
  }, [selectedLog]);

  const copyRawJson = async () => {
    if (!rawJson) return;
    try {
      await navigator.clipboard.writeText(rawJson);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="audit-shell">
      <div className="toolbar">
        <AdminSectionHeader title="Audit Log" countLabel={`${total} entries`} />

        <div className="filter-row">
          <div className="search-wrap grow">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              type="text"
              value={localAction}
              onChange={e => setLocalAction(e.target.value)}
              placeholder="Action..."
            />
          </div>
          <input className="admin-input" type="text" value={targetType} onChange={e => onTargetTypeChange(e.target.value)} placeholder="Target type" />
          <select className="admin-select" value={severity} onChange={e => onSeverityChange(e.target.value as "" | AuditSeverity)}>
            <option value="">Any severity</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <select className="admin-select" value={result} onChange={e => onResultChange(e.target.value as "" | AuditResult)}>
            <option value="">Any result</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <input className="admin-input" type="text" value={localActorId} onChange={e => setLocalActorId(e.target.value)} placeholder="Actor id" />
          <input className="admin-input" type="text" value={localRequestId} onChange={e => setLocalRequestId(e.target.value)} placeholder="Request id" />
          <input className="admin-input" type="date" value={dateFrom} onChange={e => onDateFromChange(e.target.value)} />
          <input className="admin-input" type="date" value={dateTo} onChange={e => onDateToChange(e.target.value)} />
          <div className="export-wrap">
            <button
              type="button"
              className="export-btn"
              onClick={() => setExportOpen(o => !o)}
              onBlur={() => setTimeout(() => setExportOpen(false), 150)}
              title="Export"
            >
              <Download size={13} />
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button type="button" onClick={() => { onExport("csv"); setExportOpen(false); }}>CSV</button>
                <button type="button" onClick={() => { onExport("json"); setExportOpen(false); }}>JSON</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="audit-body">
        <div className="table-pane">
          <ScrollArea
            className="table-scroll"
            size="lg"
            tone="strong"
            style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
          >
            {loading && logs.length === 0 ? (
              <div style={{ padding: "10px 12px" }}><AdminSkeleton rows={8} /></div>
            ) : logs.length === 0 ? (
              <AdminEmptyState icon={ClipboardList} text="No audit logs found." />
            ) : (
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Severity</th>
                    <th>Result</th>
                    <th>Target</th>
                    <th>Actor</th>
                    <th>Request</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const selected = log.id === activeSelectedId;
                    return (
                      <tr key={log.id} className={selected ? "selected" : ""} onClick={() => setSelectedId(log.id)}>
                        <td title={absoluteTime(log.created_at)}>{relativeTime(log.created_at)}</td>
                        <td>{log.action}</td>
                        <td>
                          <span className={`chip ${cssClassForSeverity(log.severity)}`}>{log.severity}</span>
                        </td>
                        <td>
                          <span className={`chip ${cssClassForResult(log.result)}`}>{log.result}</span>
                        </td>
                        <td title={log.target_id ?? ""}>{targetLabel(log)}</td>
                        <td title={log.actor_id ?? ""}>{actorLabel(log)}</td>
                        <td title={log.request_id ?? ""}>{log.request_id ? log.request_id.slice(0, 16) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </ScrollArea>

          {!loading && logs.length > 0 && (
            <div className="pager">
              <button type="button" className="tiny-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                <ChevronLeft size={12} /> Prev
              </button>
              <span className="page-text">
                Page {page} / {totalPages}
              </span>
              <button type="button" className="tiny-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                Next <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>

        <aside className="detail-pane">
          {!selectedLog ? (
            <div className="detail-empty">Select an event to inspect details.</div>
          ) : (
            <>
              <div className="detail-head">
                <div>
                  <p className="detail-eyebrow">Event Details</p>
                  <h3 className="detail-title">{selectedLog.action}</h3>
                </div>
                <button type="button" className="copy-btn" onClick={() => void copyRawJson()}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy JSON"}
                </button>
              </div>

              <div className="detail-grid">
                <div>
                  <span className="label">Severity</span>
                  <span className={`chip ${cssClassForSeverity(selectedLog.severity)}`}>{selectedLog.severity}</span>
                </div>
                <div>
                  <span className="label">Result</span>
                  <span className={`chip ${cssClassForResult(selectedLog.result)}`}>{selectedLog.result}</span>
                </div>
                <div>
                  <span className="label">Target</span>
                  <p>{targetDetailLabel(selectedLog)}</p>
                </div>
                <div>
                  <span className="label">Actor</span>
                  <p>{actorDetailLabel(selectedLog)}</p>
                </div>
                <div>
                  <span className="label">Request ID</span>
                  <p>{selectedLog.request_id ?? "-"}</p>
                </div>
                <div>
                  <span className="label">IP</span>
                  <p>{selectedLog.ip ?? "-"}</p>
                </div>
                <div>
                  <span className="label">Created</span>
                  <p>{absoluteTime(selectedLog.created_at)}</p>
                </div>
              </div>

              <p className="raw-label">Raw JSON</p>
              <ScrollArea className="raw-scroll" tone="subtle" size="md" style={{ overflowY: "auto" }}>
                <pre className="raw">{rawJson}</pre>
              </ScrollArea>
            </>
          )}
        </aside>
      </div>

      <style jsx>{`
        .audit-shell {
          display: flex;
          flex-direction: column;
          gap: 10px;
          height: 100%;
          min-height: 0;
        }
        .toolbar {
          flex-shrink: 0;
          padding-bottom: 8px;
          background: linear-gradient(180deg, #101626 0%, rgba(16, 22, 38, 0.95) 70%, rgba(16, 22, 38, 0));
        }
        .filter-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .export-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .export-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 100%;
          min-height: 36px;
          border: 1px solid #2d3957;
          background: #131c2f;
          color: #8a96b8;
          border-radius: 10px;
          cursor: pointer;
        }
        .export-btn:hover {
          color: #e4e8f4;
          border-color: #3a4a70;
        }
        .export-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          background: #141c30;
          border: 1px solid #293553;
          border-radius: 8px;
          padding: 4px;
          z-index: 30;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 80px;
        }
        .export-menu button {
          background: transparent;
          border: none;
          color: #b8c4e0;
          font-size: 12px;
          font-family: inherit;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
        }
        .export-menu button:hover {
          background: #1e2a45;
          color: #e4e8f4;
        }
        .grow {
          flex: 1;
          min-width: 220px;
        }
        .search-wrap {
          position: relative;
        }
        .search-wrap :global(.search-icon) {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #3d4460;
        }
        .search-input,
        .admin-input,
        .admin-select {
          border: 1px solid #2d3957;
          background: #131c2f;
          color: #e4e8f4;
          border-radius: 10px;
          padding: 9px 10px;
          font-size: 12px;
          font-family: inherit;
        }
        .search-input {
          width: 100%;
          padding-left: 38px;
        }
        .audit-body {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 10px;
        }
        .table-pane {
          min-width: 0;
          min-height: 0;
          border: 1px solid #253252;
          border-radius: 14px;
          background: linear-gradient(180deg, #121b2f, #101727);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .table-scroll {
          min-height: 120px;
        }
        .center-msg {
          text-align: center;
          color: #636f8d;
          padding: 32px 0;
        }
        .audit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .audit-table th {
          position: sticky;
          top: 0;
          z-index: 1;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid #253252;
          color: #9ba9ca;
          background: #131d32;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 10px;
          white-space: nowrap;
        }
        .audit-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #1c2742;
          color: #d4dcf5;
          white-space: nowrap;
        }
        .audit-table tbody tr {
          cursor: pointer;
        }
        .audit-table tbody tr:hover {
          background: rgba(113, 139, 255, 0.08);
        }
        .audit-table tbody tr.selected {
          background: rgba(113, 139, 255, 0.16);
        }
        .chip {
          border: 1px solid #2f3a59;
          background: #172036;
          color: #aebadb;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
        .chip.info {
          color: #b8ccff;
          border-color: rgba(113, 139, 255, 0.35);
          background: rgba(113, 139, 255, 0.16);
        }
        .chip.warning {
          color: #f6c5ab;
          border-color: rgba(240, 131, 74, 0.35);
          background: rgba(240, 131, 74, 0.16);
        }
        .chip.critical,
        .chip.failed {
          color: #f6b0b0;
          border-color: rgba(240, 107, 107, 0.35);
          background: rgba(240, 107, 107, 0.16);
        }
        .chip.success {
          color: #8ce6ba;
          border-color: rgba(61, 214, 140, 0.35);
          background: rgba(61, 214, 140, 0.16);
        }
        .pager {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 10px 12px;
          border-top: 1px solid #1f2b47;
          flex-shrink: 0;
        }
        .tiny-btn {
          border: 1px solid #2f3a58;
          background: #182135;
          color: #c3cde7;
          border-radius: 8px;
          padding: 6px 9px;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .tiny-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .page-text {
          font-size: 12px;
          color: #7e87a4;
        }
        .detail-pane {
          border: 1px solid #253252;
          border-radius: 14px;
          background: linear-gradient(180deg, #121b2f, #101727);
          padding: 14px;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .detail-empty {
          color: #7d89ab;
          font-size: 13px;
          margin-top: 6px;
        }
        .detail-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .detail-eyebrow {
          margin: 0;
          color: #7d89ab;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .detail-title {
          margin: 3px 0 0;
          color: #ebf1ff;
          font-size: 16px;
          line-height: 1.2;
        }
        .copy-btn {
          border: 1px solid #2f3a58;
          background: #182135;
          color: #c3cde7;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          white-space: nowrap;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .detail-grid .label {
          display: block;
          color: #7d89ab;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 4px;
        }
        .detail-grid p {
          margin: 0;
          color: #d7dff8;
          font-size: 12px;
          word-break: break-word;
        }
        .raw-label {
          margin: 0;
          color: #7d89ab;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .raw-scroll {
          flex: 1;
          min-height: 120px;
          border: 1px solid #223050;
          border-radius: 10px;
          background: #0d1424;
          overflow: hidden;
        }
        .raw {
          margin: 0;
          padding: 10px;
          font-size: 11px;
          line-height: 1.45;
          color: #b0bbdb;
          white-space: pre-wrap;
          word-break: break-word;
        }
        @media (max-width: 1120px) {
          .audit-body {
            grid-template-columns: minmax(0, 1fr);
          }
          .detail-pane {
            max-height: 320px;
          }
        }
      `}</style>
    </div>
  );
}
