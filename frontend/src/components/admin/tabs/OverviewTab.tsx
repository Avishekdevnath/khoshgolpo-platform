import { AlertTriangle, Flag, MessageSquare, Trash2, Users } from "lucide-react";

import AdminStatCard from "@/components/admin/shared/AdminStatCard";
import InterestSuggestionBatchPanel from "@/components/admin/tabs/InterestSuggestionBatchPanel";
import type { FeedAIHealth, FeedConfig } from "@/types/feed";
import type { AdminStats } from "@/types/admin";

type OverviewTabProps = {
  stats: AdminStats;
  onOpenModeration: () => void;
  feedConfig?: FeedConfig | null;
  feedAIHealth?: FeedAIHealth | null;
  feedReadError?: string | null;
};

export default function OverviewTab({
  stats,
  onOpenModeration,
  feedConfig,
  feedAIHealth,
  feedReadError,
}: OverviewTabProps) {
  const generatedAt = new Date(stats.generated_at).toLocaleString();
  const activeRate = stats.total_users > 0 ? Math.round((stats.active_users / stats.total_users) * 100) : 0;
  const totalContent = stats.total_posts + stats.total_threads;
  const flaggedRate = totalContent > 0 ? Math.round((stats.flagged_posts / totalContent) * 100) : 0;
  const feedResetAt = feedAIHealth?.ai_last_reset ? new Date(feedAIHealth.ai_last_reset).toLocaleDateString() : null;

  return (
    <>
      <div className="stat-grid">
        <AdminStatCard icon={Users} label="Total Users" value={stats.total_users} color="#7c73f0" />
        <AdminStatCard icon={Users} label="Active Users" value={stats.active_users} color="#3dd68c" />
        <AdminStatCard icon={MessageSquare} label="Threads" value={stats.total_threads} color="#f0834a" />
        <AdminStatCard icon={MessageSquare} label="Total Posts" value={stats.total_posts} color="#6b8afd" />
        <AdminStatCard icon={Flag} label="Flagged Content" value={stats.flagged_posts} color="#f06b6b" />
        <AdminStatCard icon={Trash2} label="Deleted Posts" value={stats.deleted_posts} color="#636f8d" />
      </div>
      {stats.flagged_posts > 0 && (
        <button type="button" className="alert-banner" onClick={onOpenModeration}>
          <AlertTriangle size={15} />
          <span>{stats.flagged_posts} flagged content item(s) need review</span>
          <span className="banner-arrow">View</span>
        </button>
      )}
      <div className="meta-note">Last updated: {generatedAt}</div>

      <div className="ops-grid">
        <div className="ops-card">
          <div className="ops-label">User Activity Rate</div>
          <div className="ops-value">{activeRate}%</div>
          <div className="ops-sub">{stats.active_users} of {stats.total_users} accounts active</div>
        </div>
        <div className="ops-card">
          <div className="ops-label">Flagged Content Ratio</div>
          <div className="ops-value">{flaggedRate}%</div>
          <div className="ops-sub">{stats.flagged_posts} flagged out of {totalContent} total items</div>
        </div>
        <button type="button" className="ops-card cta" onClick={onOpenModeration}>
          <div className="ops-label">Moderation Actions</div>
          <div className="ops-value">Open Queue</div>
          <div className="ops-sub">Review flagged posts and resolve risk quickly.</div>
        </button>
      </div>

      <section className="feed-panel">
        <div className="feed-panel-head">
          <h3>Feed Config (Read Only)</h3>
          {feedReadError && <span className="feed-error">{feedReadError}</span>}
        </div>
        {!feedConfig || !feedAIHealth ? (
          <div className="feed-empty">Feed config data is not available yet.</div>
        ) : (
          <>
            <div className="feed-top-grid">
              <div className="feed-metric">
                <span>AI Enabled</span>
                <strong>{feedConfig.ai_enabled ? "Yes" : "No"}</strong>
              </div>
              <div className="feed-metric">
                <span>Timeout</span>
                <strong>{feedConfig.ai_timeout_ms}ms</strong>
              </div>
              <div className="feed-metric">
                <span>Budget / Spend</span>
                <strong>${feedAIHealth.ai_daily_budget_usd.toFixed(2)} / ${feedAIHealth.ai_spend_today_usd.toFixed(2)}</strong>
              </div>
              <div className="feed-metric">
                <span>Last Reset</span>
                <strong>{feedResetAt ?? "N/A"}</strong>
              </div>
            </div>
            <div className="feed-weights">
              <h4>Weights</h4>
              <div className="feed-weight-grid">
                <div><span>follow</span><strong>{feedConfig.weights.follow.toFixed(2)}</strong></div>
                <div><span>recency</span><strong>{feedConfig.weights.recency.toFixed(2)}</strong></div>
                <div><span>engagement</span><strong>{feedConfig.weights.engagement.toFixed(2)}</strong></div>
                <div><span>interest</span><strong>{feedConfig.weights.interest.toFixed(2)}</strong></div>
                <div><span>pin</span><strong>{feedConfig.weights.pin.toFixed(2)}</strong></div>
                <div><span>quality_penalty</span><strong>{feedConfig.weights.quality_penalty.toFixed(2)}</strong></div>
                <div><span>ai_adjustment_cap</span><strong>{feedConfig.weights.ai_adjustment_cap.toFixed(2)}</strong></div>
              </div>
            </div>
            <div className="feed-counters">
              <h4>AI Health Counters</h4>
              <div className="feed-counter-grid">
                <div><span>Requests</span><strong>{feedAIHealth.requests_count}</strong></div>
                <div><span>Timeouts</span><strong>{feedAIHealth.timeout_count}</strong></div>
                <div><span>Errors</span><strong>{feedAIHealth.error_count}</strong></div>
                <div><span>Fallbacks</span><strong>{feedAIHealth.fallback_count}</strong></div>
              </div>
            </div>
          </>
        )}
      </section>

      <InterestSuggestionBatchPanel />

      <style jsx>{`
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }
        .alert-banner {
          width: 100%;
          border: 1px solid rgba(240, 107, 107, 0.35);
          background: rgba(240, 107, 107, 0.11);
          color: #f4b2b2;
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .alert-banner:hover {
          background: rgba(240, 107, 107, 0.16);
          border-color: rgba(240, 107, 107, 0.48);
        }
        .banner-arrow {
          margin-left: auto;
          font-weight: 600;
          font-size: 13px;
        }
        .meta-note {
          margin-top: 14px;
          font-size: 12px;
          color: #7f8cab;
        }
        .ops-grid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .ops-card {
          border: 1px solid #2a3553;
          border-radius: 14px;
          background: linear-gradient(180deg, #121a2c, #101626);
          padding: 14px 16px;
          text-align: left;
          color: #e5ebfd;
        }
        .ops-card.cta {
          cursor: pointer;
          font-family: inherit;
          transition: border-color 0.15s, background 0.15s;
        }
        .ops-card.cta:hover {
          border-color: rgba(240, 131, 74, 0.42);
          background: linear-gradient(180deg, rgba(240, 131, 74, 0.13), rgba(240, 131, 74, 0.06));
        }
        .ops-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #8a96ba;
          font-weight: 600;
        }
        .ops-value {
          margin-top: 7px;
          font-family: var(--font-dm-serif), serif;
          font-size: 27px;
          line-height: 1;
        }
        .ops-sub {
          margin-top: 9px;
          font-size: 12px;
          color: #8b97b8;
        }
        .feed-panel {
          margin-top: 16px;
          border: 1px solid #293350;
          border-radius: 14px;
          background: linear-gradient(180deg, #10192b, #0d1423);
          padding: 14px 16px;
        }
        .feed-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .feed-panel-head h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #d9e3fb;
        }
        .feed-error {
          font-size: 11px;
          color: #f6b0b0;
        }
        .feed-empty {
          font-size: 12px;
          color: #8a96ba;
          padding: 8px 0 2px;
        }
        .feed-top-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }
        .feed-metric {
          border: 1px solid #2b3554;
          border-radius: 10px;
          padding: 10px;
          background: #131d31;
          display: grid;
          gap: 6px;
        }
        .feed-metric span {
          font-size: 11px;
          color: #8d9abf;
        }
        .feed-metric strong {
          font-size: 13px;
          color: #e4ecff;
        }
        .feed-weights h4,
        .feed-counters h4 {
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 700;
          color: #b3c0e3;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .feed-weight-grid,
        .feed-counter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .feed-weight-grid div,
        .feed-counter-grid div {
          border: 1px solid #29324d;
          border-radius: 9px;
          background: #111a2e;
          padding: 8px 9px;
          display: grid;
          gap: 5px;
        }
        .feed-weight-grid span,
        .feed-counter-grid span {
          font-size: 10px;
          color: #8794b7;
          text-transform: lowercase;
        }
        .feed-weight-grid strong,
        .feed-counter-grid strong {
          font-size: 12px;
          color: #dce6ff;
        }
        .feed-counters {
          margin-top: 12px;
        }
        @media (max-width: 1100px) {
          .stat-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .ops-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .feed-top-grid,
          .feed-weight-grid,
          .feed-counter-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .stat-grid {
            grid-template-columns: 1fr;
          }
          .ops-grid {
            grid-template-columns: 1fr;
          }
          .feed-top-grid,
          .feed-weight-grid,
          .feed-counter-grid {
            grid-template-columns: 1fr;
          }
          .feed-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}
