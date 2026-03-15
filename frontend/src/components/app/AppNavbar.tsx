"use client";

import Link from "next/link";
import { Bell, Mail, Plus } from "lucide-react";

import { useNotifications } from "@/hooks/useNotifications";
import { useMessageUnreadCount } from "@/hooks/useMessages";
import { useAuthStore } from "@/store/authStore";
import { profilePathFromUsername } from "@/lib/profileRouting";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AppNavbar() {
  const { user, isAuthenticated, isAdmin } = useAuthStore();
  const { unreadCount } = useNotifications();
  const { unreadCount: messageUnreadCount } = useMessageUnreadCount();
  const profileHref = user ? profilePathFromUsername(user.username) : "/login";

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-surface/90 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="logo text-lg">
            <span className="logo-dot" />
            KhoshGolpo
          </Link>
          <Badge
            variant="outline"
            className="hidden border-accent/40 bg-accent/10 text-accent md:inline-flex"
          >
            App Mode
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="icon-sm"
            variant="outline"
            className="relative border-border/80 bg-surface2 text-foreground hover:bg-surface"
          >
            <Link href="/messages" aria-label="Messages">
              <Mail className="h-4 w-4" />
              {messageUnreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                  {messageUnreadCount > 99 ? "99+" : messageUnreadCount}
                </span>
              ) : null}
            </Link>
          </Button>
          <Button
            asChild
            size="icon-sm"
            variant="outline"
            className="relative border-border/80 bg-surface2 text-foreground hover:bg-surface"
          >
            <Link href="/notifications" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/threads/new">
              <Plus className="h-4 w-4" />
              New Thread
            </Link>
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="border-border/80 bg-surface2 text-foreground hover:bg-surface"
              >
                Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href="/people/explore">People</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/threads">Threads</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/threads/new">Create Thread</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/notifications">Notifications</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/messages">Messages</Link>
              </DropdownMenuItem>
              {isAdmin() ? (
                <DropdownMenuItem asChild>
                  <Link href="/admin">Admin</Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link href={profileHref}>Profile</Link>
              </DropdownMenuItem>
              {!isAuthenticated() ? (
                <DropdownMenuItem asChild>
                  <Link href="/register">Register</Link>
                </DropdownMenuItem>
              ) : null}
              {!isAuthenticated() ? (
                <DropdownMenuItem asChild>
                  <Link href="/login">Login</Link>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
