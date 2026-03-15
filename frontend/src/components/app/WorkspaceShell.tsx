"use client";

import type { ComponentProps, ReactNode } from "react";

import WorkspaceSidebar from "@/components/app/WorkspaceSidebar";
import { useDragResize } from "@/hooks/useDragResize";

type SidebarResizeConfig = {
  defaultWidth?: number;
  min?: number;
  max?: number;
};

type WorkspaceShellProps = {
  children: ReactNode;
  /** Extra elements rendered after the main panel (toasts, modals, etc.) */
  overlay?: ReactNode;
  /** Props forwarded to WorkspaceSidebar */
  sidebarProps?: ComponentProps<typeof WorkspaceSidebar>;
  /** Hide the decorative background orbs (default: false) */
  hideOrbs?: boolean;
  /** Grid columns rendered after the sidebar drag handle */
  contentColumns?: string;
  /** Wrap children in the shared panel card */
  wrapPanel?: boolean;
  /** Sidebar resize settings */
  sidebarResize?: SidebarResizeConfig;
};

export default function WorkspaceShell({
  children,
  overlay,
  sidebarProps,
  hideOrbs,
  contentColumns = "1fr",
  wrapPanel = true,
  sidebarResize,
}: WorkspaceShellProps) {
  const { defaultWidth = 224, min = 180, max = 320 } = sidebarResize ?? {};
  const { width: sidebarW, onDragStart } = useDragResize(defaultWidth, min, max);

  return (
    <div className="ws-root" style={{ gridTemplateColumns: `${sidebarW}px 6px ${contentColumns}` }}>
      {!hideOrbs && (
        <>
          <div className="ws-orb ws-orb-1" />
          <div className="ws-orb ws-orb-2" />
        </>
      )}

      <WorkspaceSidebar {...sidebarProps} />

      <div className="ws-drag" onMouseDown={onDragStart} />

      {wrapPanel ? <section className="ws-panel ws-shell-panel">{children}</section> : children}

      {overlay}

      <style jsx>{`
        .ws-root {
          height: 100vh;
          display: grid;
          grid-template-rows: 1fr;
          align-items: stretch;
          gap: 0;
          padding: 12px;
          background: #080a10;
          color: #e4e8f4;
          font-family: var(--font-dm-sans), sans-serif;
          position: relative;
          overflow: hidden;
        }
        .ws-orb {
          position: fixed;
          border-radius: 999px;
          filter: blur(110px);
          pointer-events: none;
          z-index: 0;
        }
        .ws-orb-1 {
          width: 460px; height: 460px;
          top: -160px; right: -120px;
          background: radial-gradient(circle, rgba(240,131,74,0.09), transparent 70%);
        }
        .ws-orb-2 {
          width: 500px; height: 500px;
          bottom: -220px; left: -150px;
          background: radial-gradient(circle, rgba(124,115,240,0.09), transparent 70%);
        }

        :global(.ws-drag) {
          width: 6px;
          cursor: col-resize;
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        :global(.ws-drag)::after {
          content: "";
          width: 3px; height: 32px;
          border-radius: 3px;
          background: #252b40;
          transition: background 0.15s, height 0.15s;
        }
        :global(.ws-drag:hover)::after {
          background: #7C73F0;
          height: 48px;
        }

        :global(.ws-panel) {
          z-index: 1;
          min-width: 0;
          border: 1px solid #1e2235;
          background: linear-gradient(180deg, #10131d 0%, #0f1118 100%);
          border-radius: 14px;
          box-shadow: 0 0 0 1px rgba(11,16,28,0.65) inset;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          max-height: calc(100vh - 24px);
          position: sticky;
          top: 12px;
        }

        .ws-shell-panel {
          min-height: 0;
        }

        :global(.ws-scroll) {
          min-height: 0;
          overflow-y: auto;
        }
        :global(.ws-scroll::-webkit-scrollbar) {
          width: 4px;
        }
        :global(.ws-scroll::-webkit-scrollbar-track) {
          background: transparent;
        }
        :global(.ws-scroll::-webkit-scrollbar-thumb) {
          background: #252b40;
          border-radius: 4px;
        }

        @media (max-width: 860px) {
          .ws-root { grid-template-columns: 1fr !important; }
          :global(.ws-drag) { display: none; }
          :global(.ws-panel) {
            max-height: none;
            position: static;
          }
          .ws-shell-panel {
            min-height: calc(100vh - 24px);
            margin-top: 50px;
          }
        }
      `}</style>
    </div>
  );
}
