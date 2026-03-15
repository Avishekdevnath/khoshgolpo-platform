import { useEffect } from "react";
import useSWRInfinite from "swr/infinite";

import { useAuthStore } from "@/store/authStore";
import { getPeopleExplore, searchPeople } from "@/lib/peopleApi";
import type {
  PeopleCard,
  PeopleExploreResponse,
  PeopleExploreSection,
  PeopleExploreSort,
  PeopleRelationshipFilter,
  PeopleSearchResponse,
  PeopleSearchSort,
} from "@/types/people";

type UsePeopleSearchOptions = {
  query: string;
  sort: PeopleSearchSort;
  relationship: PeopleRelationshipFilter;
  pageCount: number;
  limit?: number;
};

type UsePeopleExploreOptions = {
  sort: PeopleExploreSort;
  pageCount: number;
  limit?: number;
};

export function usePeopleSearch(options: UsePeopleSearchOptions) {
  const { query, sort, relationship, pageCount, limit = 20 } = options;
  const { isAuthenticated } = useAuthStore();
  const normalizedQuery = query.trim();
  const enabled = isAuthenticated() && normalizedQuery.length > 0;

  const state = useSWRInfinite<PeopleSearchResponse>(
    (index, previousPageData) => {
      if (!enabled) return null;
      if (previousPageData && previousPageData.data.length === 0) return null;
      return ["people-search", normalizedQuery, sort, relationship, index + 1, limit] as const;
    },
    ([, currentQuery, currentSort, currentRelationship, page, pageLimit]) =>
      searchPeople(currentQuery, page, pageLimit, currentSort, currentRelationship),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      persistSize: true,
    },
  );
  const { setSize: setSearchSize } = state;

  useEffect(() => {
    void setSearchSize(pageCount);
  }, [pageCount, setSearchSize]);

  const pages = state.data ?? [];
  const data = pages.flatMap((page) => page.data);
  const total = pages[0]?.total ?? 0;

  return {
    data,
    total,
    isLoading: enabled ? state.isLoading && pages.length === 0 : false,
    isLoadingMore: state.isValidating && pages.length > 0,
    error: state.error ?? null,
    hasMore: data.length < total,
    mutate: state.mutate,
  };
}

export function usePeopleExplore(options: UsePeopleExploreOptions) {
  const { sort, pageCount, limit = 20 } = options;
  const { isAuthenticated } = useAuthStore();
  const enabled = isAuthenticated();

  const state = useSWRInfinite<PeopleExploreResponse>(
    (index, previousPageData) => {
      if (!enabled) return null;
      if (previousPageData && previousPageData.ranked.data.length === 0) return null;
      return ["people-explore", sort, index + 1, limit] as const;
    },
    ([, currentSort, page, pageLimit]) => getPeopleExplore(page, pageLimit, currentSort),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      persistSize: true,
    },
  );
  const { setSize: setExploreSize } = state;

  useEffect(() => {
    void setExploreSize(pageCount);
  }, [pageCount, setExploreSize]);

  const pages = state.data ?? [];
  const sections: PeopleExploreSection[] = pages[0]?.sections ?? [];
  const ranked: PeopleCard[] = pages.flatMap((page) => page.ranked.data);
  const total = pages[0]?.ranked.total ?? 0;

  return {
    sections,
    ranked,
    total,
    isLoading: enabled ? state.isLoading && pages.length === 0 : false,
    isLoadingMore: state.isValidating && pages.length > 0,
    error: state.error ?? null,
    hasMore: ranked.length < total,
    mutate: state.mutate,
  };
}
