"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";

import PageLoader from "@/components/shared/PageLoader";
import PeopleCard from "@/components/people/PeopleCard";
import PeopleWorkspaceShell from "@/components/people/PeopleWorkspaceShell";
import { usePeopleExplore } from "@/hooks/usePeople";
import type { PeopleExploreSection, PeopleExploreSort } from "@/types/people";

const SORT_OPTIONS: Array<{ value: PeopleExploreSort; label: string }> = [
  { value: "social", label: "For you" },
  { value: "most_followed", label: "Most followed" },
  { value: "newest", label: "Newest" },
];

type SectionBlockProps = {
  title: string;
  subtitle: string;
  items: PeopleExploreSection["data"];
  onRelationshipChange: () => void | Promise<void>;
};

function SectionBlock({ title, subtitle, items, onRelationshipChange }: SectionBlockProps) {
  if (items.length === 0) return null;
  return (
    <section className="section-block">
      <div className="section-head">
        <div className="section-title">{title}</div>
        <div className="section-sub">{subtitle}</div>
      </div>
      <div className="section-list">
        {items.map((person) => (
          <PeopleCard key={person.id} person={person} onRelationshipChange={onRelationshipChange} />
        ))}
      </div>

      <style jsx>{`
        .section-block { display: grid; gap: 10px; }
        .section-head { display: grid; gap: 3px; }
        .section-title {
          color: #d0d8f0;
          font-size: 15px;
          font-weight: 700;
        }
        .section-sub {
          color: #4e5a78;
          font-size: 12px;
        }
        .section-list {
          display: grid;
          gap: 6px;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        }
        @media (max-width: 640px) {
          .section-list { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}

export default function PeopleExploreWorkspace() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || (isLoading && ranked.length === 0 && sections.length === 0)) {
    return <PageLoader />;
  }
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PeopleExploreSort>("social");
  const [pageCount, setPageCount] = useState(1);
  const { sections, ranked, total, isLoading, isLoadingMore, error, hasMore, mutate } = usePeopleExplore({
    sort,
    pageCount,
  });

  const sectionMap = useMemo(() => {
    return sections.reduce<Record<string, PeopleExploreSection>>((acc, section) => {
      acc[section.key] = section;
      return acc;
    }, {});
  }, [sections]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) {
      router.push("/people/search");
      return;
    }
    router.push(`/people/search?q=${encodeURIComponent(normalized)}`);
  };

  const toolbar = (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-input-wrap">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by username, name, or bio"
          aria-label="Search people"
        />
      </div>
      <button type="submit">Search</button>

      <style jsx>{`
        .search-form {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .search-input-wrap {
          flex: 1 1 260px;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #1e2438;
          border-radius: 9px;
          padding: 0 12px;
          background: #0d1120;
          color: #4e5a78;
          transition: border-color 0.15s;
        }
        .search-input-wrap:focus-within {
          border-color: rgba(240, 131, 74, 0.4);
        }
        .search-input-wrap input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: #dde4f5;
          font-size: 13.5px;
          padding: 9px 0;
        }
        .search-input-wrap input::placeholder { color: #3d4561; }
        .search-form button {
          border: none;
          background: linear-gradient(135deg, #f0834a, #f3ae53);
          color: #fff;
          border-radius: 9px;
          padding: 0 18px;
          font-size: 13px;
          font-weight: 700;
          min-height: 38px;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .search-form button:hover { opacity: 0.9; }
        @media (max-width: 640px) {
          .search-form button { width: 100%; }
        }
      `}</style>
    </form>
  );

  const hasSections =
    (sectionMap.suggested?.data.length ?? 0) > 0 ||
    (sectionMap.popular?.data.length ?? 0) > 0 ||
    (sectionMap.new?.data.length ?? 0) > 0;

  return (
    <PeopleWorkspaceShell
      title="Find your people"
      subtitle="Discover who to follow, who to connect with, and who is already moving through your side of KhoshGolpo."
      toolbar={toolbar}
    >
      {hasSections && (
        <div className="sections-wrap">
          <SectionBlock
            title="Suggested for you"
            subtitle="Personalized from your interests and network."
            items={sectionMap.suggested?.data ?? []}
            onRelationshipChange={() => { void mutate(); }}
          />
          <SectionBlock
            title="Popular on KhoshGolpo"
            subtitle="Members with strong reach across the app."
            items={sectionMap.popular?.data ?? []}
            onRelationshipChange={() => { void mutate(); }}
          />
          <SectionBlock
            title="New arrivals"
            subtitle="Fresh profiles worth checking early."
            items={sectionMap.new?.data ?? []}
            onRelationshipChange={() => { void mutate(); }}
          />
        </div>
      )}

      {(!mounted || isLoading || ranked.length > 0 || error) && (
        <section className="ranked">
          <div className="ranked-head">
            <div className="ranked-title">Browse everyone</div>
            <div className="sort-chips">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={sort === option.value ? "active" : ""}
                  onClick={() => { setSort(option.value); setPageCount(1); }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {(!mounted || isLoading) ? (
            <div className="status">
              <LoaderCircle size={16} className="spin" />
              Loading…
            </div>
          ) : error ? (
            <div className="status error">Failed to load. Refresh and try again.</div>
          ) : (
            <>
              <div className="ranked-list">
                {ranked.map((person) => (
                  <PeopleCard
                    key={person.id}
                    person={person}
                    onRelationshipChange={() => { void mutate(); }}
                  />
                ))}
              </div>
              {hasMore && (
                <button
                  type="button"
                  className="load-more"
                  onClick={() => setPageCount((c) => c + 1)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? <LoaderCircle size={14} className="spin" /> : <ArrowRight size={14} />}
                  {isLoadingMore ? "Loading…" : `Show more (${ranked.length} / ${total})`}
                </button>
              )}
            </>
          )}
        </section>
      )}

      <style jsx>{`
        .sections-wrap {
          display: grid;
          gap: 20px;
        }
        .ranked {
          display: grid;
          gap: 10px;
        }
        .ranked-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding-bottom: 4px;
          border-bottom: 1px solid #161c2e;
        }
        .ranked-title {
          color: #d0d8f0;
          font-size: 15px;
          font-weight: 700;
        }
        .sort-chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .sort-chips button {
          border: 1px solid #1e2438;
          background: transparent;
          color: #4e5a78;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .sort-chips button:hover { color: #8a96b5; border-color: #2a3250; }
        .sort-chips button.active {
          border-color: rgba(124, 115, 240, 0.4);
          background: rgba(124, 115, 240, 0.1);
          color: #c9c1ff;
        }
        .ranked-list {
          display: grid;
          gap: 6px;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        }
        .load-more {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          border: 1px dashed rgba(240, 131, 74, 0.22);
          background: transparent;
          color: #8a6a54;
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .load-more:hover:not(:disabled) {
          color: #ffc8a9;
          border-color: rgba(240, 131, 74, 0.4);
        }
        .load-more:disabled { cursor: not-allowed; opacity: 0.5; }
        .status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #4e5a78;
          font-size: 13px;
        }
        .status.error { color: #c47474; }
        :global(.spin) { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .ranked-list { grid-template-columns: 1fr; }
        }
      `}</style>
    </PeopleWorkspaceShell>
  );
}
