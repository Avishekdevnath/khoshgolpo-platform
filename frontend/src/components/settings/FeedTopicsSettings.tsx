"use client";

import { CheckCircle2, RotateCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { useUserTopics } from "@/hooks/useUserTopics";

const SKELETON_WIDTHS = [96, 76, 112, 88, 104, 72, 94, 120, 84, 108];

export default function FeedTopicsSettings() {
  const {
    selectedTopics,
    topicsSelected,
    availableTopics,
    loading,
    saving,
    addTopic,
    removeTopic,
    resetTopics,
  } = useUserTopics();
  const [error, setError] = useState<string | null>(null);

  const hasTopics = selectedTopics.length > 0;
  const statusText = hasTopics
    ? `${selectedTopics.length} topic${selectedTopics.length === 1 ? "" : "s"} selected for My Feed.`
    : topicsSelected
    ? "My Feed is active, but no topics are saved right now."
    : "No topics selected yet. My Feed will show the topic picker in Threads.";

  async function handleToggle(topic: string) {
    if (saving) {
      return;
    }
    setError(null);
    try {
      if (selectedTopics.includes(topic)) {
        await removeTopic(topic);
      } else {
        await addTopic(topic);
      }
    } catch {
      setError("Failed to update your topics. Try again.");
    }
  }

  async function handleReset() {
    if (saving) {
      return;
    }
    setError(null);
    try {
      await resetTopics();
    } catch {
      setError("Failed to reset topic setup. Try again.");
    }
  }

  return (
    <div className="section">
      <h2 className="sec-title">Feed Topics</h2>
      <p className="sec-desc">
        Manage the topics that shape My Feed. If you skipped the topic picker before, you can set or reset it here any
        time.
      </p>

      <div className="status-card">
        <div className="status-copy">
          <div className="status-title">
            <Sparkles size={15} />
            My Feed setup
          </div>
          <p>{statusText}</p>
        </div>
        <div className={`status-pill${hasTopics ? " active" : ""}`}>
          {hasTopics ? <CheckCircle2 size={13} /> : null}
          {saving ? "Saving..." : hasTopics ? "Active" : "Needs topics"}
        </div>
      </div>

      {error && <div className="msg err">{error}</div>}

      {hasTopics && (
        <>
          <div className="block-head">
            <span className="block-title">Selected topics</span>
            <button type="button" className="reset-btn" onClick={() => void handleReset()} disabled={saving}>
              <RotateCcw size={13} />
              Reset topic setup
            </button>
          </div>
          <div className="selected-grid">
            {selectedTopics.map(topic => (
              <button
                key={topic}
                type="button"
                className="selected-chip"
                onClick={() => void handleToggle(topic)}
                disabled={saving}
                aria-label={`Remove ${topic}`}
              >
                {topic}
                <X size={11} />
              </button>
            ))}
          </div>
        </>
      )}

      {!hasTopics && (
        <div className="empty-note">
          Choose one or more topics below to personalize My Feed. Leaving this empty will keep the inline picker
          available on the Threads page.
        </div>
      )}

      <div className="block-head">
        <span className="block-title">Popular topics</span>
        <span className="block-meta">Changes save automatically</span>
      </div>

      <div className="topic-grid">
        {loading
          ? SKELETON_WIDTHS.map((width, index) => (
              <div key={index} className="chip-skeleton" style={{ width }} />
            ))
          : availableTopics.map(topic => {
              const selected = selectedTopics.includes(topic.name);
              return (
                <button
                  key={topic.name}
                  type="button"
                  className={`topic-chip${selected ? " selected" : ""}`}
                  onClick={() => void handleToggle(topic.name)}
                  disabled={saving}
                  aria-pressed={selected}
                >
                  <span>{topic.name}</span>
                  {topic.thread_count > 0 ? <span className="topic-count">{topic.thread_count}</span> : null}
                </button>
              );
            })}
      </div>

      {!loading && availableTopics.length === 0 && (
        <div className="empty-note">Popular topics are unavailable right now. You can try again later.</div>
      )}

      <p className="helper">
        Resetting topic setup clears saved feed topics and makes the topic picker appear again when you open My Feed in
        Threads.
      </p>

      <style jsx>{`
        .section {
          width: 100%;
        }
        .status-card {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid #1e2235;
          background: linear-gradient(180deg, rgba(16, 19, 29, 0.96), rgba(12, 15, 24, 0.96));
          margin-bottom: 18px;
        }
        .status-copy {
          min-width: 0;
        }
        .status-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #e4e8f4;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .status-copy p {
          margin: 0;
          color: #8891aa;
          font-size: 13px;
          line-height: 1.5;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid #2b3654;
          background: #151927;
          color: #8891aa;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .status-pill.active {
          border-color: rgba(61, 214, 140, 0.3);
          background: rgba(61, 214, 140, 0.1);
          color: #7fe0ad;
        }
        .block-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 20px 0 10px;
        }
        .block-title {
          color: #dbe0f0;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .block-meta {
          color: #636f8d;
          font-size: 11px;
        }
        .reset-btn {
          border: 1px solid #2b3654;
          background: #151927;
          color: #aab3cf;
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .reset-btn:hover:not(:disabled) {
          border-color: #f0834a;
          color: #f6c0a5;
        }
        .reset-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .selected-grid,
        .topic-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .selected-chip,
        .topic-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid #2b3654;
          transition: all 0.15s;
          font-family: inherit;
        }
        .selected-chip {
          padding: 7px 12px;
          background: rgba(240, 131, 74, 0.12);
          border-color: rgba(240, 131, 74, 0.4);
          color: #f0834a;
          cursor: pointer;
        }
        .selected-chip:hover:not(:disabled) {
          background: rgba(240, 131, 74, 0.18);
          color: #ffd3bd;
        }
        .topic-chip {
          padding: 8px 13px;
          background: #151927;
          color: #8891aa;
          cursor: pointer;
        }
        .topic-chip:hover:not(:disabled) {
          border-color: #f0834a;
          color: #e4e8f4;
        }
        .topic-chip.selected {
          background: rgba(240, 131, 74, 0.14);
          border-color: #f0834a;
          color: #f0834a;
        }
        .topic-chip:disabled,
        .selected-chip:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .topic-count {
          font-size: 11px;
          opacity: 0.65;
        }
        .chip-skeleton {
          height: 36px;
          border-radius: 999px;
          background: #1a1f30;
          animation: sk 1.4s ease infinite;
        }
        .empty-note {
          border: 1px solid #252b40;
          border-radius: 10px;
          background: #141a28;
          color: #9aa4c0;
          font-size: 13px;
          line-height: 1.5;
          padding: 12px 14px;
        }
        .helper {
          margin: 14px 0 0;
          color: #636f8d;
          font-size: 12px;
          line-height: 1.5;
        }
        .msg {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 8px;
          margin-top: 14px;
        }
        .msg.err {
          color: #f06b6b;
          background: rgba(240, 107, 107, 0.08);
          border: 1px solid rgba(240, 107, 107, 0.2);
        }
        @keyframes sk {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
