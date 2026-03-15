"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { PopularTopic } from "@/types/feed";

type Props = {
  selected: string[];
  available: PopularTopic[];
  onRemove: (topic: string) => void;
  onAdd: (topic: string) => void;
};

export default function TopicChipsBar({ selected, available, onRemove, onAdd }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const unselected = available.filter(t => !selected.includes(t.name));
  const filtered = search.trim()
    ? unselected.filter(t => t.name.includes(search.trim().toLowerCase()))
    : unselected;

  useEffect(() => {
    if (dropdownOpen) {
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [dropdownOpen]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [dropdownOpen]);

  function handleAdd(name: string) {
    onAdd(name);
    setDropdownOpen(false);
  }

  return (
    <div className="bar">
      <div className="chips-row">
        {selected.map(topic => (
          <span key={topic} className="chip">
            {topic}
            <button
              className="chip-remove"
              onClick={() => onRemove(topic)}
              type="button"
              aria-label={`Remove ${topic}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}

        <div className="add-wrapper" ref={dropdownRef}>
          <button
            className="chip chip-add"
            onClick={() => setDropdownOpen(o => !o)}
            type="button"
          >
            <Plus size={12} />
            Add topic
          </button>

          {dropdownOpen && (
            <div className="dropdown">
              <input
                ref={searchRef}
                className="dropdown-search"
                placeholder="Search topics…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Escape" && setDropdownOpen(false)}
              />
              <div className="dropdown-list">
                {filtered.length === 0 ? (
                  <p className="dropdown-empty">No topics found</p>
                ) : (
                  filtered.map(t => (
                    <button
                      key={t.name}
                      className="dropdown-item"
                      onClick={() => handleAdd(t.name)}
                      type="button"
                    >
                      {t.name}
                      <span className="dropdown-count">{t.thread_count}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .bar {
          padding: 0;
        }
        .chips-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(240, 131, 74, 0.35);
          background: rgba(240, 131, 74, 0.1);
          color: #f0834a;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }
        .chip-remove {
          background: none;
          border: none;
          color: #f0834a;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          opacity: 0.7;
          transition: opacity 0.15s;
        }
        .chip-remove:hover {
          opacity: 1;
        }
        .chip-add {
          background: #151927;
          border-color: #2b3654;
          color: #8891aa;
          cursor: pointer;
          transition: all 0.15s;
        }
        .chip-add:hover {
          border-color: #f0834a;
          color: #e4e8f4;
        }
        .add-wrapper {
          position: relative;
        }
        .dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 50;
          background: #10131d;
          border: 1px solid #2b3654;
          border-radius: 10px;
          width: 220px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }
        .dropdown-search {
          width: 100%;
          padding: 10px 12px;
          background: #151927;
          border: none;
          border-bottom: 1px solid #1e2235;
          color: #e4e8f4;
          font-size: 13px;
          outline: none;
          box-sizing: border-box;
        }
        .dropdown-search::placeholder {
          color: #5a6280;
        }
        .dropdown-list {
          max-height: 220px;
          overflow-y: auto;
          padding: 4px 0;
        }
        .dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 12px;
          background: none;
          border: none;
          color: #b8c0d8;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s;
        }
        .dropdown-item:hover {
          background: #1e2235;
          color: #e4e8f4;
        }
        .dropdown-count {
          font-size: 11px;
          color: #5a6280;
        }
        .dropdown-empty {
          padding: 12px;
          color: #5a6280;
          font-size: 13px;
          margin: 0;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
