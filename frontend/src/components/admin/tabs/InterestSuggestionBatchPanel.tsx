"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { apiGet } from "@/lib/api";
import {
  createAdminFeedInterestSuggestionJob,
  getAdminFeedInterestSuggestionJob,
  listAdminFeedInterestSuggestionJobs,
} from "@/lib/adminFeedApi";
import type {
  FeedInterestSuggestionJobResponse,
  FeedInterestSuggestionJobSummary,
  FeedInterestSuggestionReplaceMode,
  UserSearchItem,
} from "@/types/feed";

type SelectedUser = {
  id: string;
  username: string;
  display_name: string;
};

export default function InterestSuggestionBatchPanel() {
  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);

  const [replaceMode, setReplaceMode] = useState<FeedInterestSuggestionReplaceMode>("merge");
  const [maxTagsPerUser, setMaxTagsPerUser] = useState(8);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeJob, setActiveJob] = useState<FeedInterestSuggestionJobResponse | null>(null);
  const [recentJobs, setRecentJobs] = useState<FeedInterestSuggestionJobSummary[]>([]);

  const selectedIds = useMemo(() => new Set(selectedUsers.map(item => item.id)), [selectedUsers]);

  useEffect(() => {
    let cancelled = false;
    void listAdminFeedInterestSuggestionJobs({ limit: 8 })
      .then(res => {
        if (!cancelled) {
          setRecentJobs(res.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiGet<{ users: UserSearchItem[] }>(
          `users/search?q=${encodeURIComponent(search.trim())}&limit=8`,
        );
        if (!cancelled) {
          setSearchResults(res.users);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status !== "queued" && activeJob.status !== "running") return;

    let cancelled = false;
    const interval = setInterval(() => {
      void getAdminFeedInterestSuggestionJob(activeJob.job_id)
        .then(job => {
          if (!cancelled) {
            setActiveJob(job);
          }
        })
        .catch(() => {});
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeJob]);

  function addSelectedUser(user: UserSearchItem) {
    if (selectedIds.has(user.id)) return;
    setSelectedUsers(prev => [...prev, {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
    }]);
    setSearch("");
    setSearchResults([]);
  }

  function removeSelectedUser(userId: string) {
    setSelectedUsers(prev => prev.filter(user => user.id !== userId));
  }

  async function triggerBatch() {
    if (selectedUsers.length === 0) {
      setError("Select at least one user.");
      return;
    }
    if (selectedUsers.length > 20) {
      setError("Select up to 20 users in this UI.");
      return;
    }

    setTriggering(true);
    setError(null);
    try {
      const created = await createAdminFeedInterestSuggestionJob({
        user_ids: selectedUsers.map(item => item.id),
        replace_mode: replaceMode,
        max_tags_per_user: maxTagsPerUser,
      });
      const job = await getAdminFeedInterestSuggestionJob(created.job_id);
      setActiveJob(job);
      const jobs = await listAdminFeedInterestSuggestionJobs({ limit: 8 });
      setRecentJobs(jobs.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start suggestion batch.");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <section className="batch-panel">
      <div className="head">
        <h3>Interest Suggestion Batch</h3>
        <span>Explicit users only</span>
      </div>

      <div className="input-group">
        <label>User Picker</label>
        <div className="search-row">
          <Search size={13} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users by username/display name"
          />
        </div>
        {(searchLoading || searchResults.length > 0) && (
          <div className="search-list">
            {searchLoading && <div className="search-empty">Searching...</div>}
            {!searchLoading && searchResults.map(user => (
              <button
                key={user.id}
                type="button"
                className="search-item"
                onClick={() => addSelectedUser(user)}
                disabled={selectedIds.has(user.id)}
              >
                <span>{user.display_name}</span>
                <small>@{user.username}</small>
              </button>
            ))}
            {!searchLoading && searchResults.length === 0 && <div className="search-empty">No user found.</div>}
          </div>
        )}
        {selectedUsers.length > 0 && (
          <div className="selected-list">
            {selectedUsers.map(user => (
              <button key={user.id} type="button" className="selected-chip" onClick={() => removeSelectedUser(user.id)}>
                {user.display_name} <small>@{user.username}</small> <X size={11} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="controls">
        <div className="control">
          <label>Replace Mode</label>
          <select value={replaceMode} onChange={e => setReplaceMode(e.target.value as FeedInterestSuggestionReplaceMode)}>
            <option value="merge">merge</option>
            <option value="replace">replace</option>
          </select>
        </div>
        <div className="control">
          <label>Max Tags / User</label>
          <input
            type="number"
            value={maxTagsPerUser}
            min={1}
            max={15}
            onChange={e => setMaxTagsPerUser(Math.min(15, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="actions">
        <button type="button" onClick={() => void triggerBatch()} disabled={triggering || selectedUsers.length === 0}>
          {triggering ? "Triggering..." : "Trigger Batch"}
        </button>
      </div>

      {activeJob && (
        <div className="job-panel">
          <div className="job-head">
            <strong>Current Job</strong>
            <span className={`status status-${activeJob.status}`}>{activeJob.status}</span>
          </div>
          <div className="metrics">
            <span>requested: {activeJob.requested_count}</span>
            <span>processed: {activeJob.processed_count}</span>
            <span>success: {activeJob.success_count}</span>
            <span>failed: {activeJob.failed_count}</span>
          </div>
          <div className="results">
            {activeJob.results.map(result => (
              <div key={`${activeJob.job_id}-${result.user_id}`} className="result-row">
                <div>
                  <span className="mono">{result.user_id}</span>
                  <span className={`status status-${result.status}`}>{result.status}</span>
                </div>
                <div className="tags">
                  {result.applied_tags.slice(0, 8).map(tag => <span key={`${result.user_id}-${tag}`}>#{tag}</span>)}
                </div>
                {result.error && <small>{result.error}</small>}
              </div>
            ))}
          </div>
        </div>
      )}

      {recentJobs.length > 0 && (
        <div className="recent">
          <h4>Recent Jobs</h4>
          <div className="recent-list">
            {recentJobs.map(job => (
              <button
                key={job.job_id}
                type="button"
                className="recent-item"
                onClick={() => void getAdminFeedInterestSuggestionJob(job.job_id).then(setActiveJob).catch(() => {})}
              >
                <span className="mono">{job.job_id.slice(-8)}</span>
                <span className={`status status-${job.status}`}>{job.status}</span>
                <span>{job.processed_count}/{job.requested_count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .batch-panel {
          margin-top: 14px;
          border: 1px solid #293350;
          border-radius: 14px;
          background: linear-gradient(180deg, #0f1728, #0d1422);
          padding: 14px;
          display: grid;
          gap: 12px;
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
        }
        .head h3 {
          margin: 0;
          font-size: 14px;
          color: #dce6ff;
        }
        .head span {
          font-size: 11px;
          color: #8ea0c8;
        }
        .input-group,
        .control {
          display: grid;
          gap: 6px;
        }
        label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #8ea0c8;
          font-weight: 700;
        }
        .search-row {
          display: flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #2d3856;
          border-radius: 8px;
          padding: 0 9px;
          background: #121b2e;
          color: #90a3cc;
        }
        .search-row input,
        select,
        input[type="number"] {
          width: 100%;
          border: 1px solid #2d3856;
          background: #121b2e;
          color: #e5edff;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
        }
        .search-row input {
          border: none;
          background: transparent;
          padding-left: 0;
        }
        .search-row input:focus {
          outline: none;
        }
        .search-list {
          border: 1px solid #2d3856;
          border-radius: 8px;
          overflow: hidden;
          background: #111a2d;
        }
        .search-item {
          width: 100%;
          border: none;
          border-bottom: 1px solid #26314d;
          background: transparent;
          color: #dce6ff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 10px;
          cursor: pointer;
          text-align: left;
        }
        .search-item:last-child {
          border-bottom: none;
        }
        .search-item:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .search-item small {
          color: #8ea0c8;
        }
        .search-empty {
          padding: 10px;
          color: #90a3cc;
          font-size: 12px;
        }
        .selected-list {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .selected-chip {
          border: 1px solid #314063;
          background: #17233b;
          color: #dbe6ff;
          border-radius: 999px;
          padding: 4px 8px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          font-size: 12px;
        }
        .selected-chip small {
          color: #97a8cf;
          font-size: 11px;
        }
        .controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .actions button {
          border: none;
          border-radius: 9px;
          background: #f0834a;
          color: #fff;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .error {
          border: 1px solid rgba(240, 107, 107, 0.35);
          background: rgba(240, 107, 107, 0.12);
          color: #f6b5b5;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
        }
        .job-panel,
        .recent {
          border: 1px solid #2a3655;
          border-radius: 10px;
          background: #111a2d;
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .job-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          color: #9cb0da;
          font-size: 12px;
        }
        .results {
          display: grid;
          gap: 7px;
          max-height: 220px;
          overflow-y: auto;
        }
        .result-row {
          border: 1px solid #293652;
          border-radius: 8px;
          padding: 7px;
          display: grid;
          gap: 6px;
          font-size: 12px;
        }
        .result-row > div:first-child {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
        }
        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .tags span {
          border: 1px solid #324167;
          border-radius: 999px;
          padding: 2px 7px;
          color: #dbe6ff;
          background: #16233a;
        }
        .result-row small {
          color: #f2b4b4;
        }
        .status {
          border: 1px solid #324167;
          border-radius: 999px;
          padding: 2px 7px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #bdcaea;
        }
        .status-success {
          color: #8de3bc;
          border-color: rgba(141, 227, 188, 0.4);
        }
        .status-fallback,
        .status-budget_exceeded,
        .status-completed_with_errors {
          color: #f2d18b;
          border-color: rgba(242, 209, 139, 0.38);
        }
        .status-failed {
          color: #f4b1b1;
          border-color: rgba(244, 177, 177, 0.38);
        }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          color: #9fb0d9;
        }
        .recent h4 {
          margin: 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #9eb0d8;
        }
        .recent-list {
          display: grid;
          gap: 6px;
        }
        .recent-item {
          border: 1px solid #2e3d5f;
          border-radius: 8px;
          background: #152038;
          color: #dbe6ff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 7px 8px;
          cursor: pointer;
        }
        @media (max-width: 720px) {
          .controls {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
