"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Heart,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { getExploreFeed, getMyFeed } from "@/lib/feedApi";
import { profilePathFromUsername, toProfilePath } from "@/lib/profileRouting";
import { useAuthStore } from "@/store/authStore";
import { useDragResize } from "@/hooks/useDragResize";
import { useMentionSuggest } from "@/hooks/useMentionSuggest";
import { useUserTopics } from "@/hooks/useUserTopics";
import { avatarSeed, initials, relativeTime } from "@/lib/workspaceUtils";
import PageLoader from "@/components/shared/PageLoader";
import RichText from "@/components/shared/RichText";
import TopicPickerBanner from "@/components/threads/TopicPickerBanner";
import UserHoverCard from "@/components/shared/UserHoverCard";
import WorkspaceShell from "@/components/app/WorkspaceShell";
import type { FeedItem, SortMode } from "@/types/feed";

// ─── Types ────────────────────────────────────────────────────────────────────

type ThreadStatus = "open" | "closed" | "archived";

type ThreadOut = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  author_id: string;
  author_username?: string | null;
  author_display_name?: string | null;
  author_is_bot?: boolean;
  post_count: number;
  like_count: number;
  liked_by_me: boolean;
  status: ThreadStatus;
  is_pinned?: boolean;
  is_flagged?: boolean;
  is_deleted?: boolean;
  feed_boost?: number;
  created_at: string;
  updated_at: string;
};

type ThreadListResponse = {
  data: ThreadOut[];
  page: number;
  limit: number;
  total: number;
};

type FollowingFeedListResponse = {
  data: FeedItem[];
  limit: number;
  next_cursor: string | null;
  mode: "home" | "following";
};

type ToneCheckResponse = {
  score: number;
  warning: boolean;
  flagged: boolean;
  suggestion: string | null;
  reason: string | null;
};

type TabKey = "MyFeed" | "Following" | "Explore" | "Mine";
type RightPanel = "detail" | "create";
type TabState = {
  threads: ThreadOut[];
  total: number;
  page: number;
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasFetched: boolean;
};

type PostOut = {
  id: string;
  thread_id: string;
  author_id: string;
  author_username?: string | null;
  author_display_name?: string | null;
  parent_post_id?: string | null;
  content: string;
  like_count: number;
  liked_by_me: boolean;
  created_at: string;
};

type PostNode = PostOut & {
  children?: PostNode[];
};

type PostListResponse = {
  data: PostNode[];
  total: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusTone(status: ThreadStatus) {
  if (status === "open")     return { text: "#22d3a0", bg: "rgba(34,211,160,0.12)",  border: "rgba(34,211,160,0.2)",   label: "Open" };
  if (status === "closed")   return { text: "#5a5a72", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.1)",  label: "Closed" };
  return                            { text: "#5a5a72", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.1)",  label: "Archived" };
}

function shortId(id: string): string {
  if (/^[a-f0-9]{24}$/i.test(id)) return `Member ${id.slice(-4).toUpperCase()}`;
  return id.replace(/[_-]+/g, " ");
}

function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw.split(",")) {
    const tag = t.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out.slice(0, 8);
}

function userProfileHref(authorId: string, authorUsername?: string | null): string {
  if (authorUsername?.trim()) {
    return profilePathFromUsername(authorUsername);
  }
  return toProfilePath(authorId);
}

function uniqueByThreadId(items: ThreadOut[]): ThreadOut[] {
  const seen = new Set<string>();
  const unique: ThreadOut[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

function toThreadOut(item: FeedItem): ThreadOut {
  return {
    ...item,
    like_count: 0,
    liked_by_me: false,
    author_is_bot: false,
  };
}

function toThreadOutList(items: FeedItem[]): ThreadOut[] {
  return items.map(toThreadOut);
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function ThreadSkeleton() {
  return (
    <div style={{
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      background: "transparent",
      padding: "16px 20px",
    }}>
      {[85, 60, 92, 78].map((w, i) => (
        <div key={i} style={{
          height: i < 2 ? 13 : 11, width: `${w}%`,
          borderRadius: 4, background: "#1a1a24",
          marginTop: i === 0 ? 0 : 6,
          animation: "sk 1.4s ease infinite",
          opacity: i > 1 ? 0.5 : 1,
        }} />
      ))}
      <style jsx>{`@keyframes sk{0%,100%{opacity:.4}50%{opacity:.9}}`}</style>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  thread,
  onClose,
  onThreadUpdated,
  onThreadDeleted,
}: {
  thread: ThreadOut | null;
  onClose: () => void;
  onThreadUpdated: (updated: ThreadOut) => void;
  onThreadDeleted: (threadId: string) => void;
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<PostNode[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; author: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [threadEditOpen, setThreadEditOpen] = useState(false);
  const [threadEditTitle, setThreadEditTitle] = useState("");
  const [threadEditBody, setThreadEditBody] = useState("");
  const [threadEditTags, setThreadEditTags] = useState("");
  const [threadEditSaving, setThreadEditSaving] = useState(false);
  const [threadDeleteOpen, setThreadDeleteOpen] = useState(false);
  const [postEditId, setPostEditId] = useState<string | null>(null);
  const [postEditText, setPostEditText] = useState("");
  const [postEditSaving, setPostEditSaving] = useState(false);
  const [postDeleteId, setPostDeleteId] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const postEditInputRef = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionSuggest();
  const editMention = useMentionSuggest();
  const threadId = thread?.id;

  const replyCount = useMemo(() => {
    const walk = (nodes: PostNode[]): number => (
      nodes.reduce((total, node) => total + 1 + walk(node.children ?? []), 0)
    );
    return walk(posts);
  }, [posts]);

  const canManageThread = Boolean(
    user && thread && (
      user.id === thread.author_id
      || (user.username && thread.author_username && user.username === thread.author_username)
    ),
  );
  const canEditThreadBody = Boolean(thread && thread.post_count === 0);

  function insertReply(nodes: PostNode[], parentId: string, reply: PostNode): PostNode[] {
    return nodes.map(node => {
      if (node.id === parentId) return { ...node, children: [...(node.children ?? []), reply] };
      if ((node.children?.length ?? 0) > 0) return { ...node, children: insertReply(node.children!, parentId, reply) };
      return node;
    });
  }

  async function loadPosts(currentThreadId: string) {
    setPostsLoading(true);
    try {
      const res = await apiGet<PostListResponse>(`threads/${currentThreadId}/posts?limit=20&page=1`);
      setPosts(res.data);
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }

  async function refreshPosts() {
    if (!threadId) return;
    await loadPosts(threadId);
  }

  useEffect(() => {
    if (!threadId) {
      setPosts([]);
      return;
    }
    let cancelled = false;
    setPostsLoading(true);
    apiGet<PostListResponse>(`threads/${threadId}/posts?limit=20&page=1`)
      .then(res => { if (!cancelled) setPosts(res.data); })
      .catch(() => { if (!cancelled) setPosts([]); })
      .finally(() => { if (!cancelled) setPostsLoading(false); });
    return () => { cancelled = true; };
  }, [threadId]);

  useEffect(() => {
    setActionError(null);
    setThreadEditOpen(false);
    setThreadDeleteOpen(false);
    setPostEditId(null);
    setPostDeleteId(null);
    setReplyingTo(null);
  }, [threadId]);

  function openThreadEdit() {
    if (!thread) return;
    setThreadEditTitle(thread.title);
    setThreadEditBody(thread.body);
    setThreadEditTags(thread.tags.join(", "));
    setActionError(null);
    setThreadEditOpen(true);
  }

  async function saveThreadEdit() {
    if (!thread) return;
    const nextTitle = threadEditTitle.trim();
    const nextBody = threadEditBody.trim();
    const nextTags = parseTags(threadEditTags);

    if (!nextTitle) {
      setActionError("Title is required.");
      return;
    }
    if (canEditThreadBody && !nextBody) {
      setActionError("Body is required.");
      return;
    }

    const payload: { title?: string; body?: string; tags?: string[] } = {};
    if (nextTitle !== thread.title) payload.title = nextTitle;
    if (canEditThreadBody && nextBody !== thread.body) payload.body = nextBody;
    if (JSON.stringify(nextTags) !== JSON.stringify(thread.tags)) payload.tags = nextTags;

    if (Object.keys(payload).length === 0) {
      setThreadEditOpen(false);
      return;
    }

    setThreadEditSaving(true);
    try {
      const updated = await apiPatch<ThreadOut>(`threads/${thread.id}`, payload);
      onThreadUpdated(updated);
      setThreadEditOpen(false);
      setActionError(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update thread.");
    } finally {
      setThreadEditSaving(false);
    }
  }

  async function confirmThreadDelete() {
    if (!thread) return;
    try {
      await apiDelete(`threads/${thread.id}`);
      setThreadDeleteOpen(false);
      onThreadDeleted(thread.id);
      setActionError(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete thread.");
      setThreadDeleteOpen(false);
    }
  }

  function openPostEdit(post: PostNode) {
    setPostEditId(post.id);
    setPostEditText(post.content);
    editMention.close();
    setActionError(null);
  }

  async function savePostEdit() {
    if (!postEditId || !postEditText.trim()) return;
    setPostEditSaving(true);
    try {
      await apiPatch(`posts/${postEditId}`, { content: postEditText.trim() });
      setPostEditId(null);
      setActionError(null);
      await refreshPosts();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update comment.");
    } finally {
      setPostEditSaving(false);
    }
  }

  async function confirmPostDelete() {
    if (!postDeleteId || !thread) return;
    const deletingId = postDeleteId;
    try {
      await apiDelete(`posts/${deletingId}`);
      setPostDeleteId(null);
      setReplyingTo(prev => (prev?.id === deletingId ? null : prev));
      onThreadUpdated({ ...thread, post_count: Math.max(0, thread.post_count - 1) });
      setActionError(null);
      await refreshPosts();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete comment.");
      setPostDeleteId(null);
    }
  }

  async function handleReply() {
    if (!replyText.trim() || !thread || replying) return;
    setReplying(true);
    try {
      const payload: { content: string; parent_post_id?: string } = { content: replyText.trim() };
      if (replyingTo) payload.parent_post_id = replyingTo.id;
      const post = await apiPost<PostOut>(`threads/${thread.id}/posts`, payload);
      const newNode: PostNode = { ...post, children: [] };
      if (replyingTo) {
        setPosts(prev => insertReply(prev, replyingTo.id, newNode));
      } else {
        setPosts(prev => [...prev, newNode]);
      }
      onThreadUpdated({ ...thread, post_count: thread.post_count + 1 });
      setReplyText("");
      setReplyingTo(null);
      setActionError(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to post reply.");
    } finally {
      setReplying(false);
    }
  }

  async function handlePanelThreadLike() {
    if (!user || !thread) return;
    const wasLiked = thread.liked_by_me;
    onThreadUpdated({ ...thread, liked_by_me: !wasLiked, like_count: thread.like_count + (wasLiked ? -1 : 1) });
    try {
      await apiPost(`threads/${thread.id}/like`, {});
    } catch {
      onThreadUpdated({ ...thread, liked_by_me: wasLiked, like_count: thread.like_count });
    }
  }

  function togglePostLikeInTree(nodes: PostNode[], postId: string): PostNode[] {
    return nodes.map(n => {
      if (n.id === postId) {
        const wasLiked = n.liked_by_me;
        return { ...n, liked_by_me: !wasLiked, like_count: n.like_count + (wasLiked ? -1 : 1) };
      }
      if (n.children?.length) return { ...n, children: togglePostLikeInTree(n.children, postId) };
      return n;
    });
  }

  async function handlePostLike(postId: string) {
    if (!user || !thread) return;
    setPosts(prev => togglePostLikeInTree(prev, postId));
    try {
      await apiPost(`threads/${thread.id}/posts/${postId}/like`, {});
    } catch {
      setPosts(prev => togglePostLikeInTree(prev, postId));
    }
  }

  function handleReplyChange(e: React.ChangeEvent<HTMLInputElement>) {
    setReplyText(e.target.value);
    mention.check(e.target.value, e.target.selectionStart ?? 0);
  }

  function handlePostEditChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPostEditText(e.target.value);
    editMention.check(e.target.value, e.target.selectionStart ?? 0);
  }

  function insertMention(idx: number) {
    const username = mention.suggestions[idx]?.username;
    if (!username || !replyInputRef.current) return;
    const el = replyInputRef.current;
    const { newText, newCursor } = mention.buildInsert(replyText, el.selectionStart ?? 0, username);
    setReplyText(newText);
    mention.close();
    requestAnimationFrame(() => {
      el.selectionStart = newCursor;
      el.selectionEnd = newCursor;
      el.focus();
    });
  }

  function insertPostEditMention(idx: number) {
    const username = editMention.suggestions[idx]?.username;
    if (!username || !postEditInputRef.current) return;
    const el = postEditInputRef.current;
    const { newText, newCursor } = editMention.buildInsert(postEditText, el.selectionStart ?? 0, username);
    setPostEditText(newText);
    editMention.close();
    requestAnimationFrame(() => {
      el.selectionStart = newCursor;
      el.selectionEnd = newCursor;
      el.focus();
    });
  }

  function renderReplyChain(post: PostNode, depth = 0) {
    const postAuthor = post.author_display_name ?? post.author_username ?? shortId(post.author_id);
    const postHandle = post.author_username && post.author_display_name ? `@${post.author_username}` : null;
    const postProfileHref = userProfileHref(post.author_id, post.author_username);
    const isPostOwner = Boolean(
      user && (
        user.id === post.author_id
        || (user.username && post.author_username && user.username === post.author_username)
      ),
    );
    const [pa1, pa2] = avatarSeed(post.author_id);

    return (
      <div key={post.id} className={`comment-thread ${depth > 0 ? "is-child" : ""}`}>
        <div className="comment">
          <Link
            href={postProfileHref}
            className="comment-author-link"
            aria-label={`Open profile of ${postAuthor}`}
          >
            <span className="comment-av" style={{ background: `linear-gradient(135deg,${pa1},${pa2})` }}>
              {initials(postAuthor)}
            </span>
          </Link>
          <div className="comment-body">
            <div className="comment-name-row">
              <Link
                href={postProfileHref}
                className="comment-name-link"
                aria-label={`Open profile of ${postAuthor}`}
              >
                <span className="comment-name">{postAuthor}</span>
                {postHandle && <span className="comment-username">{postHandle}</span>}
              </Link>
              <span className="comment-sep" aria-hidden="true">|</span>
              <span className="comment-time">{relativeTime(post.created_at)}</span>
              {isPostOwner && (
                <div className="comment-owner-actions">
                  <button type="button" onClick={() => openPostEdit(post)}>Edit</button>
                  <button type="button" className="danger" onClick={() => setPostDeleteId(post.id)}>Delete</button>
                </div>
              )}
            </div>
            <RichText content={post.content} variant="compact" className="comment-text" />
            <div className="comment-footer">
              <button
                type="button"
                className={post.liked_by_me ? "comment-like liked" : "comment-like"}
                onClick={() => handlePostLike(post.id)}
                title={user ? (post.liked_by_me ? "Unlike" : "Like") : "Sign in to like"}
              >
                <Heart size={11} fill={post.liked_by_me ? "currentColor" : "none"} />
                {post.like_count > 0 ? post.like_count : "Like"}
              </button>
              {user && (
                <button
                  type="button"
                  className="comment-reply-btn"
                  onClick={() => setReplyingTo({ id: post.id, author: postAuthor })}
                >
                  Reply
                </button>
              )}
            </div>
          </div>
        </div>
        {(post.children?.length ?? 0) > 0 && (
          depth < 2 ? (
            <div className="comment-children">
              {post.children?.map(child => renderReplyChain(child, depth + 1))}
            </div>
          ) : (
            <div className="comment-children-flat">
              {post.children?.map(child => renderReplyChain(child, 2))}
            </div>
          )
        )}
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="right-panel right-panel-empty">
        <div className="empty-hint">
          <div className="empty-icon">
            <MessageSquare size={22} strokeWidth={1.5} />
          </div>
          <p>Select a thread to preview</p>
        </div>
        <style jsx>{panelStyles}</style>
      </div>
    );
  }

  const tone = statusTone(thread.status);
  const authorLabel = thread.author_display_name ?? thread.author_username ?? shortId(thread.author_id);
  const authorProfileHref = userProfileHref(thread.author_id, thread.author_username);
  const [av1, av2] = avatarSeed(thread.author_id);

  return (
    <div className="rp-layout">
      <div className="rp-scroll">
        <button type="button" className="rp-close" onClick={onClose} aria-label="Close thread preview">
          <X size={14} />
        </button>

        <div className="preview-status-row">
          <span className="status-pill" style={{ color: tone.text, background: tone.bg, border: `1px solid ${tone.border}` }}>
            {tone.label}
          </span>
          <span className="rp-time">{relativeTime(thread.created_at)}</span>
          {canManageThread && (
            <div className="preview-actions">
              <button type="button" className="preview-action-btn" onClick={openThreadEdit}>
                <Pencil size={12} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                className="preview-action-btn danger"
                onClick={() => setThreadDeleteOpen(true)}
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        <h2 className="preview-title" onClick={() => router.push(`/threads/${thread.id}`)}>
          {thread.title}
        </h2>

        <RichText content={thread.body} variant="full" className="preview-body-rt" />
        <hr className="preview-divider" />

        {thread.tags.length > 0 && (
          <div className="preview-tags">
            {thread.tags.map(tag => (
              <span key={tag} className="rp-tag">#{tag}</span>
            ))}
          </div>
        )}

        <div className="preview-author-row">
          <Link
            href={authorProfileHref}
            className="rp-author-link"
            aria-label={`Open profile of ${authorLabel}`}
          >
            <span className="rp-avatar" style={{ background: `linear-gradient(135deg,${av1},${av2})` }}>
              {initials(authorLabel)}
            </span>
            <div className="rp-author-name">{authorLabel}</div>
          </Link>
          <button
            type="button"
            className={thread.liked_by_me ? "rp-like liked" : "rp-like"}
            onClick={handlePanelThreadLike}
            title={user ? (thread.liked_by_me ? "Unlike" : "Like") : "Sign in to like"}
          >
            <Heart size={13} fill={thread.liked_by_me ? "currentColor" : "none"} />
            {thread.like_count > 0 ? thread.like_count : "Like"}
          </button>
        </div>

        <div className="comment-section">
          {postsLoading ? (
            <div className="no-replies">Loading replies...</div>
          ) : posts.length > 0 ? (
            <>
              <div className="comment-label">
                {replyCount} {replyCount === 1 ? "reply" : "replies"}
              </div>
              <div className="comment-tree">
                {posts.map(post => renderReplyChain(post))}
              </div>
            </>
          ) : (
            <div className="no-replies">No replies yet. Be the first to reply.</div>
          )}
        </div>
      </div>

      {actionError && <div className="action-error">{actionError}</div>}

      {replyingTo && (
        <div className="reply-to-bar">
          <span>Replying to <strong>{replyingTo.author}</strong></span>
          <button type="button" className="reply-to-cancel" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">x</button>
        </div>
      )}

      <div className="reply-input-row">
        <div className="reply-input-wrap">
          <input
            ref={replyInputRef}
            className="reply-input"
            placeholder={user ? (replyingTo ? `Reply to ${replyingTo.author}...` : "Write a reply...") : "Sign in to reply..."}
            value={replyText}
            onChange={handleReplyChange}
            onKeyDown={e => {
              if (mention.onKeyDown(e, insertMention)) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleReply();
              }
            }}
            onBlur={() => setTimeout(mention.close, 150)}
            disabled={!user || replying}
            aria-label="Write a reply"
          />
          {mention.isOpen && (
            <div className="mention-dropdown">
              {mention.suggestions.length > 0 ? (
                mention.suggestions.map((s, i) => (
                  <button
                    key={s.username}
                    type="button"
                    className={`mention-item${i === mention.selectedIdx ? " selected" : ""}`}
                    onMouseDown={e => { e.preventDefault(); insertMention(i); }}
                  >
                    <span className="mention-dn">{s.display_name}</span>
                    <span className="mention-un">@{s.username}</span>
                  </button>
                ))
              ) : (
                <p className="mention-hint">
                  {mention.query === "" ? "Type a username to search..." : "No users found"}
                </p>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="send-btn"
          onClick={() => void handleReply()}
          disabled={!user || !replyText.trim() || replying}
          aria-label="Send reply"
        >
          <Send size={15} />
          <span>Post</span>
        </button>
      </div>

      {threadEditOpen && (
        <div className="modal-overlay" onClick={() => setThreadEditOpen(false)} role="presentation">
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="thread-edit-modal-title">
            <h3 id="thread-edit-modal-title">Edit thread</h3>
            <label htmlFor="thread-edit-title">Title</label>
            <input
              id="thread-edit-title"
              value={threadEditTitle}
              onChange={e => setThreadEditTitle(e.target.value)}
              maxLength={160}
            />
            <label htmlFor="thread-edit-body">Body</label>
            <textarea
              id="thread-edit-body"
              value={threadEditBody}
              onChange={e => setThreadEditBody(e.target.value)}
              rows={6}
              disabled={!canEditThreadBody}
            />
            {!canEditThreadBody && (
              <p className="modal-note">Body is locked after the first reply. You can still update title and tags.</p>
            )}
            <label htmlFor="thread-edit-tags">Tags</label>
            <input
              id="thread-edit-tags"
              value={threadEditTags}
              onChange={e => setThreadEditTags(e.target.value)}
              placeholder="career, fastapi, interview"
            />
            <div className="modal-actions">
              <button type="button" className="modal-btn modal-btn-ghost" onClick={() => setThreadEditOpen(false)}>Cancel</button>
              <button
                type="button"
                className="modal-btn modal-btn-primary"
                disabled={threadEditSaving || !threadEditTitle.trim() || (canEditThreadBody && !threadEditBody.trim())}
                onClick={() => void saveThreadEdit()}
              >
                {threadEditSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {postEditId && (
        <div className="modal-overlay" onClick={() => setPostEditId(null)} role="presentation">
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="comment-edit-modal-title">
            <h3 id="comment-edit-modal-title">Edit comment</h3>
            <div className="modal-input-wrap">
              <textarea
                ref={postEditInputRef}
                value={postEditText}
                onChange={handlePostEditChange}
                rows={5}
                onKeyDown={e => {
                  if (editMention.onKeyDown(e, insertPostEditMention)) return;
                }}
                onBlur={() => setTimeout(editMention.close, 150)}
              />
              {editMention.isOpen && (
                <div className="mention-dropdown">
                  {editMention.suggestions.length > 0 ? (
                    editMention.suggestions.map((s, i) => (
                      <button
                        key={s.username}
                        type="button"
                        className={`mention-item${i === editMention.selectedIdx ? " selected" : ""}`}
                        onMouseDown={e => { e.preventDefault(); insertPostEditMention(i); }}
                      >
                        <span className="mention-dn">{s.display_name}</span>
                        <span className="mention-un">@{s.username}</span>
                      </button>
                    ))
                  ) : (
                    <p className="mention-hint">
                      {editMention.query === "" ? "Type a username to search..." : "No users found"}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-btn modal-btn-ghost" onClick={() => setPostEditId(null)}>Cancel</button>
              <button
                type="button"
                className="modal-btn modal-btn-primary"
                disabled={postEditSaving || !postEditText.trim()}
                onClick={() => void savePostEdit()}
              >
                {postEditSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {postDeleteId && (
        <div className="modal-overlay" onClick={() => setPostDeleteId(null)} role="presentation">
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="comment-delete-modal-title">
            <h3 id="comment-delete-modal-title">Delete comment</h3>
            <p className="modal-note">Are you sure you want to delete this comment? This action cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="modal-btn modal-btn-ghost" onClick={() => setPostDeleteId(null)}>Cancel</button>
              <button type="button" className="modal-btn modal-btn-danger" onClick={() => void confirmPostDelete()}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {threadDeleteOpen && (
        <div className="modal-overlay" onClick={() => setThreadDeleteOpen(false)} role="presentation">
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="thread-delete-modal-title">
            <h3 id="thread-delete-modal-title">Delete thread</h3>
            <p className="modal-note">Are you sure you want to delete this thread? This action cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="modal-btn modal-btn-ghost" onClick={() => setThreadDeleteOpen(false)}>Cancel</button>
              <button type="button" className="modal-btn modal-btn-danger" onClick={() => void confirmThreadDelete()}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{panelStyles}</style>
    </div>
  );
}
function CreatePanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (thread: ThreadOut) => void;
}) {
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [body, setBody] = useState("");
  const [bodyPreview, setBodyPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toneResult, setToneResult] = useState<ToneCheckResponse | null>(null);
  const [showToneWarning, setShowToneWarning] = useState(false);
  const [toneApproved, setToneApproved] = useState(false);
  const titleInputId = useId();
  const tagsInputId = useId();
  const bodyInputId = useId();
  const bodyCountId = useId();

  const parsedTags = useMemo(() => parseTags(tagsInput), [tagsInput]);
  const bodyCount = body.length;

  async function runToneCheck(): Promise<ToneCheckResponse> {
    const result = await apiPost<ToneCheckResponse>("ai/tone-check", { content: body });
    setToneResult(result);
    return result;
  }

  async function handleSubmit(skipTone = false) {
    if (!title.trim() || !body.trim()) { setError("Title and body are required."); return; }
    setError(null);
    setIsSubmitting(true);
    try {
      if (!skipTone) {
        const tone = await runToneCheck();
        if (tone.warning) { setShowToneWarning(true); setIsSubmitting(false); return; }
      }
      const created = await apiPost<ThreadOut>("threads", {
        title: title.trim(),
        body: body.trim(),
        tags: parsedTags,
      });
      onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create thread");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="right-panel create-panel">
      {/* Header */}
      <div className="rp-header">
        <span className="rp-eyebrow">New Thread</span>
        <button type="button" className="icon-btn" onClick={onClose} title="Cancel" aria-label="Cancel creating thread">
          <X size={14} />
        </button>
      </div>

      <h2 className="rp-title" style={{ fontSize: 22, marginBottom: 20 }}>Start a Discussion</h2>

      {/* Form */}
      <div className="cf-group">
        <label className="cf-label" htmlFor={titleInputId}>Title</label>
        <input
          id={titleInputId}
          className="cf-input"
          placeholder="What do you want to discuss?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={160}
        />
        <span className="cf-hint">{title.length}/160</span>
      </div>

      <div className="cf-group">
        <label className="cf-label" htmlFor={tagsInputId}>Tags</label>
        <input
          id={tagsInputId}
          className="cf-input"
          placeholder="fastapi, backend, career"
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
        />
        {parsedTags.length > 0 && (
          <div className="cf-tags">
            {parsedTags.map(t => <span key={t} className="cf-tag">#{t}</span>)}
          </div>
        )}
      </div>

      <div className="cf-group" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="cf-label-row">
          <label className="cf-label" htmlFor={bodyInputId}>Body</label>
          <div className="cf-composer-tabs">
            <button type="button" className={`cf-composer-tab${!bodyPreview ? " active" : ""}`} onClick={() => setBodyPreview(false)}>Write</button>
            <button type="button" className={`cf-composer-tab${bodyPreview ? " active" : ""}`} onClick={() => setBodyPreview(true)} disabled={!body.trim()}>Preview</button>
          </div>
        </div>
        {bodyPreview ? (
          <div className="cf-preview">
            <RichText content={body} variant="full" />
          </div>
        ) : (
          <textarea
            id={bodyInputId}
            className="cf-textarea"
            placeholder={"Share context, ask for feedback…\n\n**bold** *italic* `code`\n> blockquote\n- list item"}
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={2400}
            aria-describedby={bodyCountId}
          />
        )}
        <div className="cf-footer-row">
          <span className="tone-chip">
            <Sparkles size={11} />
            {toneResult
              ? `Tone ${toneResult.score.toFixed(2)} ${toneResult.warning ? "· warning" : "· clear"}`
              : "No tone check yet"}
          </span>
          <span id={bodyCountId} className={`cf-count ${bodyCount > 1800 ? "warn" : ""}`}>{bodyCount}/2400</span>
        </div>
      </div>

      {/* Tone warning */}
      {showToneWarning && toneResult && (
        <div className="tone-warning">
          <p className="tw-title">Tone Warning</p>
          <p className="tw-body">{toneResult.reason ?? "Your draft may read as harsh."}</p>
          {toneResult.suggestion && <p className="tw-suggestion">{toneResult.suggestion}</p>}
          <div className="tw-actions">
            <button type="button" className="cf-btn-ghost" onClick={() => setShowToneWarning(false)}>
              Edit Draft
            </button>
            <button
              type="button"
              className="cf-btn-primary"
              onClick={async () => {
                if (toneApproved) return;
                setToneApproved(true);
                setShowToneWarning(false);
                await handleSubmit(true);
                setToneApproved(false);
              }}
            >
              Post Anyway
            </button>
          </div>
        </div>
      )}

      {error && <div className="cf-error">{error}</div>}

      <div className="cf-actions">
        <button
          type="button"
          className="cf-btn-ghost"
          disabled={!body.trim() || isSubmitting}
          onClick={async () => { try { setError(null); await runToneCheck(); } catch { setError("Tone check failed"); } }}
        >
          <Sparkles size={13} /> Check Tone
        </button>
        <button
          type="button"
          className="cf-btn-primary"
          disabled={isSubmitting || !title.trim() || !body.trim()}
          onClick={() => handleSubmit(false)}
        >
          {isSubmitting ? "Creating…" : "Create Thread"}
        </button>
      </div>

      <style jsx>{panelStyles}</style>
    </div>
  );
}

// ─── Shared panel styles ───────────────────────────────────────────────────────

const panelStyles = `
  .right-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px 20px;
    overflow-y: auto;
    position: relative;
    padding-top: 20px;
  }
  .right-panel::-webkit-scrollbar { width: 4px; }
  .right-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
  .right-panel-empty {
    align-items: center;
    justify-content: center;
  }
  .empty-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #5a5a72;
    font-size: 13px;
  }
  .empty-icon {
    width: 52px; height: 52px; border-radius: 16px;
    background: #1a1a24; border: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; justify-content: center;
    color: #5a5a72;
  }
  .rp-close {
    position: absolute; top: 16px; right: 16px;
    width: 28px; height: 28px; border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04); color: #9090a8;
    display: grid; place-items: center; cursor: pointer; transition: all 0.15s;
    flex-shrink: 0;
  }
  .rp-close:hover { color: #e8e8f0; border-color: rgba(255,255,255,0.18); }
  .status-pill {
    border-radius: 4px; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.6px; padding: 2px 8px;
  }
  .preview-status-row {
    display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-shrink: 0;
    padding-right: 40px;
  }
  .rp-time { margin-left: auto; font-size: 12px; color: #5a5a72; white-space: nowrap; }
  .preview-actions { display: inline-flex; align-items: center; gap: 6px; }
  .preview-action-btn {
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
    color: #9ba3be;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--font-dm-sans), sans-serif;
  }
  .preview-action-btn:hover { color: #e8e8f0; border-color: rgba(255,255,255,0.2); }
  .preview-action-btn.danger:hover {
    color: #fca5a5;
    border-color: rgba(252,165,165,0.35);
    background: rgba(240,107,107,0.12);
  }
  .preview-title {
    font-family: var(--font-syne), sans-serif;
    font-size: 19px; font-weight: 700; line-height: 1.3; letter-spacing: -0.4px;
    margin: 0 0 12px; color: #e8e8f0; flex-shrink: 0;
    cursor: pointer; border: none; background: transparent; text-align: left;
    padding: 0; font-family: var(--font-syne), sans-serif;
  }
  .preview-title:hover { color: #fb923c; }
  .preview-body-rt { margin-bottom: 0; }
  .preview-divider {
    border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 20px 0;
  }
  .preview-tags {
    display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; flex-shrink: 0;
  }
  .rp-tag {
    border: 1px solid rgba(255,255,255,0.07); color: #9090a8;
    background: rgba(255,255,255,0.05); border-radius: 4px;
    font-size: 11px; font-weight: 500; padding: 2px 8px; transition: all 0.15s;
  }
  .rp-tag:hover { background: rgba(99,102,241,0.12); color: #a5b4fc; border-color: rgba(99,102,241,0.25); }
  .preview-author-row { display: flex; align-items: center; gap: 8px; margin-top: 16px; flex-shrink: 0; justify-content: space-between; }
  .rp-author-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    border-radius: 8px;
    padding: 2px 4px;
    transition: background 0.12s ease;
  }
  .rp-author-link:hover { background: rgba(255,255,255,0.05); }
  .rp-author-link:focus-visible { outline: 2px solid rgba(249,115,22,0.45); outline-offset: 1px; }
  .rp-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .rp-author-name { font-size: 12.5px; font-weight: 600; color: #e8e8f0; }
  .rp-meta { font-size: 11px; color: #5a5a72; margin-top: 1px; }
  /* Detail panel layout */
  .rp-layout {
    height: 100%; display: flex; flex-direction: column;
  }
  .rp-scroll {
    flex: 1; overflow-y: auto; padding: 52px 20px 24px; position: relative;
  }
  .rp-scroll::-webkit-scrollbar { width: 4px; }
  .rp-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
  /* Inline replies */
  .comment-section {
    margin-top: 24px;
    border-top: 1px solid rgba(255,255,255,0.07);
    padding-top: 16px;
  }
  .comment-label {
    font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: none;
    color: #9090a8; margin-bottom: 12px;
  }
  .comment-tree { display: flex; flex-direction: column; gap: 10px; }
  .comment-thread { position: relative; }
  .comment-thread.is-child::before {
    content: "";
    position: absolute;
    left: -12px;
    top: 16px;
    width: 8px;
    border-top: 1px solid rgba(255,255,255,0.14);
  }
  .comment-children {
    margin-top: 8px;
    margin-left: 18px;
    padding-left: 12px;
    border-left: 1px solid rgba(255,255,255,0.12);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .comment-children-flat {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .comment-children-flat .comment-thread.is-child::before { display: none; }
  .comment { display: flex; gap: 10px; }
  .comment-author-link {
    display: inline-flex;
    text-decoration: none;
    border-radius: 999px;
  }
  .comment-author-link:focus-visible { outline: 2px solid rgba(249,115,22,0.45); outline-offset: 1px; }
  .comment-av {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
    margin-top: 6px;
  }
  .comment-body {
    flex: 1; min-width: 0;
    border: 1px solid rgba(255,255,255,0.08);
    background: #1a1a24;
    border-radius: 10px;
    padding: 8px 10px;
  }
  .comment-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
  .comment-name-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    border-radius: 6px;
    padding: 2px 4px;
    transition: background 0.12s ease;
  }
  .comment-name-link:hover { background: rgba(255,255,255,0.05); }
  .comment-name-link:focus-visible { outline: 2px solid rgba(249,115,22,0.45); outline-offset: 1px; }
  .comment-name { font-size: 12px; font-weight: 700; color: #e8e8f0; }
  .comment-username { font-size: 10.5px; color: #9090a8; }
  .comment-sep { font-size: 10px; color: #5a5a72; }
  .comment-time { font-size: 10.5px; color: #5a5a72; font-weight: 500; }
  .comment-owner-actions {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .comment-owner-actions button {
    border: none;
    background: transparent;
    color: #8f97af;
    font-size: 10.5px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    font-family: var(--font-dm-sans), sans-serif;
    transition: all 0.12s;
  }
  .comment-owner-actions button:hover { color: #d7deee; background: rgba(255,255,255,0.06); }
  .comment-owner-actions button.danger:hover {
    color: #fca5a5;
    background: rgba(240,107,107,0.12);
  }
  .comment-text { font-size: 12.5px; }
  .no-replies { font-size: 13px; color: #5a5a72; padding: 14px 0; }
  .rp-like {
    border: none; background: transparent; color: #5a5a72; font-size: 11px;
    display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
    padding: 2px 7px; border-radius: 5px; transition: all 0.15s;
    font-family: var(--font-dm-sans), sans-serif;
  }
  .rp-like:hover { color: #f06b6b; background: rgba(240,107,107,0.1); }
  .rp-like.liked { color: #f06b6b; }
  .comment-footer { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
  .comment-like {
    border: none; background: transparent; color: #5a5a72; font-size: 11px;
    display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
    padding: 2px 6px; border-radius: 4px; transition: all 0.12s;
    font-family: var(--font-dm-sans), sans-serif;
  }
  .comment-like:hover { color: #f06b6b; background: rgba(240,107,107,0.1); }
  .comment-like.liked { color: #f06b6b; }
  .comment-reply-btn {
    border: none; background: transparent; color: #5a5a72;
    font-size: 11px; cursor: pointer; padding: 3px 6px; border-radius: 4px;
    font-family: var(--font-dm-sans), sans-serif; font-weight: 500;
    transition: all 0.12s; margin-top: 4px; display: inline-block;
  }
  .comment-reply-btn:hover { color: #818cf8; background: rgba(99,102,241,0.1); }
  .action-error {
    margin: 0 20px;
    border: 1px solid rgba(240,107,107,0.35);
    background: rgba(240,107,107,0.1);
    color: #fca5a5;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.35;
  }
  /* Reply-to indicator */
  .reply-to-bar {
    padding: 6px 20px; background: rgba(99,102,241,0.08);
    border-top: 1px solid rgba(99,102,241,0.2);
    font-size: 12px; color: #9090a8;
    display: flex; align-items: center; gap: 6px; flex-shrink: 0;
  }
  .reply-to-bar strong { color: #a5b4fc; font-weight: 600; }
  .reply-to-cancel {
    margin-left: auto; border: none; background: transparent;
    color: #5a5a72; cursor: pointer; font-size: 16px; line-height: 1;
    padding: 0 2px; transition: color 0.12s;
  }
  .reply-to-cancel:hover { color: #e8e8f0; }
  /* Reply input row */
  .reply-input-row {
    padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.07);
    background: #13131a; display: flex; gap: 10px; align-items: center; flex-shrink: 0;
  }
  .reply-input {
    flex: 1; background: #1a1a24; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 9px; padding: 9px 14px;
    color: #e8e8f0; font-family: var(--font-dm-sans), sans-serif; font-size: 13px;
    outline: none; transition: all 0.2s;
  }
  .reply-input::placeholder { color: #5a5a72; }
  .reply-input:focus { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.18); }
  .reply-input:disabled { opacity: 0.5; cursor: not-allowed; }
  .reply-input-wrap { position: relative; flex: 1; }
  .reply-input-wrap .reply-input { width: 100%; box-sizing: border-box; }
  .mention-dropdown {
    position: absolute; bottom: calc(100% + 6px); left: 0; right: 0;
    background: #10131d; border: 1px solid #1e2235; border-radius: 10px;
    overflow: hidden; z-index: 60; box-shadow: 0 4px 20px rgba(0,0,0,0.45);
  }
  .mention-item {
    width: 100%; display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; background: transparent; border: none; border-bottom: 1px solid #151927;
    text-align: left; cursor: pointer; transition: background 0.1s;
  }
  .mention-item:last-child { border-bottom: none; }
  .mention-item:hover, .mention-item.selected { background: #151927; }
  .mention-dn { font-size: 13px; color: #e4e8f4; font-weight: 500; font-family: var(--font-dm-sans), sans-serif; }
  .mention-un { font-size: 11px; color: #5a6480; margin-left: auto; font-family: var(--font-dm-sans), sans-serif; }
  .mention-hint { margin: 0; padding: 10px 12px; font-size: 12px; color: #5a6480; font-style: italic; }
  .send-btn {
    height: 36px; border-radius: 9px;
    background: #f97316; border: none; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 0 12px;
    color: #fff; transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(249,115,22,0.25); flex-shrink: 0;
    font-size: 12px; font-weight: 700; font-family: var(--font-dm-sans), sans-serif;
  }
  .send-btn:hover:not(:disabled) { background: #fb923c; transform: scale(1.05); }
  .send-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(5, 7, 12, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1200;
    padding: 16px;
  }
  .modal {
    width: min(460px, 100%);
    border: 1px solid #252b40;
    background: #10131d;
    border-radius: 12px;
    padding: 14px;
    box-shadow: 0 16px 44px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .modal h3 {
    margin: 0 0 4px;
    font-size: 15px;
    color: #e4e8f4;
    font-weight: 700;
  }
  .modal label {
    font-size: 11px;
    font-weight: 600;
    color: #8f97af;
  }
  .modal input,
  .modal textarea {
    border: 1px solid #252b40;
    border-radius: 8px;
    background: #0b0f1b;
    color: #e4e8f4;
    padding: 8px 10px;
    font-size: 13px;
    font-family: var(--font-dm-sans), sans-serif;
    outline: none;
  }
  .modal input:focus,
  .modal textarea:focus {
    border-color: #f97316;
    box-shadow: 0 0 0 3px rgba(249,115,22,0.18);
  }
  .modal textarea {
    resize: vertical;
    min-height: 92px;
    line-height: 1.5;
  }
  .modal-input-wrap {
    position: relative;
  }
  .modal-input-wrap textarea {
    width: 100%;
    box-sizing: border-box;
  }
  .modal-input-wrap .mention-dropdown {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 6px);
  }
  .modal textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .modal-note {
    margin: 2px 0 0;
    font-size: 12px;
    color: #9ba3be;
    line-height: 1.5;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }
  .modal-btn {
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    font-family: var(--font-dm-sans), sans-serif;
    transition: all 0.12s;
  }
  .modal-btn-ghost {
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.03);
    color: #9ba3be;
  }
  .modal-btn-ghost:hover { color: #e4e8f4; border-color: rgba(255,255,255,0.2); }
  .modal-btn-primary {
    background: #f97316;
    color: #fff;
  }
  .modal-btn-primary:hover:not(:disabled) { background: #fb923c; }
  .modal-btn-danger {
    background: #ef4444;
    color: #fff;
  }
  .modal-btn-danger:hover { background: #f87171; }
  .modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* Create form */
  .create-panel { gap: 14px; }
  .cf-group { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
  .cf-label-row { display: flex; align-items: center; justify-content: space-between; }
  .cf-composer-tabs { display: flex; gap: 2px; }
  .cf-composer-tab {
    border: none; background: transparent; cursor: pointer;
    font-size: 11px; font-weight: 600; color: #5a5a72;
    padding: 3px 9px; border-radius: 5px;
    transition: color 0.15s, background 0.15s; font-family: var(--font-dm-sans), sans-serif;
  }
  .cf-composer-tab:hover:not(:disabled) { color: #9090a8; background: rgba(255,255,255,0.05); }
  .cf-composer-tab.active { color: #f97316; background: rgba(249,115,22,0.1); }
  .cf-composer-tab:disabled { opacity: 0.3; cursor: not-allowed; }
  .cf-preview {
    flex: 1; min-height: 140px; background: #1a1a24;
    border: 1.5px solid rgba(255,255,255,0.1); border-radius: 9px;
    padding: 10px 12px; overflow-y: auto;
  }
  .cf-label {
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: #5a5a72;
  }
  .cf-input {
    background: #1a1a24;
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 9px;
    color: #e8e8f0;
    font-size: 13px;
    padding: 9px 12px;
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s;
  }
  .cf-input:focus { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.18); }
  .cf-hint { font-size: 10px; color: #5a5a72; text-align: right; margin-top: -2px; }
  .cf-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .cf-tag {
    background: rgba(99,102,241,0.12);
    border: 1px solid rgba(99,102,241,0.25);
    color: #a5b4fc;
    border-radius: 999px;
    font-size: 11px; font-weight: 600;
    padding: 2px 8px;
  }
  .cf-textarea {
    flex: 1;
    min-height: 140px;
    background: #1a1a24;
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 9px;
    color: #e8e8f0;
    font-size: 13px;
    padding: 10px 12px;
    outline: none;
    font-family: inherit;
    line-height: 1.65;
    resize: vertical;
    transition: border-color 0.15s;
  }
  .cf-textarea:focus { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.18); }
  .cf-footer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 5px;
  }
  .tone-chip {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; color: #5a5a72;
  }
  .cf-count { font-size: 11px; color: #5a5a72; }
  .cf-count.warn { color: #f5c642; }
  .cf-error {
    border: 1px solid rgba(240,107,107,0.35);
    background: rgba(240,107,107,0.1);
    color: #fca5a5;
    border-radius: 9px;
    padding: 8px 12px;
    font-size: 12px;
    flex-shrink: 0;
  }
  .tone-warning {
    border: 1px solid rgba(245,198,66,0.35);
    background: rgba(245,198,66,0.08);
    border-radius: 11px;
    padding: 12px 14px;
    flex-shrink: 0;
  }
  .tw-title { font-size: 13px; font-weight: 700; color: #f5c642; margin-bottom: 5px; }
  .tw-body { font-size: 12px; color: #9090a8; margin-bottom: 6px; }
  .tw-suggestion {
    font-size: 12px; color: #f7b097;
    border-left: 2px solid rgba(249,115,22,0.5);
    padding-left: 8px; margin-bottom: 10px;
  }
  .tw-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .cf-actions {
    display: flex; gap: 8px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }
  .cf-btn-ghost {
    flex: 1; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
    color: #9090a8; border-radius: 9px; padding: 9px;
    font-size: 12px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 5px;
    transition: all 0.15s; font-family: var(--font-dm-sans), sans-serif;
  }
  .cf-btn-ghost:hover:not(:disabled) { color: #e8e8f0; border-color: rgba(255,255,255,0.18); }
  .cf-btn-ghost:disabled { opacity: 0.45; cursor: not-allowed; }
  .cf-btn-primary {
    flex: 1.4; background: #f97316; color: #fff;
    border: none; border-radius: 9px; padding: 9px;
    font-size: 12px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 14px rgba(249,115,22,0.3);
    transition: all 0.15s; font-family: var(--font-dm-sans), sans-serif;
  }
  .cf-btn-primary:hover:not(:disabled) { background: #fb923c; }
  .cf-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
`;

// ─── Main Workspace ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function createEmptyTabState(): TabState {
  return {
    threads: [],
    total: 0,
    page: 1,
    nextCursor: null,
    loading: false,
    loadingMore: false,
    error: null,
    hasFetched: false,
  };
}

function createInitialTabStateMap(): Record<TabKey, TabState> {
  return {
    MyFeed: createEmptyTabState(),
    Following: createEmptyTabState(),
    Explore: createEmptyTabState(),
    Mine: createEmptyTabState(),
  };
}

export default function ThreadsWorkspace() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Layout state
  const [rightPanel, setRightPanel] = useState<RightPanel>("detail");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Filter state
  const [tab, setTab] = useState<TabKey>("MyFeed");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [topicsSkipped, setTopicsSkipped] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchInputId = useId();
  const { selectedTopics, topicsSelected, availableTopics, loading: topicsLoading, saving: topicsSaving, saveTopics } = useUserTopics();
  const tabOptions: Array<{ key: TabKey; label: string }> = [
    { key: "MyFeed", label: selectedTopics.length > 0 ? `My Feed (${selectedTopics.length})` : "My Feed" },
    { key: "Following", label: "Following" },
    { key: "Explore", label: "Explore" },
    { key: "Mine", label: "Mine" },
  ];
  const enabledTabs = user?.id
    ? tabOptions.map(t => t.key)
    : tabOptions.filter(t => t.key !== "Mine" && t.key !== "MyFeed").map(t => t.key);
  const tabButtonRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    MyFeed: null,
    Following: null,
    Explore: null,
    Mine: null,
  });

  // Data state
  const [tabState, setTabState] = useState<Record<TabKey, TabState>>(() => createInitialTabStateMap());
  const [topRefreshing, setTopRefreshing] = useState<Record<TabKey, boolean>>({
    MyFeed: false,
    Following: false,
    Explore: false,
    Mine: false,
  });
  const queryVersionRef = useRef<Record<TabKey, number>>({
    MyFeed: 0,
    Following: 0,
    Explore: 0,
    Mine: 0,
  });
  const mineQueryKeyRef = useRef("");
  const listPanelRef = useRef<HTMLDivElement | null>(null);
  const tabScrollRef = useRef<Record<TabKey, number>>({
    MyFeed: 0,
    Following: 0,
    Explore: 0,
    Mine: 0,
  });

  // Resizable columns (desktop only)
  const { width: listW,    onDragStart: onListDragStart } = useDragResize(420, 420, 600);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => {
    if (!user?.id && (tab === "Mine" || tab === "MyFeed")) {
      setTab("Explore");
    }
  }, [tab, user?.id]);

  useEffect(() => {
    if (user?.id) return;
    setSearch("");
    setDebouncedSearch("");
    mineQueryKeyRef.current = "";
    setTabState(prev => ({ ...prev, Mine: createEmptyTabState(), MyFeed: createEmptyTabState() }));
  }, [user?.id]);

  const mineAuthorId = user?.id ?? "";
  const isFeedTab = tab !== "Mine";
  const isSortableTab = tab === "MyFeed" || tab === "Explore";
  const detailOpen = activeThreadId !== null || rightPanel === "create";
  const contentColumns = detailOpen ? `${listW}px 6px 1fr` : "1fr";
  const mineQueryKey = `${mineAuthorId}|${debouncedSearch}`;
  const currentTabState = tabState[tab];
  const threads = currentTabState.threads;
  const total = currentTabState.total;
  const nextCursor = currentTabState.nextCursor;
  const loading = currentTabState.loading || !currentTabState.hasFetched;
  const loadingMore = currentTabState.loadingMore;
  const error = currentTabState.error;
  const initialLoad = loading && threads.length === 0;

  function buildMineQuery(p: number) {
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE), sort: "newest" });
    if (mineAuthorId) params.set("author_id", mineAuthorId);
    if (debouncedSearch) params.set("search", debouncedSearch);
    return `threads?${params.toString()}`;
  }

  function setTabBucket(tabKey: TabKey, next: (state: TabState) => TabState) {
    setTabState(prev => ({ ...prev, [tabKey]: next(prev[tabKey]) }));
  }

  async function requestFirstPage(tabKey: TabKey): Promise<{ threads: ThreadOut[]; total: number; nextCursor: string | null; page: number }> {
    if (tabKey === "Mine") {
      const res = await apiGet<ThreadListResponse>(buildMineQuery(1));
      return { threads: res.data, total: res.total, nextCursor: null, page: 1 };
    }
    if (tabKey === "MyFeed") {
      const res = await getMyFeed(sortMode, { limit: PAGE_SIZE });
      const threads = toThreadOutList(res.data);
      return { threads, total: threads.length, nextCursor: res.next_cursor, page: 1 };
    }
    if (tabKey === "Explore") {
      const res = await getExploreFeed(sortMode, { limit: PAGE_SIZE });
      const threads = toThreadOutList(res.data);
      return { threads, total: threads.length, nextCursor: res.next_cursor, page: 1 };
    }
    // Following
    const res = await apiGet<FollowingFeedListResponse>(`feed/following?limit=${PAGE_SIZE}`);
    const threads = toThreadOutList(res.data);
    return { threads, total: threads.length, nextCursor: res.next_cursor, page: 1 };
  }

  async function loadFirstPage(tabKey: TabKey) {
    const requestVersion = queryVersionRef.current[tabKey] + 1;
    queryVersionRef.current[tabKey] = requestVersion;
    setTabBucket(tabKey, state => ({ ...state, loading: true, error: null }));
    try {
      const next = await requestFirstPage(tabKey);
      if (queryVersionRef.current[tabKey] !== requestVersion) return;
      setTabBucket(tabKey, state => ({
        ...state,
        threads: next.threads,
        total: next.total,
        page: next.page,
        nextCursor: next.nextCursor,
        loading: false,
        loadingMore: false,
        error: null,
        hasFetched: true,
      }));
    } catch (e: unknown) {
      if (queryVersionRef.current[tabKey] !== requestVersion) return;
      setTabBucket(tabKey, state => ({
        ...state,
        loading: false,
        loadingMore: false,
        error: e instanceof Error ? e.message : "Failed to load threads",
        hasFetched: true,
      }));
    }
  }

  useEffect(() => {
    if (tab === "Mine") return;
    if (tab === "MyFeed" && !topicsSelected && !topicsSkipped) return; // show picker instead
    if (tabState[tab].hasFetched) return;
    void loadFirstPage(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tabState.MyFeed.hasFetched, tabState.Following.hasFetched, tabState.Explore.hasFetched, topicsSelected, topicsSkipped]);

  // Reload MyFeed/Explore when sortMode changes
  useEffect(() => {
    if (tab !== "MyFeed" && tab !== "Explore") return;
    setTabBucket(tab, () => createEmptyTabState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode]);

  useEffect(() => {
    if (tab !== "Mine" || !mineAuthorId) return;
    const shouldFetch = !tabState.Mine.hasFetched || mineQueryKeyRef.current !== mineQueryKey;
    if (!shouldFetch) return;
    mineQueryKeyRef.current = mineQueryKey;
    void loadFirstPage("Mine");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mineAuthorId, mineQueryKey, tabState.Mine.hasFetched]);

  async function loadMore() {
    const current = tabState[tab];
    if (current.loading || current.loadingMore) return;
    const requestVersion = queryVersionRef.current[tab];
    setTabBucket(tab, state => ({ ...state, loadingMore: true }));
    try {
      if (tab === "Mine") {
        if (current.threads.length >= current.total) return;
        const nextPage = current.page + 1;
        const res = await apiGet<ThreadListResponse>(buildMineQuery(nextPage));
        if (requestVersion !== queryVersionRef.current[tab]) return;
        setTabBucket(tab, state => ({
          ...state,
          threads: uniqueByThreadId([...state.threads, ...res.data]),
          page: nextPage,
          total: res.total,
        }));
        return;
      }

      if (!current.nextCursor) return;
      let nextThreads: ThreadOut[];
      let nextCursor: string | null;
      if (tab === "MyFeed") {
        const res = await getMyFeed(sortMode, { cursor: current.nextCursor, limit: PAGE_SIZE });
        nextThreads = toThreadOutList(res.data);
        nextCursor = res.next_cursor;
      } else if (tab === "Explore") {
        const res = await getExploreFeed(sortMode, { cursor: current.nextCursor, limit: PAGE_SIZE });
        nextThreads = toThreadOutList(res.data);
        nextCursor = res.next_cursor;
      } else {
        const cursorParam = encodeURIComponent(current.nextCursor);
        const res = await apiGet<FollowingFeedListResponse>(`feed/following?limit=${PAGE_SIZE}&cursor=${cursorParam}`);
        nextThreads = toThreadOutList(res.data);
        nextCursor = res.next_cursor;
      }
      if (requestVersion !== queryVersionRef.current[tab]) return;
      setTabBucket(tab, state => {
        const merged = uniqueByThreadId([...state.threads, ...nextThreads]);
        return {
          ...state,
          threads: merged,
          nextCursor,
          total: merged.length,
        };
      });
    } catch {
      // ignore load-more errors to avoid interrupting reading flow
    } finally {
      setTabBucket(tab, state => ({ ...state, loadingMore: false }));
    }
  }

  async function refreshTop() {
    if (tab === "Mine" || topRefreshing[tab]) return;
    setTopRefreshing(prev => ({ ...prev, [tab]: true }));
    try {
      const latest = await requestFirstPage(tab);
      setTabBucket(tab, state => {
        const merged = uniqueByThreadId([...latest.threads, ...state.threads]);
        return {
          ...state,
          threads: merged,
          total: merged.length,
          page: 1,
          nextCursor: latest.nextCursor,
          hasFetched: true,
          error: null,
        };
      });
    } catch {
      // keep current content when refresh fails
    } finally {
      setTopRefreshing(prev => ({ ...prev, [tab]: false }));
    }
  }

  useEffect(() => {
    const el = listPanelRef.current;
    if (!el) return;
    const saveScroll = () => {
      tabScrollRef.current[tab] = el.scrollTop;
    };
    saveScroll();
    el.addEventListener("scroll", saveScroll);
    return () => el.removeEventListener("scroll", saveScroll);
  }, [tab]);

  useEffect(() => {
    const saved = tabScrollRef.current[tab] ?? 0;
    requestAnimationFrame(() => {
      if (listPanelRef.current) {
        listPanelRef.current.scrollTop = saved;
      }
    });
  }, [tab]);


  const hasMore = tab === "Mine" ? threads.length < total : nextCursor !== null;
  const activeThread = threads.find(t => t.id === activeThreadId) ?? null;

  // After thread created → prepend + select + switch to detail
  function handleThreadCreated(thread: ThreadOut) {
    setTabBucket(tab, state => {
      const merged = uniqueByThreadId([thread, ...state.threads]);
      return {
        ...state,
        threads: merged,
        total: tab === "Mine" ? Math.max(state.total + 1, merged.length) : merged.length,
      };
    });
    setActiveThreadId(thread.id);
    setRightPanel("detail");
  }

  function handleThreadUpdated(updated: ThreadOut) {
    const patch = (ts: ThreadOut[]) => ts.map(item => (item.id === updated.id ? updated : item));
    setTabState(prev => ({
      MyFeed:    { ...prev.MyFeed,    threads: patch(prev.MyFeed.threads) },
      Following: { ...prev.Following, threads: patch(prev.Following.threads) },
      Explore:   { ...prev.Explore,   threads: patch(prev.Explore.threads) },
      Mine:      { ...prev.Mine,      threads: patch(prev.Mine.threads) },
    }));
  }

  async function handleThreadLike(threadId: string, currentlyLiked: boolean) {
    if (!user) return;
    const patch = (ts: ThreadOut[]) => ts.map(item =>
      item.id === threadId
        ? { ...item, liked_by_me: !currentlyLiked, like_count: item.like_count + (currentlyLiked ? -1 : 1) }
        : item
    );
    setTabState(prev => ({
      MyFeed:    { ...prev.MyFeed,    threads: patch(prev.MyFeed.threads) },
      Following: { ...prev.Following, threads: patch(prev.Following.threads) },
      Explore:   { ...prev.Explore,   threads: patch(prev.Explore.threads) },
      Mine:      { ...prev.Mine,      threads: patch(prev.Mine.threads) },
    }));
    try {
      await apiPost(`threads/${threadId}/like`, {});
    } catch {
      // revert
      const revert = (ts: ThreadOut[]) => ts.map(item =>
        item.id === threadId
          ? { ...item, liked_by_me: currentlyLiked, like_count: item.like_count + (currentlyLiked ? 1 : -1) }
          : item
      );
      setTabState(prev => ({
        MyFeed:    { ...prev.MyFeed,    threads: revert(prev.MyFeed.threads) },
        Following: { ...prev.Following, threads: revert(prev.Following.threads) },
        Explore:   { ...prev.Explore,   threads: revert(prev.Explore.threads) },
        Mine:      { ...prev.Mine,      threads: revert(prev.Mine.threads) },
      }));
    }
  }

  function handleThreadDeleted(threadId: string) {
    const removedInCurrentTab = threads.some(item => item.id === threadId);
    if (!removedInCurrentTab) return;
    const filter = (ts: ThreadOut[]) => ts.filter(item => item.id !== threadId);
    const sub = (prev: TabState) => Math.max(0, prev.total - (prev.threads.some(item => item.id === threadId) ? 1 : 0));
    setTabState(prev => ({
      MyFeed:    { ...prev.MyFeed,    threads: filter(prev.MyFeed.threads),    total: sub(prev.MyFeed) },
      Following: { ...prev.Following, threads: filter(prev.Following.threads), total: sub(prev.Following) },
      Explore:   { ...prev.Explore,   threads: filter(prev.Explore.threads),   total: sub(prev.Explore) },
      Mine:      { ...prev.Mine,      threads: filter(prev.Mine.threads),      total: sub(prev.Mine) },
    }));
    setActiveThreadId(current => {
      if (current !== threadId) return current;
      return threads.find(item => item.id !== threadId)?.id ?? null;
    });
  }

  // Card click — desktop: toggle preview; mobile: navigate
  function handleCardClick(thread: ThreadOut) {
    if (window.innerWidth >= 1100) {
      if (activeThreadId === thread.id && rightPanel === "detail") {
        setActiveThreadId(null); // deselect → collapse panel
      } else {
        setActiveThreadId(thread.id);
        setRightPanel("detail");
      }
    } else {
      router.push(`/threads/${thread.id}`);
    }
  }

  function handleNewThreadClick() {
    if (window.innerWidth >= 1100) {
      setRightPanel("create");
      return;
    }
    router.push("/threads/new");
  }

  function handleTabClick(nextTab: TabKey) {
    if ((nextTab === "Mine" || nextTab === "MyFeed") && !user?.id) {
      router.push("/login?from=/threads");
      return;
    }
    if (listPanelRef.current) {
      tabScrollRef.current[tab] = listPanelRef.current.scrollTop;
    }
    setTab(nextTab);
  }

  function handleTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentTab: TabKey) {
    if (enabledTabs.length < 2) return;
    const currentIndex = enabledTabs.indexOf(currentTab);
    if (currentIndex === -1) return;

    let nextTab: TabKey | null = null;
    if (event.key === "ArrowRight") {
      nextTab = enabledTabs[(currentIndex + 1) % enabledTabs.length]!;
    } else if (event.key === "ArrowLeft") {
      nextTab = enabledTabs[(currentIndex - 1 + enabledTabs.length) % enabledTabs.length]!;
    } else if (event.key === "Home") {
      nextTab = enabledTabs[0]!;
    } else if (event.key === "End") {
      nextTab = enabledTabs[enabledTabs.length - 1]!;
    }

    if (!nextTab || nextTab === currentTab) return;
    event.preventDefault();
    handleTabClick(nextTab);
    requestAnimationFrame(() => {
      tabButtonRefs.current[nextTab]?.focus();
    });
  }

  if (initialLoad) return <PageLoader />;

  return (
    <>
      <WorkspaceShell wrapPanel={false} sidebarProps={{ hideChannels: true }} contentColumns={contentColumns}>

      {/* ── Thread list ── */}
        <section className="ws-panel list-panel">
        <div className="panel-header">
          <div className="header-top">
            <div>
              <div className="header-title-row">
                <h1 className="header-title">Threads</h1>
                {!loading && <span className="thread-count">{total.toLocaleString()}</span>}
              </div>
            </div>
            <div className="header-actions">
              {isFeedTab && (
                <button
                  type="button"
                  className="refresh-icon-btn"
                  onClick={refreshTop}
                  disabled={topRefreshing[tab]}
                  title="Refresh feed"
                  aria-label="Refresh feed"
                >
                  <RefreshCw size={14} className={topRefreshing[tab] ? "spin" : undefined} />
                </button>
              )}
              <button type="button" className="new-btn" onClick={handleNewThreadClick}>
                <Plus size={14} /> New Thread
              </button>
            </div>
          </div>

          {tab === "Mine" && (
            <label className="search-bar" htmlFor={searchInputId}>
              <Search size={15} className="search-icon" aria-hidden="true" />
              <input
                id={searchInputId}
                placeholder="Search threads..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => setSearch("")}
                  style={{ border: "none", background: "transparent", color: "#5a5a72", cursor: "pointer", display: "flex", padding: 2 }}
                >
                  <X size={12} />
                </button>
              )}
            </label>
          )}

          <div className="tab-bar" role="tablist" aria-label="Thread filters">
            {tabOptions.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`tab${tab === key ? " active" : ""}`}
                onClick={() => handleTabClick(key)}
                onKeyDown={e => handleTabKeyDown(e, key)}
                ref={node => { tabButtonRefs.current[key] = node; }}
                role="tab"
                id={`threads-tab-${key.toLowerCase()}`}
                aria-selected={tab === key}
                aria-controls="threads-list-panel"
                tabIndex={tab === key ? 0 : -1}
                aria-disabled={(key === "Mine" || key === "MyFeed") && !user?.id}
                disabled={(key === "Mine" || key === "MyFeed") && !user?.id}
                title={(key === "Mine" || key === "MyFeed") && !user?.id ? "Sign in to use this tab" : undefined}
              >
                {label}
              </button>
            ))}
            {isSortableTab && (
              <div className="sort-toggle">
                <button
                  type="button"
                  className={`sort-icon-btn${sortMode === "recent" ? " active" : ""}`}
                  onClick={() => setSortMode("recent")}
                  title="Most Recent"
                >
                  <Clock size={13} />
                </button>
                <button
                  type="button"
                  className={`sort-icon-btn${sortMode === "trending" ? " active" : ""}`}
                  onClick={() => setSortMode("trending")}
                  title="Trending"
                >
                  <TrendingUp size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div ref={listPanelRef} className="thread-list ws-scroll" id="threads-list-panel" role="tabpanel" aria-labelledby={`threads-tab-${tab.toLowerCase()}`}>
          {tab === "MyFeed" && !topicsSelected && !topicsSkipped && (
            <div className="banner-wrapper">
              <TopicPickerBanner
                availableTopics={availableTopics}
                loading={topicsLoading}
                saving={topicsSaving}
                onSave={async (topics) => {
                  await saveTopics(topics);
                  setTabBucket("MyFeed", () => createEmptyTabState());
                }}
                onSkip={() => {
                  setTopicsSkipped(true);
                  setTabBucket("MyFeed", () => createEmptyTabState());
                }}
              />
            </div>
          )}
          {loading
            ? Array.from({ length: 5 }, (_, i) => <ThreadSkeleton key={i} />)
            : <>
                {threads.map(thread => {
                  const tone = statusTone(thread.status);
                  const [g1, g2] = avatarSeed(thread.author_id);
                  const authorLabel = thread.author_display_name ?? thread.author_username ?? shortId(thread.author_id);
                  const authorProfileHref = userProfileHref(thread.author_id, thread.author_username);
                  const selected = activeThreadId === thread.id;

                  return (
                    <article
                      key={thread.id}
                      className={`thread-card${selected ? " selected" : ""}`}
                      onClick={() => handleCardClick(thread)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleCardClick(thread);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open thread: ${thread.title}`}
                    >
                      {/* Author identity row */}
                      <div className="tc-author-row">
                        <span className="tc-av" style={{ background: `linear-gradient(135deg,${g1},${g2})` }}>
                          {initials(authorLabel)}
                        </span>
                        <UserHoverCard
                          userId={thread.author_id}
                          username={thread.author_username ?? ""}
                          displayName={authorLabel}
                          isBot={thread.author_is_bot}
                        >
                          <Link
                            href={authorProfileHref}
                            className="tc-name-link"
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => e.stopPropagation()}
                            aria-label={`Open profile of ${authorLabel}`}
                          >
                            <span className="tc-author-name">{authorLabel}</span>
                            {thread.author_is_bot && <span className="tc-bot-badge">BOT</span>}
                          </Link>
                        </UserHoverCard>
                        <span className="tc-time">{relativeTime(thread.created_at)}</span>
                      </div>

                      <h3 className="tc-title">{thread.title}</h3>
                      <p className="tc-body">{thread.body}</p>

                      <div className="tc-footer">
                        <div className="tc-tags">
                          {thread.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="tc-tag">#{tag}</span>
                          ))}
                          {thread.tags.length > 3 && <span className="tc-tag-more">+{thread.tags.length - 3}</span>}
                        </div>
                        <div className="tc-footer-right">
                          {thread.status !== "open" && (
                            <span className="tc-status" style={{ color: tone.text, background: tone.bg, border: `1px solid ${tone.border}` }}>{tone.label}</span>
                          )}
                          <button
                            type="button"
                            className={thread.liked_by_me ? "tc-like liked" : "tc-like"}
                            onClick={e => { e.stopPropagation(); handleThreadLike(thread.id, thread.liked_by_me); }}
                            title={user ? (thread.liked_by_me ? "Unlike" : "Like") : "Sign in to like"}
                          >
                            <Heart size={12} fill={thread.liked_by_me ? "currentColor" : "none"} />
                            {thread.like_count > 0 && thread.like_count}
                          </button>
                          <span className="tc-replies" aria-label={`${thread.post_count} ${thread.post_count === 1 ? "reply" : "replies"}`}>
                            <MessageSquare size={12} />
                            {thread.post_count}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {!loading && threads.length === 0 && !(tab === "MyFeed" && !topicsSelected && !topicsSkipped) && (
                  <div className="empty">
                    <MessageSquare size={26} strokeWidth={1.2} />
                    <span>
                      {tab === "Mine" && debouncedSearch
                        ? `No threads matching "${debouncedSearch}"`
                        : tab === "Mine"
                        ? "You haven't created any threads yet."
                        : tab === "Following"
                        ? "Follow people to see their threads here."
                        : tab === "MyFeed"
                        ? "No threads yet for your topics. Try Explore."
                        : "No threads yet. Start the first one!"}
                    </span>
                    {tab === "MyFeed" && (
                      <button type="button" className="empty-link" onClick={() => handleTabClick("Explore")}>
                        Browse Explore →
                      </button>
                    )}
                  </div>
                )}

                {hasMore && (
                  <button type="button" className="load-more" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading..." : (tab === "Mine" ? `Load more (${Math.max(total - threads.length, 0)} remaining)` : "Load more")}
                  </button>
                )}
              </>
          }
        </div>
      </section>

      {/* ── Drag handle: list ↔ detail ── */}
      {detailOpen && <div className="ws-drag" onMouseDown={onListDragStart} />}

      {/* ── Right panel (desktop) ── */}
      {detailOpen && <aside className="ws-panel right-col">
        {rightPanel === "create" ? (
          <CreatePanel onClose={() => setRightPanel("detail")} onCreated={handleThreadCreated} />
        ) : (
          <DetailPanel
            thread={activeThread}
            onClose={() => setActiveThreadId(null)}
            onThreadUpdated={handleThreadUpdated}
            onThreadDeleted={handleThreadDeleted}
          />
        )}
      </aside>}
      </WorkspaceShell>

      <style jsx>{`
        /* ── Root ── */
        .root {
          height: 100vh;
          display: grid;
          /* grid-template-columns set via inline style for resizable panels */
          grid-template-rows: 1fr;
          align-items: stretch;
          gap: 0;
          background: #0c0c10;
          color: #e8e8f0;
          font-family: var(--font-dm-sans), sans-serif;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }
        /* ── WorkspaceSidebar override for grid context ── */
        .root :global(.sidebar) {
          position: relative !important;
          top: 0 !important;
          height: 100vh !important;
          max-height: 100vh !important;
          border-radius: 0;
          box-shadow: none;
          border-top: none;
          border-bottom: none;
          border-left: none;
        }

        /* ── Drag handles ── */
        .drag-handle {
          width: 6px; cursor: col-resize;
          position: relative; z-index: 5;
          display: flex; align-items: center; justify-content: center;
          background: #0c0c10;
        }
        .drag-handle::after {
          content: ""; width: 2px; height: 32px; border-radius: 2px;
          background: rgba(255,255,255,0.1); transition: background 0.15s, height 0.15s;
        }
        .drag-handle:hover::after { background: #6366f1; height: 48px; }

        /* ── List panel ── */
        .list-panel { min-width: 0; }
        .panel-header {
          padding: 20px 20px 0; flex-shrink: 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: #13131a; position: relative;
        }
        .panel-header::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, #f97316, transparent 60%); opacity: 0.4;
        }
        .header-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
        .header-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .header-title-row { display: flex; align-items: center; gap: 8px; }
        .header-title {
          font-family: var(--font-syne), sans-serif; font-size: 22px; font-weight: 800;
          letter-spacing: -0.5px; margin: 0; color: #e8e8f0;
        }
        .thread-count {
          font-size: 13px; font-weight: 600; color: #5a5a72;
          margin-left: -2px;
        }
        .new-btn {
          display: flex; align-items: center; gap: 6px;
          background: #f97316; color: #fff; border: none; border-radius: 9px; padding: 7px 13px;
          font-family: var(--font-dm-sans), sans-serif; font-size: 12.5px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(249,115,22,0.3); white-space: nowrap;
        }
        .new-btn:hover { background: #fb923c; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(249,115,22,0.4); }
        .new-btn:active { transform: translateY(0); }
        .refresh-icon-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 32px; height: 32px;
          border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #9090a8;
          border-radius: 8px; cursor: pointer; transition: all 0.2s;
        }
        .refresh-icon-btn:hover:not(:disabled) {
          border-color: rgba(255,255,255,0.22); color: #e8e8f0; background: rgba(255,255,255,0.07);
        }
        .refresh-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .search-bar {
          display: flex; align-items: center; gap: 10px;
          background: #1a1a24; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 9px 14px; margin-bottom: 14px;
          transition: all 0.2s; cursor: text;
        }
        .search-bar:focus-within { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.18); }
        .search-icon { color: #5a5a72; flex-shrink: 0; }
        .search-bar input {
          border: none; background: transparent; outline: none;
          color: #e8e8f0; font-family: var(--font-dm-sans), sans-serif; font-size: 13.5px; flex: 1;
        }
        .search-bar input::placeholder { color: #5a5a72; }
        .tab-bar { display: flex; align-items: center; margin-bottom: -1px; }
        .tab {
          padding: 8px 12px; font-size: 13px; font-weight: 500; color: #9090a8;
          cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; white-space: nowrap;
          border-top: none; border-left: none; border-right: none;
          background: transparent; font-family: var(--font-dm-sans), sans-serif;
        }
        .tab:hover { color: #e8e8f0; }
        .tab.active { color: #f97316; border-bottom-color: #f97316; }
        .tab:disabled { opacity: 0.4; cursor: not-allowed; }
        .tab:focus-visible { outline: 2px solid rgba(249,115,22,0.45); outline-offset: 2px; border-radius: 4px; }

        /* ── Sort toggle (compact icons in tab bar) ── */
        .sort-toggle {
          display: flex; gap: 2px; margin-left: auto; flex-shrink: 0;
          padding-right: 4px;
        }
        .sort-icon-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 6px;
          border: 1px solid transparent; background: transparent;
          color: #5a6280; cursor: pointer; transition: all 0.15s;
          font-family: var(--font-dm-sans), sans-serif;
        }
        .sort-icon-btn:hover { color: #b0b8d1; background: rgba(255,255,255,0.04); }
        .sort-icon-btn.active { color: #f0834a; background: rgba(240,131,74,0.08); border-color: rgba(240,131,74,0.25); }

        /* ── Topic picker banner ── */
        .banner-wrapper { padding: 16px 20px 0; }

        /* ── Thread list scrollable body ── */
        .thread-list { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 0; }

        /* ── Thread cards ── */
        .thread-card {
          padding: 16px 20px;
          border: none; border-bottom: 1px solid rgba(255,255,255,0.07);
          cursor: pointer; transition: all 0.15s ease; position: relative;
          width: 100%; text-align: left; background: transparent;
          color: inherit; font-family: var(--font-dm-sans), sans-serif;
          animation: fadeIn 0.3s ease both;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .thread-card:nth-child(1) { animation-delay: 0.05s; }
        .thread-card:nth-child(2) { animation-delay: 0.1s; }
        .thread-card:nth-child(3) { animation-delay: 0.15s; }
        .thread-card:nth-child(4) { animation-delay: 0.2s; }
        .thread-card:nth-child(5) { animation-delay: 0.25s; }
        .thread-card:hover { background: rgba(255,255,255,0.025); }
        .thread-card.selected { background: #1a1a24; border-left: 2px solid #f97316; padding-left: 18px; }
        .thread-card:focus-visible { outline: 2px solid rgba(249,115,22,0.45); outline-offset: -2px; }

        /* ── Author row ── */
        .tc-author-row { display: flex; align-items: center; gap: 6px; margin-bottom: 9px; }
        .tc-av {
          width: 22px; height: 22px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0;
        }
        .tc-name-link {
          display: flex; align-items: center; gap: 5px;
          text-decoration: none; border-radius: 4px; padding: 1px 4px 1px 0;
          transition: all 0.15s; flex-shrink: 0;
        }
        .tc-name-link:hover .tc-author-name { color: #f0834a; }
        .tc-name-link:focus-visible { outline: 2px solid rgba(249,115,22,0.45); outline-offset: 1px; }
        .tc-author-name {
          font-size: 12px; font-weight: 600; color: #7a7a96;
          font-family: var(--font-syne), sans-serif; transition: color 0.15s;
        }
        .tc-bot-badge {
          font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px;
          border: 1px solid rgba(124,115,240,0.5); color: #9d97f0;
          background: rgba(124,115,240,0.1); letter-spacing: 0.04em;
        }
        .tc-time { font-size: 11px; color: #4a4a62; margin-left: auto; flex-shrink: 0; }
        .tc-status {
          font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
          padding: 2px 8px; border-radius: 4px;
        }
        .tc-title {
          font-family: var(--font-syne), sans-serif; font-size: 15px; font-weight: 700;
          line-height: 1.35; margin: 0 0 6px; letter-spacing: -0.2px; color: #eef1fa;
        }
        .tc-body {
          font-size: 13px; color: #9090a8; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          margin-bottom: 10px;
        }
        .tc-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 20px; }
        .tc-footer-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .tc-tags { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
        .tc-tag {
          font-size: 11px; font-weight: 500; color: #5a5a72;
          background: rgba(255,255,255,0.04); padding: 2px 8px; border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.07); transition: all 0.15s;
        }
        .tc-tag:hover { background: rgba(99,102,241,0.12); color: #a5b4fc; border-color: rgba(99,102,241,0.25); }
        .tc-tag-more { font-size: 11px; color: #4a4a62; }
        .tc-replies { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #4a4a62; }
        .tc-like { border: none; background: transparent; color: #4a4a62; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; padding: 2px 6px; border-radius: 5px; transition: all 0.15s; font-family: inherit; }
        .tc-like:hover { color: #f06b6b; background: rgba(240,107,107,0.1); }
        .tc-like.liked { color: #f06b6b; }

        /* Empty + error + load-more */
        .empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; color: #5a5a72; font-size: 13px; padding: 60px 20px; text-align: center;
        }
        .empty-link {
          background: none; border: none; color: #f0834a; font-size: 13px;
          cursor: pointer; text-decoration: underline; text-underline-offset: 3px; padding: 0;
          font-family: var(--font-dm-sans), sans-serif;
        }
	        .error-banner {
	          margin: 8px 20px 0;
	          border: 1px solid rgba(240,107,107,0.35); background: rgba(240,107,107,0.1);
	          color: #fca5a5; border-radius: 8px; padding: 8px 12px; font-size: 12px;
	        }
	        .info-banner {
	          margin: 8px 0 0;
	          border: 1px solid rgba(73, 191, 141, 0.35);
	          background: rgba(73, 191, 141, 0.12);
	          color: #9fe1c4;
	          border-radius: 8px;
	          padding: 8px 12px;
	          font-size: 12px;
	        }
        .load-more {
          display: block; width: calc(100% - 40px); margin: 8px 20px;
          padding: 10px; border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 8px; background: transparent; cursor: pointer;
          font-size: 12px; color: #9090a8; font-family: var(--font-dm-sans), sans-serif;
          transition: all 0.15s;
        }
        .load-more:hover:not(:disabled) { border-color: rgba(255,255,255,0.2); color: #e8e8f0; }
        .load-more:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Right col ── */
        .right-col { min-width: 0; }

        /* ── Responsive ── */
        @media (max-width: 1100px) {
          :global(.ws-root) { grid-template-columns: 220px 6px 1fr !important; }
          .right-col { display: none; }
          :global(.ws-drag) { display: none; }
        }
        @media (max-width: 860px) {
          :global(.ws-root) { padding-top: 56px; }
        }
      `}</style>
    </>
  );
}
