/** Shared pure helpers for full-screen workspace pages. */

export function relativeTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const mins = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const AVATAR_PAIRS: [string, string][] = [
  ["#7C73F0", "#9B8EF8"],
  ["#F0834A", "#F5C642"],
  ["#3DD68C", "#06B6D4"],
  ["#F06B6B", "#FB923C"],
];

export function avatarSeed(value: string): [string, string] {
  const hash = value.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PAIRS[hash % AVATAR_PAIRS.length]!;
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const alphaInitials = words
    .map(word => word[0] ?? "")
    .filter(ch => /[A-Za-z]/.test(ch))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (alphaInitials) return alphaInitials;

  const fallback = words
    .slice(0, 2)
    .map(word => word[0] ?? "")
    .join("")
    .toUpperCase();
  return fallback || "?";
}

export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
