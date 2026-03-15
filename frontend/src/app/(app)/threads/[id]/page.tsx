import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import ThreadDetailWorkspace from "@/components/threads/ThreadDetailWorkspace";

type ThreadPageProps = {
  params: Promise<{ id: string }>;
};

type ThreadOut = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  author_id: string;
  author_username?: string | null;
  author_display_name?: string | null;
  post_count: number;
  like_count: number;
  liked_by_me: boolean;
  status: "open" | "closed" | "archived";
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type PostNode = {
  id: string;
  author_id: string;
  author_username?: string | null;
  author_display_name?: string | null;
  parent_post_id: string | null;
  content: string;
  mentions: string[];
  ai_score: number | null;
  is_flagged: boolean;
  is_deleted: boolean;
  like_count: number;
  liked_by_me: boolean;
  children: PostNode[];
  created_at: string;
  updated_at: string;
};

type PostTreeResponse = {
  data: PostNode[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function buildRequestInit(accessToken: string | undefined): RequestInit {
  if (!accessToken) {
    return { cache: "no-store" };
  }
  return {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

async function fetchWithOptionalAuth(url: string, accessToken: string | undefined): Promise<Response> {
  const response = await fetch(url, buildRequestInit(accessToken));
  if (response.status === 401 && accessToken) {
    return fetch(url, buildRequestInit(undefined));
  }
  return response;
}

async function getThread(id: string, accessToken: string | undefined): Promise<ThreadOut | null> {
  const response = await fetchWithOptionalAuth(`${API_BASE_URL}/threads/${id}`, accessToken);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Failed to load thread");
  }
  return response.json();
}

async function getPosts(id: string, accessToken: string | undefined): Promise<PostNode[] | null> {
  const response = await fetchWithOptionalAuth(
    `${API_BASE_URL}/threads/${id}/posts?page=1&limit=50`,
    accessToken,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Failed to load thread posts");
  }
  const payload = (await response.json()) as PostTreeResponse;
  return payload.data;
}

export default async function ThreadDetailsPage({ params }: ThreadPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("kg_access_token")?.value;
  const thread = await getThread(id, accessToken);
  if (!thread) {
    notFound();
  }

  const posts = await getPosts(id, accessToken);
  if (!posts) {
    notFound();
  }

  return <ThreadDetailWorkspace thread={thread} initialPosts={posts} />;
}
