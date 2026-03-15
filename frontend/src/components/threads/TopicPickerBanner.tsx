"use client";

import { useState } from "react";
import type { PopularTopic } from "@/types/feed";

type Props = {
  availableTopics: PopularTopic[];
  loading: boolean;
  saving: boolean;
  onSave: (topics: string[]) => void;
  onSkip: () => void;
};

const SKELETON_WIDTHS = [72, 96, 64, 88, 80, 104, 68, 92, 76, 100, 84, 60];

export default function TopicPickerBanner({ availableTopics, loading, saving, onSave, onSkip }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(name: string) {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name],
    );
  }

  return (
    <div className="banner">
      <div className="banner-inner">
        <p className="headline">Pick topics you care about</p>
        <p className="subline">Your feed will only show threads matching your interests</p>

        <div className="chips-grid">
          {loading
            ? SKELETON_WIDTHS.map((w, i) => (
                <div key={i} className="chip-skeleton" style={{ width: w }} />
              ))
            : availableTopics.map(topic => (
                <button
                  key={topic.name}
                  className={`chip ${selected.includes(topic.name) ? "chip-selected" : ""}`}
                  onClick={() => toggle(topic.name)}
                  type="button"
                >
                  {topic.name}
                  {topic.thread_count > 0 && (
                    <span className="chip-count">{topic.thread_count}</span>
                  )}
                </button>
              ))}
        </div>

        <div className="cta-row">
          <button
            className="cta-btn"
            disabled={selected.length === 0 || saving}
            onClick={() => onSave(selected)}
            type="button"
          >
            {saving ? "Saving…" : `Set My Feed →`}
          </button>
          <button className="skip-btn" onClick={onSkip} type="button">
            Skip for now
          </button>
        </div>
      </div>

      <style jsx>{`
        .banner {
          padding: 0 0 24px;
        }
        .banner-inner {
          background: #10131d;
          border: 1px solid #1e2235;
          border-radius: 14px;
          padding: 28px 24px 24px;
          margin: 0 0 2px;
        }
        .headline {
          font-size: 17px;
          font-weight: 700;
          color: #e4e8f4;
          margin: 0 0 6px;
          letter-spacing: -0.01em;
        }
        .subline {
          font-size: 13px;
          color: #8891aa;
          margin: 0 0 22px;
          line-height: 1.5;
        }
        .chips-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 24px;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid #2b3654;
          background: #151927;
          color: #8891aa;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .chip:hover {
          border-color: #f0834a;
          color: #e4e8f4;
        }
        .chip-selected {
          background: rgba(240, 131, 74, 0.15);
          border-color: #f0834a;
          color: #f0834a;
        }
        .chip-count {
          font-size: 11px;
          opacity: 0.6;
          font-weight: 400;
        }
        .chip-skeleton {
          height: 34px;
          border-radius: 999px;
          background: #1a1f30;
          animation: sk 1.4s ease infinite;
        }
        @keyframes sk {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        .cta-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .cta-btn {
          padding: 9px 22px;
          border-radius: 8px;
          background: #f0834a;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .cta-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .cta-btn:not(:disabled):hover {
          opacity: 0.88;
        }
        .skip-btn {
          background: none;
          border: none;
          color: #8891aa;
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color 0.15s;
        }
        .skip-btn:hover {
          color: #e4e8f4;
        }
      `}</style>
    </div>
  );
}
