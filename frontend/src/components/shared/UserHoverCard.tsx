"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, MessageCircle, MessageSquare, ShieldBan, UserPlus } from "lucide-react";
import { useFollow } from "@/hooks/useFollow";
import { useConnection } from "@/hooks/useConnection";
import { profilePathFromUsername, toProfilePath } from "@/lib/profileRouting";
import { avatarSeed, initials } from "@/lib/workspaceUtils";

type UserHoverCardProps = {
  userId: string;
  username: string;
  displayName: string;
  bio?: string | null;
  isBot?: boolean;
  children: React.ReactNode;
};

export default function UserHoverCard({
  userId,
  username,
  displayName,
  bio,
  isBot,
  children,
}: UserHoverCardProps) {
  const router = useRouter();
  const [showCard, setShowCard] = useState(false);
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const { isFollowing, loading: followLoading, follow, unfollow } = useFollow(userId, false);
  const {
    isConnected,
    hasPendingRequest,
    isRequester,
    pendingRequestId,
    canMessage,
    blockedByMe,
    blockedYou,
    loading: connLoading,
    sendRequest,
    acceptRequest,
  } = useConnection(userId);
  const [av1, av2] = avatarSeed(userId);
  const profilePath = username?.trim() ? profilePathFromUsername(username) : toProfilePath(userId);

  const handleMouseEnter = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCardPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
    setShowCard(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowCard(false);
  }, []);

  const handleFollowClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isFollowing) {
        await unfollow();
      } else {
        await follow();
      }
    },
    [isFollowing, follow, unfollow],
  );

  const handleConnectionClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (canMessage) {
        router.push(`/messages?start=${encodeURIComponent(userId)}`);
        return;
      }
      if (hasPendingRequest && !isRequester && pendingRequestId) {
        await acceptRequest(pendingRequestId);
        return;
      }
      await sendRequest();
    },
    [acceptRequest, canMessage, hasPendingRequest, isRequester, pendingRequestId, router, sendRequest, userId],
  );

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="user-hover-trigger"
      >
        {children}
      </div>

      {showCard && (
        <div
          ref={cardRef}
          className="user-hover-card"
          style={{
            position: "fixed",
            top: `${cardPosition.top}px`,
            left: `${cardPosition.left}px`,
            zIndex: 999,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="card-content">
            <Link href={profilePath} className="card-header">
              <div className="card-avatar" style={{ background: `linear-gradient(135deg,${av1},${av2})` }}>
                {initials(displayName)}
              </div>
              <div className="card-header-info">
                <div className="card-name">{displayName}</div>
                <div className="card-username">@{username}</div>
                {isBot && <div style={{ fontSize: 11, color: "#9d97f0", marginTop: 2 }}>Automated Account</div>}
              </div>
            </Link>

            {bio && <p className="card-bio">{bio}</p>}

            <div className="card-buttons">
              <button
                type="button"
                className={`card-btn ${isConnected ? "connected" : hasPendingRequest ? "pending" : ""}`}
                onClick={handleConnectionClick}
                disabled={connLoading || blockedByMe || blockedYou || (isConnected && !canMessage) || (hasPendingRequest && isRequester)}
                title={
                  canMessage
                    ? "Open direct messages"
                    : blockedByMe
                      ? "You blocked this user"
                      : blockedYou
                        ? "This user blocked you"
                        : isConnected
                          ? "Connected, but messaging is unavailable right now"
                          : hasPendingRequest
                            ? isRequester
                              ? "Request sent - waiting for response"
                              : "Accept this connection request"
                            : "Send connection request to message"
                }
              >
                {canMessage ? (
                  <>
                    <MessageSquare size={13} /> Message
                  </>
                ) : blockedByMe || blockedYou ? (
                  <>
                    <ShieldBan size={13} /> {blockedByMe ? "Blocked" : "Cannot message"}
                  </>
                ) : isConnected ? (
                  <>
                    <MessageSquare size={13} /> Connected
                  </>
                ) : hasPendingRequest && !isRequester && pendingRequestId ? (
                  <>
                    <Check size={13} /> Accept
                  </>
                ) : hasPendingRequest ? (
                  <>
                    <Clock size={13} /> {isRequester ? "Pending" : "Requested"}
                  </>
                ) : (
                  <>
                    <UserPlus size={13} /> {connLoading ? "..." : "Connect"}
                  </>
                )}
              </button>

              <button
                type="button"
                className={`card-btn ${isFollowing ? "following" : ""}`}
                onClick={handleFollowClick}
                disabled={followLoading}
              >
                <MessageCircle size={13} />
                {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .user-hover-trigger {
          display: inline;
          position: relative;
        }
        .user-hover-card {
          animation: slideUp 0.15s ease-out;
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .card-content {
          background: linear-gradient(135deg, #121a2c 0%, #101626 100%);
          border: 1px solid #2a3554;
          border-radius: 12px;
          padding: 14px;
          width: 280px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(12px);
        }
        .card-header {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .card-header:hover {
          opacity: 0.8;
        }
        .card-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .card-header-info {
          flex: 1;
          min-width: 0;
        }
        .card-name {
          font-size: 14px;
          font-weight: 700;
          color: #e4e8f4;
          margin-bottom: 2px;
        }
        .card-username {
          font-size: 12px;
          color: #8591b3;
        }
        .card-bio {
          font-size: 13px;
          color: #b0b8d1;
          line-height: 1.4;
          margin: 0 0 12px;
          max-height: 60px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .card-buttons {
          display: flex;
          gap: 8px;
          flex-direction: column;
        }
        .card-btn {
          padding: 8px 12px;
          border: 1px solid transparent;
          border-radius: 8px;
          background: rgba(240, 131, 74, 0.18);
          color: #ffb380;
          border-color: rgba(240, 131, 74, 0.28);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s ease;
          font-family: inherit;
          flex: 1;
        }
        .card-btn:hover:not(:disabled) {
          background: rgba(240, 131, 74, 0.25);
          border-color: rgba(240, 131, 74, 0.38);
        }
        .card-btn.following {
          background: rgba(61, 214, 140, 0.18);
          color: #90e7be;
          border-color: rgba(61, 214, 140, 0.28);
        }
        .card-btn.following:hover:not(:disabled) {
          background: rgba(61, 214, 140, 0.25);
          border-color: rgba(61, 214, 140, 0.38);
        }
        .card-btn.connected {
          background: rgba(61, 214, 140, 0.18);
          color: #90e7be;
          border-color: rgba(61, 214, 140, 0.28);
        }
        .card-btn.connected:hover:not(:disabled) {
          background: rgba(61, 214, 140, 0.25);
          border-color: rgba(61, 214, 140, 0.38);
        }
        .card-btn.pending {
          background: rgba(229, 192, 123, 0.18);
          color: #f0c78a;
          border-color: rgba(229, 192, 123, 0.28);
        }
        .card-btn.pending:hover:not(:disabled) {
          background: rgba(229, 192, 123, 0.25);
          border-color: rgba(229, 192, 123, 0.38);
        }
        .card-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}
