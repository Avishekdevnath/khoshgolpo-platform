import useSWR from "swr";
import { api } from "@/lib/api";

export interface Thread {
  id: string;
  title: string;
  body: string;
  tags: string[];
  author_id: string;
  post_count: number;
  status: "open" | "closed" | "archived";
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ThreadListResponse {
  data: Thread[];
  page: number;
  limit: number;
  total: number;
}

interface UseThreadsOptions {
  page?: number;
  limit?: number;
  tag?: string;
  search?: string;
  sort?: "newest" | "oldest" | "most_replies";
  status?: "open" | "closed" | "archived";
}

export function useThreads(options: UseThreadsOptions = {}) {
  const { page = 1, limit = 20, tag, search, sort = "newest", status } = options;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
  });

  if (tag) params.append("tag", tag);
  if (search) params.append("search", search);
  if (status) params.append("status", status);

  const { data, error, isLoading, mutate } = useSWR<ThreadListResponse>(
    `/threads?${params.toString()}`,
    async (url) => api.get(url).json(),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  return {
    threads: data?.data || [],
    page: data?.page || 1,
    limit: data?.limit || 20,
    total: data?.total || 0,
    isLoading,
    error,
    mutate,
  };
}
