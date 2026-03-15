import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api";

type UserSuggestion = { id?: string; username: string; display_name: string };

export function useMentionSuggest() {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [query, setQuery]             = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open whenever @ is active — component decides what to render
  const isOpen = query !== null;

  /** Call on every keystroke: pass current value + selectionStart. */
  const check = useCallback((text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const match  = before.match(/@([a-zA-Z0-9_.]*)$/);
    const q      = match ? match[1] : null;

    setQuery(q);
    setSelectedIdx(0);

    if (q !== null) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await apiGet<{ users: UserSuggestion[] }>(
            `users/search?q=${encodeURIComponent(q)}&limit=6`
          );
          setSuggestions(res.users);
        } catch {
          setSuggestions([]);
        }
      }, 150);
    } else {
      setSuggestions([]);
    }
  }, []);

  const close = useCallback(() => {
    setQuery(null);
    setSuggestions([]);
    setSelectedIdx(0);
  }, []);

  /**
   * Given current text, cursor position, and selected username,
   * returns the new text and cursor position after insertion.
   */
  const buildInsert = useCallback(
    (text: string, cursor: number, username: string) => {
      const before   = text.slice(0, cursor);
      const after    = text.slice(cursor);
      const replaced = before.replace(/@([a-zA-Z0-9_.]*)$/, `@${username} `);
      return { newText: replaced + after, newCursor: replaced.length };
    },
    []
  );

  /**
   * Keyboard handler. Pass your onSelect callback (receives selectedIdx).
   * Returns true if the event was consumed by the dropdown.
   */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, onSelect: (idx: number) => void): boolean => {
      if (!isOpen) return false;
      if (suggestions.length === 0) {
        if (e.key === "Escape") { close(); return true; }
        return false;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(selectedIdx);
        return true;
      }
      if (e.key === "Escape") {
        close();
        return true;
      }
      return false;
    },
    [isOpen, selectedIdx, suggestions.length, close]
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  return { isOpen, query, suggestions, selectedIdx, check, close, onKeyDown, buildInsert };
}
