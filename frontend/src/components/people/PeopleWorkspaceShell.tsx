"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Search, UserCheck } from "lucide-react";

import WorkspaceShell from "@/components/app/WorkspaceShell";

const NAV_TABS = [
  { label: "Explore",  href: "/people/explore",  icon: Compass },
  { label: "Search",   href: "/people/search",   icon: Search },
  { label: "Requests", href: "/people/requests", icon: UserCheck },
] as const;

type PeopleWorkspaceShellProps = {
  title: string;
  subtitle: string;
  toolbar?: ReactNode;
  children: ReactNode;
  requestsBadge?: number;
  bodyScrollable?: boolean;
};

export default function PeopleWorkspaceShell({
  title,
  subtitle,
  toolbar,
  children,
  requestsBadge,
  bodyScrollable = true,
}: PeopleWorkspaceShellProps) {
  const pathname = usePathname();

  return (
    <>
      <WorkspaceShell wrapPanel={false}>
        <section className="ws-panel main-panel">

          {/* ── Static header ────────────────────────────── */}
          <header className="page-header">

            {/* Hero */}
            <div className="people-hero">
              <div className="people-hero-mesh" aria-hidden="true" />
              <div className="people-eyebrow">
                <span className="people-dot" aria-hidden="true" />
                Discover &amp; Connect
              </div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>

            {/* Search / toolbar */}
            {toolbar ? (
              <div className="search-section">
                <div className="search-slot">{toolbar}</div>
              </div>
            ) : null}
          </header>

          {/* ── Scrollable body ──────────────────────────── */}
          <div className={`body ${bodyScrollable ? "body-scroll" : "body-static"}`}>
            <div className="tab-nav" role="navigation" aria-label="People sections">
              {NAV_TABS.map(tab => {
                const isActive =
                  pathname === tab.href ||
                  (tab.href === "/people/explore" && pathname === "/people");
                const badge =
                  tab.label === "Requests" && requestsBadge ? requestsBadge : null;
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`tab-link${isActive ? " active" : ""}`}
                  >
                    <Icon size={13} />
                    {tab.label}
                    {badge ? <span className="req-badge">{badge}</span> : null}
                  </Link>
                );
              })}
            </div>
            {children}
          </div>

        </section>
      </WorkspaceShell>

      <style jsx>{`
        /* make panel a flex column so header is fixed-height and body scrolls */
        .main-panel {
          display: flex !important;
          flex-direction: column !important;
        }

        /* ── hero ──────────────────────────────────────── */
        .page-header {
          flex-shrink: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .people-hero {
          position: relative;
          overflow: hidden;
          padding: 36px 32px 28px;
          text-align: left;
        }

        .people-hero-mesh {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse 65% 90% at 75% 15%, rgba(249, 115, 22, 0.09) 0%, transparent 70%),
            radial-gradient(ellipse 45% 65% at 88% 85%, rgba(124, 58, 237, 0.07) 0%, transparent 60%);
        }

        .people-eyebrow {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(249, 115, 22, 0.1);
          border: 1px solid rgba(249, 115, 22, 0.2);
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 500;
          color: #fb923c;
          letter-spacing: 0.3px;
          margin-bottom: 14px;
        }
        .people-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          background: #f97316;
          border-radius: 50%;
        }

        .people-hero h1 {
          position: relative;
          margin: 0 0 8px;
          font-family: var(--font-dm-serif), serif;
          font-size: clamp(24px, 3vw, 36px);
          font-weight: 800;
          letter-spacing: -1px;
          line-height: 1.1;
          background: linear-gradient(100deg, #ffffff 25%, #c9bfff 58%, #f0a36f 88%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .people-hero p {
          position: relative;
          margin: 0;
          width: 100%;
          max-width: none;
          font-size: 13px;
          color: #7a87aa;
          line-height: 1.6;
          font-weight: 300;
        }

        /* ── search / toolbar ──────────────────────────── */
        .search-section {
          display: flex;
          justify-content: flex-start;
          padding: 0 32px 20px;
        }
        .search-slot {
          width: min(100%, 980px);
        }

        /* ── tabs ──────────────────────────────────────── */
        .tab-nav {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          flex-shrink: 0;
          gap: 8px;
          flex-wrap: wrap;
          row-gap: 10px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .tab-nav :global(a.tab-link) {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 500;
          color: #9aa8c8;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.03);
          background: rgba(255, 255, 255, 0.01);
          transition: all 0.15s;
          white-space: nowrap;
        }
        .tab-nav :global(a.tab-link svg) { flex-shrink: 0; opacity: 0.8; }
        .tab-nav :global(a.tab-link:hover) {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.08);
          color: #d6def3;
        }
        .tab-nav :global(a.tab-link.active) {
          background: rgba(249, 115, 22, 0.1);
          border-color: rgba(249, 115, 22, 0.2);
          color: #f97316;
        }

        .tab-nav :global(.req-badge) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          height: 16px;
          border-radius: 999px;
          padding: 0 4px;
          background: #f97316;
          color: #fff;
          font-size: 9px;
          font-weight: 700;
        }

        /* ── scrollable body ───────────────────────────── */
        .body {
          flex: 1;
          min-height: 0;
          padding: 22px 32px 48px;
        }
        .body-scroll {
          overflow-y: auto;
          overflow-x: hidden;
          display: grid;
          gap: 20px;
          align-content: start;
        }
        .body-static {
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* custom scrollbar for body */
        .body-scroll::-webkit-scrollbar { width: 5px; }
        .body-scroll::-webkit-scrollbar-track { background: transparent; }
        .body-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 99px;
        }
        .body-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        @media (max-width: 860px) {
          .people-hero { padding: 28px 20px 20px; }
          .search-section { padding: 0 20px 16px; }
          .body { padding: 18px 20px 40px; }
        }
        @media (max-width: 640px) {
          .people-hero h1 { font-size: 22px; }
          .people-hero p { font-size: 12px; }
          .people-hero-mesh { display: none; }
        }
      `}</style>
    </>
  );
}
