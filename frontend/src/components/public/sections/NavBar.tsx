"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronDown, LayoutDashboard, LogOut, UserRound, Shield } from "lucide-react";

import { profilePathFromUsername } from "@/lib/profileRouting";
import { avatarSeed, initials } from "@/lib/workspaceUtils";
import { useAuthStore } from "@/store/authStore";
import ThemeToggle from "@/components/shared/ThemeToggle";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isActive = (route: string) => pathname?.startsWith(route);
  const profileName = user?.display_name ?? user?.username ?? "User";
  const profilePath = user ? profilePathFromUsername(user.username) : "/login";
  const [av1, av2] = avatarSeed(user?.id ?? "guest");
  const isLoggedIn = isAuthenticated() && !!user;
  const roleLabel = user?.role ? user.role[0]!.toUpperCase() + user.role.slice(1) : "Member";

  useEffect(() => {
    if (!menuOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    document.addEventListener("keydown", onEscape);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    await logout();
    router.push("/");
  };

  return (
    <>
    <nav id="nav" className="site-nav">
      <div className="container">
        <div className="nav-inner">
          <Link href="/" className="logo">
            <span className="logo-dot" />
            KhoshGolpo
          </Link>
          <div className="nav-links">
            <Link href="/threads" className={clsx("nav-link", { active: isActive("/threads") })}>
              Threads
            </Link>
            <Link href="/features" className={clsx("nav-link", { active: isActive("/features") })}>
              Features
            </Link>
            <Link href="/community" className={clsx("nav-link", { active: isActive("/community") })}>
              Community
            </Link>
            <ThemeToggle />
            {isLoggedIn ? (
              <>
                <Link href="/threads" className="btn btn-ghost btn-sm">
                  Open app
                </Link>
                <div className="nav-profile-wrap" ref={menuRef}>
                  <div className="nav-profile" title={profileName}>
                    <Link href={profilePath} className="nav-profile-link">
                      <span className="nav-avatar" style={{ background: `linear-gradient(135deg,${av1},${av2})` }}>
                        {initials(profileName)}
                      </span>
                      <span className="nav-profile-name">{profileName}</span>
                    </Link>
                    <button
                      type="button"
                      className="nav-profile-toggle"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen(prev => !prev)}
                    >
                      <ChevronDown size={14} className={`nav-caret ${menuOpen ? "open" : ""}`} />
                    </button>
                  </div>

                  <div className={`nav-menu ${menuOpen ? "open" : ""}`} role="menu" aria-hidden={!menuOpen}>
                    <div className="menu-head">
                      <span className="menu-head-avatar" style={{ background: `linear-gradient(135deg,${av1},${av2})` }}>
                        {initials(profileName)}
                      </span>
                      <div className="menu-head-meta">
                        <div className="menu-head-name">{profileName}</div>
                        <div className="menu-head-role">{roleLabel}</div>
                      </div>
                    </div>

                    <Link
                      href={profilePath}
                      className={clsx("menu-item", { active: pathname === profilePath })}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="menu-item-left">
                        <UserRound size={14} /> Profile
                      </span>
                    </Link>
                    <Link
                      href="/threads"
                      className={clsx("menu-item", { active: pathname?.startsWith("/threads") })}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="menu-item-left">
                        <LayoutDashboard size={14} /> Dashboard
                      </span>
                    </Link>
                    {isAdmin() && (
                      <Link
                        href="/admin/overview"
                        className={clsx("menu-item", { active: pathname?.startsWith("/admin") })}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className="menu-item-left">
                          <Shield size={14} /> Admin
                        </span>
                      </Link>
                    )}
                    <div className="menu-divider" />
                    <button type="button" className="menu-item danger" onClick={() => void handleSignOut()}>
                      <span className="menu-item-left">
                        <LogOut size={14} /> Sign out
                      </span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link href="/register" className="btn btn-primary btn-sm">
                  Join free
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
    <style jsx>{`
  .nav-profile-wrap {
    position: relative;
  }
  .nav-profile {
    display: flex;
    align-items: center;
    overflow: hidden;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    max-width: 240px;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
  .nav-profile:hover {
    background: var(--surface2);
    border-color: var(--accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }
  .nav-profile-link {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 6px 6px;
    color: var(--text);
    text-decoration: none;
    flex: 1;
    transition: color 0.2s ease;
  }
  .nav-profile-link:hover {
    color: var(--text);
  }
  .nav-profile-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    transition: all 0.2s ease;
    margin: -6px -6px -6px 0;
  }
  .nav-profile-toggle:hover {
    background: rgba(240, 131, 74, 0.08);
    color: var(--accent);
  }
  .nav-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }
  .nav-profile-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    transition: color 0.2s ease;
    display: none;
  }
  .nav-caret {
    color: var(--muted);
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .nav-caret.open {
    transform: rotate(180deg);
  }
  .nav-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 12px);
    width: 260px;
    border-radius: 12px;
    border: 1px solid rgba(214, 220, 232, 0.5);
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 12px 48px rgba(20, 25, 39, 0.18);
    padding: 10px;
    opacity: 0;
    transform: translateY(-12px) scale(0.97);
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    z-index: 120;
    backdrop-filter: blur(16px);
    display: flex;
    flex-direction: column;
  }
  .nav-menu::before {
    content: "";
    position: absolute;
    top: -5px;
    right: 18px;
    width: 10px;
    height: 10px;
    border-top: 1px solid rgba(214, 220, 232, 0.5);
    border-left: 1px solid rgba(214, 220, 232, 0.5);
    transform: rotate(45deg);
    background: rgba(255, 255, 255, 0.98);
  }
  .nav-menu.open {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }
  .menu-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 12px 14px;
    border-bottom: 1px solid rgba(214, 220, 232, 0.35);
    margin-bottom: 6px;
  }
  .menu-head-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.02em;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }
  .menu-head-meta {
    min-width: 0;
    flex: 1;
  }
  .menu-head-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .menu-head-role {
    margin-top: 2px;
    font-size: 12px;
    color: var(--muted);
    text-transform: capitalize;
  }
  .menu-divider {
    height: 1px;
    background: rgba(214, 220, 232, 0.4);
    margin: 8px 0;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: var(--text);
    background: transparent;
    border: none;
    border-radius: 8px;
    padding: 11px 12px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s ease;
    width: 100%;
    box-sizing: border-box;
  }
  .menu-item-left {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }
  .menu-item:hover {
    background: rgba(240, 131, 74, 0.12);
    color: var(--accent);
  }
  .menu-item.active {
    background: rgba(240, 131, 74, 0.15);
    color: var(--accent);
  }
  :global(.dark) .nav-menu {
    background: rgba(16, 19, 29, 0.98);
    border-color: rgba(100, 120, 160, 0.25);
  }
  :global(.dark) .nav-menu::before {
    background: rgba(16, 19, 29, 0.98);
    border-color: rgba(100, 120, 160, 0.25);
  }
  :global(.dark) .menu-head {
    border-bottom-color: rgba(100, 120, 160, 0.25);
  }
  :global(.dark) .menu-divider {
    background: rgba(100, 120, 160, 0.25);
  }
  :global(.dark) .menu-item {
    color: #c5d3e8;
  }
  :global(.dark) .menu-item:hover {
    background: rgba(240, 131, 74, 0.15);
    color: #ffb380;
  }
  :global(.dark) .menu-item.active {
    background: rgba(240, 131, 74, 0.2);
    color: #ffb380;
  }
  :global(.dark) .menu-item.danger {
    color: #ff9999;
  }
  :global(.dark) .menu-item.danger:hover {
    background: rgba(240, 131, 74, 0.15);
    color: #ffb3b3;
  }
  .menu-item:focus-visible {
    outline: 2px solid color-mix(in oklab, var(--accent) 58%, #ffffff 8%);
    outline-offset: -2px;
  }
  .menu-item.danger {
    color: #ff8888;
  }
  .menu-item.danger:hover {
    background: rgba(240, 107, 107, 0.15);
    color: #ffb3b3;
  }
  @media (max-width: 900px) {
    .nav-profile-name {
      display: none;
    }
    .nav-profile-link { padding-right: 4px; }
    .nav-menu {
      right: -8px;
    }
  }
    `}</style>
    </>
  );
}
