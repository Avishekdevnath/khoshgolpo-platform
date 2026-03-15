"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getFeedPreferences, getPopularTopics, setUserTopics, updateFeedPreferences } from "@/lib/feedApi";
import type { FeedPreferences, PopularTopic } from "@/types/feed";

const EMPTY_PREFERENCES: FeedPreferences = {
  interest_tags: [],
  hidden_tags: [],
  muted_user_ids: [],
  topics_selected: false,
};

function normalizeTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const rawTopic of topics) {
    const topic = rawTopic.trim().toLowerCase();
    if (!topic || seen.has(topic)) {
      continue;
    }
    seen.add(topic);
    normalized.push(topic);
  }
  return normalized.slice(0, 30);
}

export function useUserTopics() {
  const [preferences, setPreferences] = useState<FeedPreferences | null>(null);
  const [availableTopics, setAvailableTopics] = useState<PopularTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const preferencesRef = useRef<FeedPreferences | null>(null);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getFeedPreferences(), getPopularTopics(40)])
      .then(([prefs, popular]) => {
        if (cancelled) return;
        setPreferences(prefs);
        setAvailableTopics(popular.topics);
      })
      .catch(() => {
        if (cancelled) return;
        setPreferences(EMPTY_PREFERENCES);
        setAvailableTopics([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const persistTopics = useCallback(async (topics: string[]): Promise<FeedPreferences> => {
    const normalized = normalizeTopics(topics);
    if (normalized.length === 0) {
      return updateFeedPreferences({ interest_tags: [] });
    }
    return setUserTopics(normalized);
  }, []);

  const saveTopics = useCallback(async (topics: string[]) => {
    setSaving(true);
    try {
      const next = await persistTopics(topics);
      setPreferences(next);
      return next;
    } finally {
      setSaving(false);
    }
  }, [persistTopics]);

  const addTopic = useCallback(async (topic: string) => {
    const previous = preferencesRef.current ?? EMPTY_PREFERENCES;
    const nextTopics = normalizeTopics([...previous.interest_tags, topic]);
    if (nextTopics.length === previous.interest_tags.length) {
      return;
    }

    const optimistic: FeedPreferences = {
      ...previous,
      interest_tags: nextTopics,
      topics_selected: true,
    };
    setPreferences(optimistic);
    preferencesRef.current = optimistic;
    setSaving(true);
    try {
      const next = await persistTopics(nextTopics);
      setPreferences(next);
      preferencesRef.current = next;
    } catch (error) {
      setPreferences(previous);
      preferencesRef.current = previous;
      throw error;
    } finally {
      setSaving(false);
    }
  }, [persistTopics]);

  const removeTopic = useCallback(async (topic: string) => {
    const previous = preferencesRef.current ?? EMPTY_PREFERENCES;
    const nextTopics = previous.interest_tags.filter(t => t !== topic);
    if (nextTopics.length === previous.interest_tags.length) {
      return;
    }

    const optimistic: FeedPreferences = {
      ...previous,
      interest_tags: nextTopics,
      topics_selected: nextTopics.length > 0,
    };
    setPreferences(optimistic);
    preferencesRef.current = optimistic;
    setSaving(true);
    try {
      const next = await persistTopics(nextTopics);
      setPreferences(next);
      preferencesRef.current = next;
    } catch (error) {
      setPreferences(previous);
      preferencesRef.current = previous;
      throw error;
    } finally {
      setSaving(false);
    }
  }, [persistTopics]);

  const resetTopics = useCallback(async () => {
    setSaving(true);
    try {
      const next = await updateFeedPreferences({ interest_tags: [] });
      setPreferences(next);
      preferencesRef.current = next;
      return next;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    selectedTopics: preferences?.interest_tags ?? [],
    topicsSelected: preferences?.topics_selected ?? false,
    availableTopics,
    loading,
    saving,
    saveTopics,
    addTopic,
    removeTopic,
    resetTopics,
  };
}
