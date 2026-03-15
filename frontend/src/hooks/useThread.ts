import useSWR from "swr";
import { api } from "@/lib/api";
import { Thread } from "./useThreads";

export interface Post {
  id: string;
  thread_id: string;
  author_id: string;
  parent_post_id: string | null;
  content: string;
  mentions: string[];
  ai_score: number | null;
  is_flagged: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostTreeNode extends Post {
  children: PostTreeNode[];
}

export interface ThreadDetailResponse extends Thread {
  posts: Post[];
}

export interface PostTreeListResponse {
  data: PostTreeNode[];
  page: number;
  limit: number;
  total: number;
}

export function useThread(threadId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Thread>(
    threadId ? `/threads/${threadId}` : null,
    async (url) => api.get(url).json(),
    {
      revalidateOnFocus: false,
    }
  );

  return {
    thread: data || null,
    isLoading,
    error,
    mutate,
  };
}

export function useThreadPosts(threadId: string | undefined, page = 1) {
  const { data, error, isLoading, mutate } = useSWR<PostTreeListResponse>(
    threadId ? `/threads/${threadId}/posts?page=${page}&limit=20` : null,
    async (url) => api.get(url).json(),
    {
      revalidateOnFocus: false,
    }
  );

  return {
    posts: data?.data || [],
    page: data?.page || 1,
    limit: data?.limit || 20,
    total: data?.total || 0,
    isLoading,
    error,
    mutate,
  };
}
