"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, MailPlus, MessageSquare, Search, SendHorizontal, ShieldBan, ShieldOff } from "lucide-react";

import PageLoader from "@/components/shared/PageLoader";
import WorkspaceShell from "@/components/app/WorkspaceShell";
import { useDragResize } from "@/hooks/useDragResize";
import { useMessages } from "@/hooks/useMessages";
import { getConnections } from "@/lib/connectionApi";
import { avatarSeed, initials, relativeTime } from "@/lib/workspaceUtils";
import { useAuthStore } from "@/store/authStore";
import type { ConnectionOut } from "@/types/connection";
import type { Message } from "@/types/message";

type MessagesWorkspaceProps = {
  conversationId?: string;
};

type LocalMessage = Message & {
  delivery_state: "sending" | "failed";
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildTempMessage(conversationId: string, content: string, sequence: number): LocalMessage {
  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: conversationId,
    sender_id: "self",
    content,
    sequence,
    created_at: new Date().toISOString(),
    edited_at: null,
    deleted_at: null,
    is_deleted: false,
    is_own: true,
    delivery_state: "sending",
  };
}

export default function MessagesWorkspace({ conversationId }: MessagesWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { width: convWidth, onDragStart: onConvDrag } = useDragResize(300, 240, 420);
  const {
    conversations,
    activeConversation,
    messages,
    unreadCount,
    conversationsLoading,
    messagesLoading,
    error,
    createConversation,
    sendMessage,
    markRead,
    blockUser,
    unblockUser,
  } = useMessages({ conversationId });

  const [mounted, setMounted] = useState(false);
  const [connections, setConnections] = useState<ConnectionOut[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Record<string, LocalMessage[]>>({});
  const listValue = useDeferredValue(listQuery.trim().toLowerCase());
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const startTargetId = searchParams.get("start");

  const currentOptimisticMessages = conversationId ? optimisticMessages[conversationId] ?? [] : [];
  const displayMessages = [...messages, ...currentOptimisticMessages];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (!user?.id) {
      router.replace(`/login?from=/messages`);
    }
  }, [mounted, user?.id, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setConnectionsLoading(true);
    void getConnections(user.id, 1, 100)
      .then((response) => {
        if (!cancelled) setConnections(response.data);
      })
      .catch((fetchError) => {
        if (!cancelled) setActionError(toErrorMessage(fetchError, "Failed to load connections"));
      })
      .finally(() => {
        if (!cancelled) setConnectionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!startTargetId || conversationId) return;
    let cancelled = false;
    void createConversation(startTargetId)
      .then((conversation) => {
        if (!cancelled) router.replace(`/messages/${conversation.id}`);
      })
      .catch((createError) => {
        if (!cancelled) setActionError(toErrorMessage(createError, "Failed to open conversation"));
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, createConversation, router, startTargetId]);

  useEffect(() => {
    if (!conversationId) return;
    const latestMessageId = messages[messages.length - 1]?.id;
    if (!latestMessageId || !activeConversation || activeConversation.unread_count <= 0) return;
    const timeoutId = window.setTimeout(() => {
      void markRead(conversationId, latestMessageId);
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [activeConversation, conversationId, markRead, messages]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [conversationId, displayMessages.length]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [composer]);

  const filteredConversations = useMemo(() => {
    if (!listValue) return conversations;
    return conversations.filter((conversation) =>
      [
        conversation.other_participant.display_name,
        conversation.other_participant.username,
        conversation.last_message_preview ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(listValue),
    );
  }, [conversations, listValue]);

  const filteredConnections = useMemo(() => {
    const source = listValue
      ? connections.filter((connection) =>
          [
            connection.connected_user_display_name ?? "",
            connection.connected_user_username ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(listValue),
        )
      : connections.slice(0, 6);
    return source.filter((connection) => connection.connected_user_id !== user?.id);
  }, [connections, listValue, user?.id]);

  if (!mounted || connectionsLoading) {
    return <PageLoader />;
  }

  const updateOptimisticMessages = (
    targetConversationId: string,
    updater: (current: LocalMessage[]) => LocalMessage[],
  ) => {
    setOptimisticMessages((current) => ({
      ...current,
      [targetConversationId]: updater(current[targetConversationId] ?? []),
    }));
  };

  const handleConnectionStart = async (targetUserId: string) => {
    const existingConversation = conversations.find((conversation) => conversation.other_participant.id === targetUserId);
    if (existingConversation) {
      router.push(`/messages/${existingConversation.id}`);
      return;
    }
    try {
      const conversation = await createConversation(targetUserId);
      router.push(`/messages/${conversation.id}`);
    } catch (createError) {
      setActionError(toErrorMessage(createError, "Failed to start conversation"));
    }
  };

  const handleSend = async (contentArg?: string, retryId?: string) => {
    if (!conversationId || !activeConversation?.can_message) return;
    const trimmed = (contentArg ?? composer).trim();
    if (!trimmed) return;

    setSending(true);
    const nextTemp =
      currentOptimisticMessages.find((message) => message.id === retryId) ??
      buildTempMessage(conversationId, trimmed, (messages[messages.length - 1]?.sequence ?? 0) + currentOptimisticMessages.length + 1);

    updateOptimisticMessages(conversationId, (current) => [
      ...current.filter((message) => message.id !== nextTemp.id),
      { ...nextTemp, content: trimmed, delivery_state: "sending" },
    ]);
    if (!retryId) setComposer("");

    try {
      await sendMessage(conversationId, trimmed);
      updateOptimisticMessages(conversationId, (current) => current.filter((message) => message.id !== nextTemp.id));
    } catch (sendError) {
      setActionError(toErrorMessage(sendError, "Failed to send message"));
      updateOptimisticMessages(conversationId, (current) =>
        current.map((message) =>
          message.id === nextTemp.id ? { ...message, delivery_state: "failed" } : message,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const handleBlockToggle = async () => {
    if (!activeConversation) return;
    setBlockBusy(true);
    try {
      if (activeConversation.blocked_by_me) {
        await unblockUser(activeConversation.other_participant.id);
      } else {
        await blockUser(activeConversation.other_participant.id);
      }
    } catch (blockError) {
      setActionError(toErrorMessage(blockError, "Failed to update block status"));
    } finally {
      setBlockBusy(false);
    }
  };

  const blockedMessage = activeConversation?.blocked_by_me
    ? "You blocked this user. Unblock them to send messages."
    : activeConversation?.blocked_you
      ? "This user blocked you. You can still read the conversation history."
      : activeConversation && !activeConversation.can_message
        ? "Messaging is unavailable for this conversation."
        : null;

  const hasNoActiveConversation = !conversationId || !activeConversation;
  const errorMessage = actionError ?? (error ? toErrorMessage(error, "Failed to load messages") : null);

  return (
    <>
      <WorkspaceShell wrapPanel={false} contentColumns={`${convWidth}px 6px 1fr`}>

      {/* ── Conversation list panel ── */}
        <section className={`ws-panel list-panel${conversationId ? " mob-hide" : ""}`}>
        <div className="panel-hd">
          <div>
            <p className="eyebrow">Inbox</p>
            <h1 className="panel-title">Messages</h1>
          </div>
          {unreadCount > 0 && <span className="pill">{unreadCount}</span>}
        </div>

        <label className="search-bar" htmlFor="msg-search">
          <Search size={14} />
          <input
            id="msg-search"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder="Search conversations…"
          />
        </label>

        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        <div className="conv-scroll ws-scroll">
          <div className="section">
            <p className="section-hd"><MailPlus size={13} /> Start a conversation</p>
            {(!mounted || connectionsLoading) && <p className="empty-copy">Loading connections…</p>}
            {mounted && !connectionsLoading && filteredConnections.length === 0 && (
              <p className="empty-copy">No connections yet.</p>
            )}
            {filteredConnections.map((connection) => {
              const label = connection.connected_user_display_name ?? connection.connected_user_username ?? "Connection";
              const [seedA, seedB] = avatarSeed(connection.connected_user_id);
              return (
                <button key={connection.id} type="button" className="conv-row" onClick={() => void handleConnectionStart(connection.connected_user_id)}>
                  <div className="avatar" style={{ background: `linear-gradient(135deg, ${seedA}, ${seedB})` }}>{initials(label)}</div>
                  <div className="conv-info">
                    <span className="conv-name">{label}</span>
                    <span className="conv-sub">@{connection.connected_user_username ?? "unknown"}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="section">
            <p className="section-hd"><MessageSquare size={13} /> Conversations</p>
            {(!mounted || conversationsLoading) && <p className="empty-copy">Loading…</p>}
            {mounted && !conversationsLoading && filteredConversations.length === 0 && (
              <p className="empty-copy">No conversations yet.</p>
            )}
            {filteredConversations.map((conversation) => {
              const [seedA, seedB] = avatarSeed(conversation.other_participant.id);
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`conv-row${conversation.id === conversationId ? " active" : ""}`}
                  onClick={() => router.push(`/messages/${conversation.id}`)}
                >
                  <div className="avatar" style={{ background: `linear-gradient(135deg, ${seedA}, ${seedB})` }}>
                    {initials(conversation.other_participant.display_name)}
                  </div>
                  <div className="conv-info">
                    <span className="conv-name">{conversation.other_participant.display_name}</span>
                    <span className="conv-sub">{conversation.last_message_preview ?? `@${conversation.other_participant.username}`}</span>
                  </div>
                  <div className="conv-meta">
                    {conversation.last_message_at && <span>{relativeTime(conversation.last_message_at)}</span>}
                    {conversation.unread_count > 0 && <span className="badge">{conversation.unread_count}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

        <div className="ws-drag" onMouseDown={onConvDrag} />

      {/* ── Chat panel ── */}
        <section className="ws-panel chat-panel">
        {hasNoActiveConversation ? (
          <div className="empty-state">
            <MessageSquare size={28} />
            <h2>Choose a conversation</h2>
            <p>Select a connection or start a new conversation.</p>
          </div>
        ) : (
          <>
            <div className="chat-hd">
              <button type="button" className="mobile-back" onClick={() => router.push("/messages")}>
                <ArrowLeft size={14} /> Back
              </button>
              <div className="chat-hd-info">
                <span className="chat-name">{activeConversation.other_participant.display_name}</span>
                <span className="chat-username">@{activeConversation.other_participant.username}</span>
              </div>
              <button
                type="button"
                className={`block-btn${activeConversation.blocked_by_me ? " danger" : ""}`}
                disabled={blockBusy || activeConversation.blocked_you}
                onClick={() => void handleBlockToggle()}
              >
                {activeConversation.blocked_by_me ? <ShieldOff size={13} /> : <ShieldBan size={13} />}
                {blockBusy ? "Saving…" : activeConversation.blocked_by_me ? "Unblock" : activeConversation.blocked_you ? "Blocked" : "Block"}
              </button>
            </div>

            {blockedMessage && <div className="warn">{blockedMessage}</div>}

            <div ref={threadRef} className="msg-scroll ws-scroll">
              {messagesLoading && messages.length === 0 && <p className="empty-copy">Loading messages…</p>}
              {displayMessages.length === 0 && !messagesLoading && <p className="empty-copy center">No messages yet. Say hello!</p>}
              {displayMessages.map((message, index) => {
                const prev = displayMessages[index - 1];
                const showDivider = !prev || formatDayLabel(prev.created_at) !== formatDayLabel(message.created_at);
                const local = "delivery_state" in message ? message : null;
                return (
                  <div key={message.id}>
                    {showDivider && <div className="day-divider"><span>{formatDayLabel(message.created_at)}</span></div>}
                    <div className={`msg-row${message.is_own ? " own" : ""}`}>
                      <div className={`bubble${message.is_own ? " own" : " other"}${local?.delivery_state === "failed" ? " failed" : ""}`}>
                        <p>{message.content}</p>
                        <div className="bubble-meta">
                          <span>{relativeTime(message.created_at)}</span>
                          {local?.delivery_state === "sending" && <span>Sending…</span>}
                          {local?.delivery_state === "failed" && (
                            <button type="button" className="retry-btn" onClick={() => void handleSend(message.content, message.id)}>
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="composer">
              <textarea
                ref={composerRef}
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
                }}
                placeholder={activeConversation.can_message ? "Write a message…" : "Messaging disabled"}
                disabled={!activeConversation.can_message || sending}
                rows={1}
              />
              <button
                type="button"
                className="send-btn"
                disabled={!composer.trim() || !activeConversation.can_message || sending}
                onClick={() => void handleSend()}
              >
                {sending ? <LoaderCircle size={15} className="spin" /> : <SendHorizontal size={15} />}
                Send
              </button>
            </div>
          </>
        )}
        </section>
      </WorkspaceShell>

      <style jsx>{`
        /* ── Shared panel card ── */
        .list-panel, .chat-panel { min-width: 0; }

        /* ── List panel header ── */
        .panel-hd {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 24px 20px 0;
          flex-shrink: 0;
        }
        .eyebrow {
          margin: 0 0 2px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #f0834a;
        }
        .panel-title {
          margin: 0;
          font-size: 26px;
          font-family: var(--font-dm-serif), serif;
          line-height: 1.2;
        }
        .pill, .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          border-radius: 999px;
          background: #f0834a;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 0 6px;
          flex-shrink: 0;
        }

        /* ── Search bar ── */
        .search-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 14px 20px 0;
          padding: 0 12px;
          height: 36px;
          background: #151927;
          border: 1px solid #1e2235;
          border-radius: 8px;
          color: #5a6280;
          cursor: text;
          flex-shrink: 0;
          transition: border-color 0.15s;
        }
        .search-bar:focus-within { border-color: rgba(240,131,74,0.4); }
        .search-bar input {
          flex: 1; border: none; background: transparent;
          color: #e4e8f4; font-size: 13px; outline: none; font-family: inherit;
        }
        .search-bar input::placeholder { color: #5a6280; }

        /* ── Error banner ── */
        .error-banner {
          margin: 10px 20px 0;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 12px;
          border: 1px solid rgba(240,107,107,0.35);
          background: rgba(240,107,107,0.1);
          color: #f6b0b0;
          flex-shrink: 0;
        }

        /* ── Conversation scroll ── */
        .conv-scroll {
          flex: 1; min-height: 0; overflow-y: auto; padding: 10px 0 8px;
        }

        .section { padding: 6px 12px; }
        .section + .section { border-top: 1px solid rgba(255,255,255,0.04); margin-top: 6px; padding-top: 12px; }
        .section-hd {
          display: flex; align-items: center; gap: 7px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.09em;
          text-transform: uppercase; color: #5a6280; margin: 0 0 6px;
        }
        .empty-copy {
          font-size: 12px; color: #5a6280; margin: 4px 0 6px; padding: 0 2px;
        }
        .empty-copy.center { text-align: center; padding: 24px 0; }

        .conv-row {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 7px 8px; border-radius: 10px;
          border: 1px solid transparent; background: transparent;
          color: inherit; cursor: pointer; text-align: left;
          font-family: inherit; transition: background 0.12s, border-color 0.12s;
          margin-bottom: 2px;
        }
        .conv-row:hover { background: rgba(255,255,255,0.04); border-color: #1e2235; }
        .conv-row.active { background: rgba(240,131,74,0.07); border-color: rgba(240,131,74,0.25); }
        .avatar {
          width: 36px; height: 36px; border-radius: 50%;
          display: grid; place-items: center;
          color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0;
        }
        .conv-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .conv-name {
          font-size: 13px; font-weight: 600; color: #e4e8f4;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .conv-sub {
          font-size: 11px; color: #69738f;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .conv-meta {
          display: flex; flex-direction: column; align-items: flex-end;
          gap: 4px; flex-shrink: 0; font-size: 10px; color: #5a6280;
        }

        /* ── Chat panel ── */
        .empty-state {
          margin: auto; text-align: center; display: grid; gap: 10px; color: #5a6280;
        }
        .empty-state h2 { margin: 0; font-family: var(--font-dm-serif), serif; font-size: 22px; color: #c8cedf; }
        .empty-state p { margin: 0; font-size: 13px; }

        .chat-hd {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 20px; border-bottom: 1px solid #1e2235; flex-shrink: 0;
        }
        .chat-hd-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .chat-name {
          font-size: 15px; font-weight: 700; color: #e4e8f4;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .chat-username { font-size: 11px; color: #69738f; }

        .block-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 8px;
          border: 1px solid #1e2235; background: transparent;
          color: #8891aa; font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: all 0.15s; flex-shrink: 0;
        }
        .block-btn:hover { border-color: #2b3654; color: #e4e8f4; }
        .block-btn.danger { color: #f6b0b0; border-color: rgba(240,107,107,0.35); }
        .block-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .warn {
          padding: 10px 20px; font-size: 12px; flex-shrink: 0;
          border-bottom: 1px solid rgba(240,107,107,0.2);
          background: rgba(240,107,107,0.07); color: #f6b0b0;
        }

        .msg-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 20px 0; }

        .day-divider { display: flex; justify-content: center; margin: 10px 0; }
        .day-divider span {
          font-size: 10px; color: #5a6280;
          border: 1px solid #1e2235; border-radius: 999px;
          padding: 3px 10px; background: #10131d;
        }

        .msg-row { display: flex; margin-bottom: 8px; }
        .msg-row.own { justify-content: flex-end; }
        .bubble {
          max-width: 72%; border-radius: 16px;
          padding: 10px 14px; display: grid; gap: 6px;
        }
        .bubble.own {
          background: linear-gradient(135deg, #f0834a, #e06c30);
          color: #fff; border-bottom-right-radius: 4px;
        }
        .bubble.other {
          background: #171c29; color: #e4e8f4;
          border: 1px solid #252b40; border-bottom-left-radius: 4px;
        }
        .bubble.failed { border-color: rgba(240,107,107,0.35); background: rgba(240,107,107,0.12); }
        .bubble p { margin: 0; white-space: pre-wrap; line-height: 1.6; font-size: 13px; }
        .bubble-meta { display: flex; justify-content: flex-end; gap: 8px; font-size: 10px; opacity: 0.8; }
        .retry-btn {
          border: none; padding: 0; background: transparent;
          text-decoration: underline; cursor: pointer; color: inherit; font-family: inherit; font-size: inherit;
        }

        .composer {
          border-top: 1px solid #1e2235;
          padding: 12px 20px 16px;
          display: flex; align-items: flex-end; gap: 10px; flex-shrink: 0;
        }
        .composer textarea {
          flex: 1; border: 1px solid #1e2235; background: #151927;
          color: #e4e8f4; border-radius: 12px; padding: 10px 14px;
          resize: none; outline: none; font-size: 13px; line-height: 1.55;
          font-family: inherit; min-height: 42px; transition: border-color 0.15s;
        }
        .composer textarea:focus { border-color: rgba(240,131,74,0.4); }
        .composer textarea::placeholder { color: #5a6280; }
        .composer textarea:disabled { opacity: 0.5; cursor: not-allowed; }
        .send-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 10px;
          background: linear-gradient(135deg, #f0834a, #e06c30);
          border: none; color: #fff; font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: inherit; flex-shrink: 0; transition: opacity 0.15s;
        }
        .send-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .send-btn:not(:disabled):hover { opacity: 0.88; }

        .mobile-back { display: none; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 860px) {
          :global(.ws-root) { padding-top: 56px; }
          .mob-hide { display: none; }
          .mobile-back { display: inline-flex; }
        }
      `}</style>
    </>
  );
}
