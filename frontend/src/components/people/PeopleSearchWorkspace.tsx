"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";

import PeopleCard from "@/components/people/PeopleCard";
import PeopleWorkspaceShell from "@/components/people/PeopleWorkspaceShell";
import { usePeopleSearch } from "@/hooks/usePeople";
import type { PeopleRelationshipFilter, PeopleSearchSort } from "@/types/people";

const SEARCH_SORT_OPTIONS: Array<{ value: PeopleSearchSort; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "most_followed", label: "Most followed" },
  { value: "newest", label: "Newest" },
];

const RELATIONSHIP_OPTIONS: Array<{ value: PeopleRelationshipFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "not_following", label: "Not following" },
  { value: "can_connect", label: "Can connect" },
  { value: "connections", label: "Connections" },
];

function parseSearchSort(value: string | null): PeopleSearchSort {
  if (value === "most_followed" || value === "newest") return value;
  return "relevance";
}

function parseRelationship(value: string | null): PeopleRelationshipFilter {
  if (value === "not_following" || value === "can_connect" || value === "connections") return value;
  return "all";
}

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function StatePanel({
  title,
  text,
  actionLabel,
  actionHref,
}: {
  title: string;
  text: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="state-panel">
      <h2>{title}</h2>
      <p>{text}</p>
      {actionLabel && actionHref ? <Link href={actionHref}>{actionLabel}</Link> : null}

      <style jsx>{`
        .state-panel {
          display: grid;
          gap: 10px;
          border: 1px dashed rgba(68, 81, 120, 0.9);
          border-radius: 22px;
          background: rgba(10, 13, 22, 0.9);
          padding: 22px;
        }
        .state-panel h2 {
          margin: 0;
          color: #edf2ff;
          font-size: 24px;
        }
        .state-panel p {
          margin: 0;
          max-width: 680px;
          color: #91a0c6;
          font-size: 14px;
          line-height: 1.6;
        }
        .state-panel :global(a) {
          color: #ffc8a9;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }
        @media (max-width: 640px) {
          .state-panel {
            border-radius: 18px;
            padding: 18px;
          }
        }
      `}</style>
    </div>
  );
}

export default function PeopleSearchWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const sort = parseSearchSort(searchParams.get("sort"));
  const relationship = parseRelationship(searchParams.get("relationship"));
  const pageCount = parsePage(searchParams.get("page"));
  const [queryInput, setQueryInput] = useState(query);
  const { data, total, isLoading, isLoadingMore, error, hasMore, mutate } = usePeopleSearch({
    query,
    sort,
    relationship,
    pageCount,
  });

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  const updateParams = (mutateParams: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutateParams(params);
    const next = params.toString();
    router.replace(next ? `/people/search?${next}` : "/people/search", { scroll: false });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParams((params) => {
      const normalized = queryInput.trim();
      if (normalized) {
        params.set("q", normalized);
      } else {
        params.delete("q");
      }
      params.set("page", "1");
    });
  };

  const toolbar = (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-input-wrap">
        <Search size={16} />
        <input
          autoFocus
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Search by username, display name, or bio"
          aria-label="Search people"
        />
      </div>
      <button type="submit">Search</button>

      <style jsx>{`
        .search-form {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .search-input-wrap {
          flex: 1 1 280px;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #252b40;
          border-radius: 10px;
          padding: 0 12px;
          background: #151927;
          color: #93a2cb;
        }
        .search-input-wrap input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: #edf2ff;
          font-size: 14px;
          padding: 10px 0;
        }
        .search-input-wrap input::placeholder {
          color: #6f7da5;
        }
        .search-form button {
          border: 1px solid rgba(240, 131, 74, 0.3);
          background: linear-gradient(135deg, #f0834a, #f3ae53);
          color: #fff;
          border-radius: 10px;
          padding: 0 16px;
          font-size: 13px;
          font-weight: 700;
          min-height: 40px;
          cursor: pointer;
        }
        @media (max-width: 640px) {
          .search-form button {
            width: 100%;
          }
        }
      `}</style>
    </form>
  );

  const showPrompt = query.trim().length === 0;

  return (
    <PeopleWorkspaceShell
      title="Search people"
      subtitle="Look up members by username, display name, or bio, then follow, connect, or jump straight into messaging."
      toolbar={toolbar}
      bodyScrollable={false}
    >
      <div className="search-page">
        <section className="filters">
          <div className="group">
            <span className="group-label">Relationship</span>
            <div className="chips">
              {RELATIONSHIP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={relationship === option.value ? "active" : ""}
                  onClick={() => updateParams((params) => {
                    params.set("relationship", option.value);
                    params.set("page", "1");
                  })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="group">
            <span className="group-label">Sort</span>
            <div className="chips">
              {SEARCH_SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={sort === option.value ? "active" : ""}
                  onClick={() => updateParams((params) => {
                    params.set("sort", option.value);
                    params.set("page", "1");
                  })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="results-pane">
          {showPrompt ? (
            <StatePanel
              title="Start with a name or handle"
              text="Search by username, display name, or bio. If you want inspiration first, head back to Explore."
              actionLabel="Go to Explore"
              actionHref="/people/explore"
            />
          ) : isLoading ? (
            <div className="status">
              <LoaderCircle size={18} className="spin" />
              Searching people...
            </div>
          ) : error ? (
            <div className="status error">Failed to search people. Refresh and try again.</div>
          ) : (
            <>
              {data.length === 0 ? (
                <StatePanel
                  title="No people found"
                  text="Try a username, full name, or a phrase from someone's bio."
                />
              ) : (
                <section className="results">
                  <div className="results-head">
                    <div className="results-label">Results</div>
                    <h2>{total} people found</h2>
                  </div>
                  <div className="result-list">
                    {data.map((person) => (
                      <PeopleCard
                        key={person.id}
                        person={person}
                        onRelationshipChange={() => {
                          void mutate();
                        }}
                      />
                    ))}
                  </div>
                  {hasMore ? (
                    <button
                      type="button"
                      className="load-more"
                      onClick={() => updateParams((params) => {
                        params.set("page", String(pageCount + 1));
                      })}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={16} />}
                      {isLoadingMore ? "Loading more..." : `Load more results (${data.length}/${total})`}
                    </button>
                  ) : null}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .search-page {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .filters,
        .results {
          display: grid;
          gap: 10px;
        }
        .filters {
          border: 1px solid #1b2133;
          border-radius: 16px;
          background: #0d1120;
          padding: 14px 16px;
          flex-shrink: 0;
        }
        .results-pane {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          display: grid;
          gap: 16px;
          align-content: start;
          padding-right: 4px;
        }
        .results-pane::-webkit-scrollbar {
          width: 5px;
        }
        .results-pane::-webkit-scrollbar-track {
          background: transparent;
        }
        .results-pane::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 99px;
        }
        .results-pane::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .group {
          display: grid;
          gap: 8px;
        }
        .group-label,
        .results-label {
          color: #8fa0ca;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chips button,
        .load-more {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .chips button {
          border: 1px solid #1e2438;
          background: transparent;
          color: #4e5a78;
          padding: 5px 12px;
        }
        .chips button:hover { color: #8a96b5; border-color: #2a3250; }
        .chips button.active {
          border-color: rgba(124, 115, 240, 0.4);
          background: rgba(124, 115, 240, 0.1);
          color: #c9c1ff;
        }
        .results-head h2 {
          margin: 4px 0 0;
          color: #d0d8f0;
          font-size: 16px;
          font-weight: 700;
        }
        .result-list {
          display: grid;
          gap: 6px;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        }
        @media (max-width: 640px) {
          .result-list { grid-template-columns: 1fr; }
        }
        .status {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #93a2cb;
          font-size: 14px;
        }
        .status.error {
          color: #f4b0b0;
        }
        .load-more {
          width: 100%;
          border: 1px solid rgba(240, 131, 74, 0.26);
          background: rgba(240, 131, 74, 0.08);
          color: #ffc8a9;
          padding: 14px 18px;
        }
        .load-more:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }
        :global(.spin) {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 640px) {
          .filters {
            border-radius: 14px;
            padding: 12px 14px;
          }
        }
      `}</style>
    </PeopleWorkspaceShell>
  );
}
