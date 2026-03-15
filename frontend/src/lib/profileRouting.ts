export const RESERVED_PROFILE_SLUGS = new Set([
  "admin",
  "threads",
  "notifications",
  "messages",
  "people",
  "profile",
  "users",
  "settings",
  "login",
  "register",
  "auth",
  "community",
  "features",
  "api",
  "about",
  "privacy",
  "terms",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "static",
  "assets",
  "_next",
]);

export type ProfileRouteUser = {
  id: string;
  username: string;
  profile_slug?: string | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export function normalizeProfileIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

export function isReservedProfileSlug(value: string): boolean {
  return RESERVED_PROFILE_SLUGS.has(normalizeProfileIdentifier(value));
}

export function toProfilePath(identifier: string): string {
  return `/${encodeURIComponent(identifier.trim())}`;
}

export function profilePathFromUsername(username: string): string {
  const normalized = normalizeProfileIdentifier(username);
  if (isReservedProfileSlug(normalized)) {
    return `/users/${encodeURIComponent(normalized)}`;
  }
  return `/${encodeURIComponent(normalized)}`;
}

export function profilePathFromSlug(slug: string): string {
  const normalized = normalizeProfileIdentifier(slug);
  if (isReservedProfileSlug(normalized)) {
    return `/users/${encodeURIComponent(normalized)}`;
  }
  return `/${encodeURIComponent(normalized)}`;
}

export function canonicalProfilePath(user: ProfileRouteUser): string {
  // Prefer profile_slug (changeable URL); fall back to username (permanent)
  const identifier = user.profile_slug ?? user.username;
  return profilePathFromSlug(identifier);
}

export async function resolveProfileUser(identifier: string): Promise<ProfileRouteUser | null> {
  const cleaned = identifier.trim();
  if (!cleaned) return null;

  const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(cleaned)}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load profile");
  }

  const payload = (await response.json()) as ProfileRouteUser;
  return payload;
}
