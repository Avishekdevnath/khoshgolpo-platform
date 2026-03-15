"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronUp, Home, LogOut, Mail, Menu, MessageSquare, Search, Settings, Shield, UserRound, X } from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { useChannels, type Channel } from "@/hooks/useChannels";
import { useNotifications } from "@/hooks/useNotifications";
import { useMessageUnreadCount } from "@/hooks/useMessages";
import { profilePathFromUsername } from "@/lib/profileRouting";
import { avatarSeed, initials } from "@/lib/workspaceUtils";

type WorkspaceSidebarProps = {
  channels?: Channel[];
  activeChannelSlug?: string;
  onChannelSelect?: (slug: string) => void;
  showAllChannelsOption?: boolean;
  hideChannels?: boolean;
  hideAdminNav?: boolean;
  extraSectionTitle?: string;
  extraSection?: ReactNode;
};

export default function WorkspaceSidebar({
  channels,
  activeChannelSlug,
  onChannelSelect,
  showAllChannelsOption = false,
  hideChannels = true,
  hideAdminNav = false,
  extraSectionTitle,
  extraSection,
}: WorkspaceSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { channels: allChannels } = useChannels();
  const { unreadCount } = useNotifications();
  const { unreadCount: messageUnreadCount } = useMessageUnreadCount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  const channelItems = channels ?? allChannels;
  const sidebarName = user?.display_name ?? user?.username ?? "Guest";
  const [av1, av2] = avatarSeed(user?.id ?? "guest");
  const profilePath = user ? profilePathFromUsername(user.username) : "/login";

  const navItems = [
    { label: "Home", href: "/", icon: Home, badge: null as string | null },
    { label: "People", href: "/people/explore", icon: Search, badge: null as string | null },
    { label: "Threads", href: "/threads", icon: MessageSquare, badge: null as string | null },
    { label: "Messages", href: "/messages", icon: Mail, badge: messageUnreadCount > 0 ? String(messageUnreadCount) : null },
    { label: "Notifications", href: "/notifications", icon: Bell, badge: unreadCount > 0 ? String(unreadCount) : null },
    ...(user?.role === "admin" && !hideAdminNav ? [{ label: "Admin", href: "/admin", icon: Shield, badge: null as string | null }] : []),
  ];

  function isActive(href: string) {
    if (href === "/people/explore") return pathname.startsWith("/people");
    if (href === "/threads") return pathname.startsWith("/threads");
    if (href === "/messages") return pathname.startsWith("/messages");
    if (href === "/notifications") return pathname.startsWith("/notifications");
    if (href === "/admin") return pathname.startsWith("/admin");
    if (user && href === profilePath) return pathname === href;
    return pathname === href;
  }

  function navigate(href: string) {
    setMobileOpen(false);
    router.push(href);
  }

  function handleChannelClick(slug: string) {
    setMobileOpen(false);
    if (onChannelSelect) {
      onChannelSelect(slug);
      return;
    }
    router.push("/threads");
  }

  const allChannelActive = activeChannelSlug === "all";

  return (
    <>
      <button
        className="mob-toggle"
        type="button"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        onClick={() => setMobileOpen(v => !v)}
      >
        {mobileOpen ? <X size={16} /> : <Menu size={16} />}
      </button>
      {mobileOpen && <button type="button" className="mob-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <button className="brand" type="button" onClick={() => navigate("/")}>
          <span className="brand-icon">K</span>
          <span className="brand-name">KhoshGolpo</span>
        </button>

        <div className="sec-label">Main</div>
        <div className="main-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={`nav-item ${isActive(item.href) ? "active" : ""}`}
                onClick={() => navigate(item.href)}
              >
                <Icon size={15} />
                <span>{item.label}</span>
                {item.badge && <span className="badge">{item.badge}</span>}
              </button>
            );
          })}
        </div>

        {extraSection && (
          <>
            <div className="sec-label" style={{ marginTop: 4 }}>{extraSectionTitle ?? "Sections"}</div>
            <div className={`extra-section kg-scroll kg-scroll--sm kg-scroll--subtle ${hideChannels ? "fill" : ""}`}>{extraSection}</div>
          </>
        )}

        {!hideChannels && (
          <>
            <div className="sec-label" style={{ marginTop: 4 }}>Channels</div>
            <div className="channels kg-scroll kg-scroll--sm kg-scroll--subtle">
              {showAllChannelsOption && onChannelSelect && (
                <button
                  type="button"
                  className={`channel ${allChannelActive ? "active" : ""}`}
                  onClick={() => handleChannelClick("all")}
                >
                  <span className="dot" style={{ background: "#6366f1" }} />
                  <span>#all channels</span>
                </button>
              )}
              {channelItems.map(ch => (
                <button
                  key={ch.slug}
                  type="button"
                  className={`channel ${activeChannelSlug === ch.slug ? "active" : ""}`}
                  onClick={() => handleChannelClick(ch.slug)}
                >
                  <span className="dot" style={{ background: ch.color }} />
                  <span>#{ch.name.toLowerCase()}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="sb-user-wrap" ref={userMenuRef}>
          {userMenuOpen && user && (
            <div className="user-menu">
              <button type="button" className="menu-item" onClick={() => { setUserMenuOpen(false); navigate(profilePath); }}>
                <UserRound size={14} /> Profile
              </button>
              <button type="button" className="menu-item" onClick={() => { setUserMenuOpen(false); navigate("/settings"); }}>
                <Settings size={14} /> Settings
              </button>
              <div className="menu-sep" />
              <button type="button" className="menu-item logout" onClick={async () => { setUserMenuOpen(false); await logout(); router.push("/login"); }}>
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
          <button type="button" className="sb-user" onClick={() => user && setUserMenuOpen(v => !v)}>
            <div className="sb-avatar" style={{ background: `linear-gradient(135deg,${av1},${av2})` }}>
              {initials(sidebarName)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="sb-name">{sidebarName}</div>
              <div className="sb-status">
                {user
                  ? <><span className="online-dot" />Online</>
                  : <Link href="/login" style={{ color: "#f0834a", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>}
              </div>
            </div>
            {user && <ChevronUp size={14} className="sb-chevron" style={{ color: "#545c7a", transform: userMenuOpen ? "rotate(0)" : "rotate(180deg)", transition: "transform 0.15s" }} />}
          </button>
        </div>
      </aside>

      <style jsx>{`
        .mob-toggle,
        .mob-backdrop {
          display: none;
        }

        .sidebar {
          border: 1px solid #1e2235;
          background: linear-gradient(180deg, #10131d 0%, #0f1118 100%);
          border-radius: 14px;
          box-shadow: 0 0 0 1px rgba(11, 16, 28, 0.65) inset;
          display: flex;
          flex-direction: column;
          padding: 12px;
          max-height: calc(100vh - 24px);
          position: sticky;
          top: 12px;
          overflow: hidden;
        }
        .brand {
          border: none;
          background: transparent;
          color: #e4e8f4;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 2px 2px 10px;
          cursor: pointer;
          text-align: left;
          margin-bottom: 8px;
          flex-shrink: 0;
        }
        .brand-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: #f0834a;
          display: grid;
          place-items: center;
          color: #fff;
          font-family: var(--font-dm-serif), serif;
          font-weight: 700;
          font-size: 16px;
          flex-shrink: 0;
        }
        .brand-name { font-family: var(--font-dm-serif), serif; font-size: 18px; }
        .sec-label {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #545c7a;
          padding: 0 8px;
          margin-bottom: 6px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .main-nav { display: grid; gap: 2px; margin-bottom: 12px; flex-shrink: 0; }
        .nav-item {
          border: 1px solid transparent;
          background: transparent;
          color: #9ba3be;
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .nav-item:hover { color: #d5dbee; background: #161a26; }
        .nav-item.active { color: #f0834a; border-color: rgba(240,131,74,0.25); background: rgba(240,131,74,0.12); }
        .badge {
          margin-left: auto;
          background: #f0834a;
          color: #fff;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          min-width: 18px;
          text-align: center;
        }
        .channels {
          flex: 1;
          overflow-y: auto;
          display: grid;
          gap: 2px;
          padding-right: 2px;
          min-height: 0;
          align-content: start;
        }
        .extra-section {
          display: grid;
          gap: 2px;
          margin-bottom: 12px;
          max-height: 42vh;
          overflow-y: auto;
          min-height: 0;
        }
        .extra-section.fill {
          flex: 1;
          max-height: none;
          margin-bottom: 0;
          align-content: start;
        }
        .extra-section :global(.extra-item) {
          border: 1px solid transparent;
          background: transparent;
          color: #9ba3be;
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          text-align: left;
        }
        .extra-section :global(.extra-item:hover) {
          color: #d5dbee;
          background: #161a26;
        }
        .extra-section :global(.extra-item.active) {
          color: #f0834a;
          border-color: rgba(240, 131, 74, 0.25);
          background: rgba(240, 131, 74, 0.12);
        }
        .extra-section :global(.extra-badge) {
          margin-left: auto;
          background: #1d2334;
          color: #9ba3be;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          min-width: 18px;
          text-align: center;
        }
        .extra-section :global(.extra-badge.warn) {
          color: #f7b3b3;
          background: rgba(240, 107, 107, 0.15);
        }
        .channel {
          border: 1px solid transparent;
          background: transparent;
          color: #69738f;
          border-radius: 7px;
          padding: 7px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .channel:hover { color: #b5bfd8; background: #151927; }
        .channel.active { color: #a5b4fc; border-color: rgba(99,102,241,0.28); background: rgba(99,102,241,0.12); }
        .dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; }
        .sb-user-wrap {
          position: relative;
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid #1e2235;
          flex-shrink: 0;
        }
        .sb-user {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          border: none;
          background: transparent;
          padding: 4px 4px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
          font-family: inherit;
          color: inherit;
          text-align: left;
        }
        .sb-user:hover { background: #161a26; }
        .user-menu {
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          margin-bottom: 6px;
          background: #151927;
          border: 1px solid #252b40;
          border-radius: 10px;
          padding: 4px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.45);
          z-index: 10;
          animation: menuSlide 0.12s ease;
        }
        @keyframes menuSlide {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .menu-item {
          width: 100%;
          border: none;
          background: transparent;
          color: #c5cbe0;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 7px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.12s;
          font-family: inherit;
        }
        .menu-item:hover { background: #1e2235; color: #e4e8f4; }
        .menu-item.logout { color: #f06b6b; }
        .menu-item.logout:hover { background: rgba(240,107,107,0.12); color: #f06b6b; }
        .menu-sep { height: 1px; background: #1e2235; margin: 2px 6px; }
        .sb-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }
        .sb-name {
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sb-status { font-size: 11px; color: #3dd68c; display: flex; align-items: center; }
        .online-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3dd68c;
          margin-right: 5px;
          flex-shrink: 0;
        }

        @media (max-width: 860px) {
          .mob-toggle {
            display: inline-flex;
            position: fixed;
            right: 12px;
            top: 12px;
            z-index: 30;
            width: 34px;
            height: 34px;
            border-radius: 9px;
            border: 1px solid #252b40;
            background: #10131d;
            color: #e4e8f4;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          .sidebar {
            position: fixed;
            left: 12px;
            top: 12px;
            bottom: 12px;
            width: min(280px, calc(100vw - 24px));
            transform: translateX(-120%);
            transition: transform 0.18s ease;
            z-index: 20;
            max-height: calc(100vh - 24px);
          }
          .sidebar.open { transform: translateX(0); }
          .mob-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            border: none;
            background: rgba(2, 4, 10, 0.58);
            z-index: 15;
          }
        }
      `}</style>
    </>
  );
}
