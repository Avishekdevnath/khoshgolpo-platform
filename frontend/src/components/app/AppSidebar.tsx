"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useNotifications } from "@/hooks/useNotifications";
import { useMessageUnreadCount } from "@/hooks/useMessages";
import { useAuthStore } from "@/store/authStore";
import { profilePathFromUsername } from "@/lib/profileRouting";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppSidebar() {
  const pathname = usePathname();
  const { user, isAdmin } = useAuthStore();
  const { unreadCount } = useNotifications();
  const { unreadCount: messageUnreadCount } = useMessageUnreadCount();
  const profileHref = user ? profilePathFromUsername(user.username) : "/login";
  const items = [
    { href: "/people/explore", label: "People", badge: "Find" },
    { href: "/threads", label: "Threads", badge: "Live" },
    {
      href: "/messages",
      label: "Messages",
      badge: messageUnreadCount > 0 ? String(messageUnreadCount > 99 ? "99+" : messageUnreadCount) : "0",
    },
    { href: "/threads/new", label: "Create Thread", badge: "New" },
    {
      href: "/notifications",
      label: "Notifications",
      badge: unreadCount > 0 ? String(unreadCount > 99 ? "99+" : unreadCount) : "0",
    },
    { href: profileHref, label: "Profile", badge: user ? "Me" : "Guest" },
    ...(isAdmin() ? [{ href: "/admin", label: "Admin", badge: "Ops" }] : []),
  ];

  return (
    <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-surface/60 p-4 lg:block">
      <Card className="border-border/70 bg-surface2/70">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/people/explore" && pathname.startsWith("/people")) ||
              (item.href === "/threads" && pathname.startsWith("/threads/")) ||
              (item.href === "/messages" && pathname.startsWith("/messages")) ||
              (item.label === "Profile" && user && pathname === profileHref);

            return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                isActive
                  ? "border-accent/40 bg-accent/10 text-foreground"
                  : "border-border/40 bg-surface text-foreground hover:border-accent/40 hover:bg-surface2"
              }`}
            >
              <span>{item.label}</span>
              <Badge
                variant="outline"
                className={
                  isActive
                    ? "border-accent/40 bg-accent/15 text-accent"
                    : "border-border/70 bg-surface2 text-muted-foreground"
                }
              >
                {item.badge}
              </Badge>
            </Link>
            );
          })}
        </CardContent>
      </Card>
    </aside>
  );
}
