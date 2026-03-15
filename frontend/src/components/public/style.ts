import type { CSSProperties } from "react";

export function inlineStyle(styleText: string): CSSProperties {
  const result: Record<string, string> = {};
  for (const part of styleText.split(";")) {
    const [rawKey, rawValue] = part.split(":");
    if (!rawKey || !rawValue) {
      continue;
    }
    const key = rawKey.trim();
    const value = rawValue.trim();
    if (!key || !value) {
      continue;
    }
    const camelKey = key.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase(),
    );
    result[camelKey] = value;
  }
  return result;
}
