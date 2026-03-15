export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio?: string | null;
  createdAt: string;
}

export interface Thread {
  id: string;
  title: string;
  body: string;
  tags: string[];
  authorId: string;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  parentPostId?: string | null;
  aiScore?: number | null;
  isFlagged: boolean;
  createdAt: string;
  updatedAt: string;
}
