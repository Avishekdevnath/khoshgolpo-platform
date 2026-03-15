"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Users } from "lucide-react";

import ConnectionButton from "@/components/shared/ConnectionButton";
import FollowButton from "@/components/shared/FollowButton";
import { canonicalProfilePath } from "@/lib/profileRouting";
import { avatarSeed, initials } from "@/lib/workspaceUtils";
import type { ConnectionStatusResponse } from "@/types/connection";
import type { PeopleCard as PeopleCardData } from "@/types/people";

type PeopleCardProps = {
  person: PeopleCardData;
  onRelationshipChange?: () => void | Promise<void>;
};

function toConnectionStatus(person: PeopleCardData): ConnectionStatusResponse {
  return {
    is_connected: person.is_connected,
    has_pending_request: person.has_pending_request,
    is_requester: person.is_requester,
    pending_request_id: person.pending_request_id,
    can_message: person.can_message,
    blocked_by_me: person.blocked_by_me,
    blocked_you: person.blocked_you,
  };
}

function scheduleRevalidate(callback?: () => void | Promise<void>) {
  if (!callback || typeof window === "undefined") return;
  window.setTimeout(() => { void callback(); }, 450);
}

export default function PeopleCard({ person, onRelationshipChange }: PeopleCardProps) {
  const [personState, setPersonState] = useState(person);
  const [followersCount, setFollowersCount] = useState(person.followers_count);
  const [av1, av2] = avatarSeed(person.id);
  const profileHref = canonicalProfilePath({
    id: personState.id,
    username: personState.username,
    profile_slug: personState.profile_slug,
  });

  useEffect(() => {
    setPersonState(person);
    setFollowersCount(person.followers_count);
  }, [person]);

  const bioText = personState.bio?.trim();

  return (
    <article className="card">
      {/* Row 1: identity */}
      <div className="row-top">
        <Link href={profileHref} className="profile-link">
          <div className="avatar" style={{ background: `linear-gradient(135deg, ${av1}, ${av2})` }}>
            {initials(personState.display_name || personState.username)}
          </div>
          <div className="identity">
            <div className="name-row">
              <span className="name">{personState.display_name}</span>
              {personState.role !== "member" && (
                <span className="role">{personState.role}</span>
              )}
            </div>
            <span className="username">@{personState.username}</span>
          </div>
        </Link>
      </div>

      {personState.reason.label && (
        <div className="reason-row">
          <span className="reason" title={personState.reason.label}>{personState.reason.label}</span>
        </div>
      )}

      {/* Row 2: bio */}
      {bioText && (
        <p className="bio">{bioText}</p>
      )}

      {/* Row 3: meta + signals */}
      <div className="meta-row">
        <span className="meta-item">
          <Users size={11} />
          {followersCount}
        </span>
        {personState.follows_you && (
          <span className="signal follows-you">Follows you</span>
        )}
        {personState.shared_interest_count > 0 && (
          <span className="signal shared-interest">
            <Sparkles size={10} />
            {personState.shared_interest_count} shared
          </span>
        )}
        {personState.shared_interest_count === 0 && personState.mutual_follow_count > 0 && (
          <span className="signal mutuals">{personState.mutual_follow_count} mutual</span>
        )}
      </div>

      {/* Row 4: actions */}
      <div className="actions">
        <FollowButton
          userId={personState.id}
          initialFollowing={personState.is_following}
          followsYou={personState.follows_you}
          onFollowChange={(isFollowing, nextFollowersCount) => {
            setPersonState((c) => ({ ...c, is_following: isFollowing }));
            setFollowersCount(nextFollowersCount);
            scheduleRevalidate(onRelationshipChange);
          }}
        />
        <ConnectionButton
          userId={personState.id}
          initialStatus={toConnectionStatus(personState)}
          skipStatusFetch
          onConnectionChange={(status) => {
            setPersonState((c) => ({ ...c, ...status }));
            scheduleRevalidate(onRelationshipChange);
          }}
        />
      </div>

      <style jsx>{`
        .card {
          display: grid;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid rgba(30, 34, 53, 0.9);
          background: #0d1120;
          transition: border-color 0.15s, background 0.15s;
        }
        .card:hover {
          border-color: #252d48;
          background: #101525;
        }

        /* Row 1 */
        .row-top {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .profile-link {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          min-width: 0;
          flex: 1;
        }
        .avatar {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .identity {
          min-width: 0;
          display: grid;
          gap: 1px;
        }
        .name-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .name {
          color: #dde4f5;
          font-size: 14px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.15s;
        }
        .profile-link:hover .name { color: #fff; }
        .role {
          border: 1px solid rgba(124, 115, 240, 0.28);
          background: rgba(124, 115, 240, 0.12);
          color: #c9c1ff;
          padding: 1px 6px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .username {
          color: #5e6a8a;
          font-size: 12px;
        }
        .reason-row {
          display: flex;
          align-items: center;
          min-width: 0;
        }
        .reason {
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          border: 1px solid rgba(240, 131, 74, 0.2);
          background: rgba(240, 131, 74, 0.06);
          color: #d99874;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Row 2: bio */
        .bio {
          margin: 0;
          color: #8a96b5;
          font-size: 12.5px;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Row 3: meta + signals */
        .meta-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }
        .meta-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #505870;
          font-size: 11px;
        }
        .signal {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 999px;
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 600;
          border: 1px solid;
        }
        .follows-you {
          color: #d4a76a;
          border-color: rgba(240, 131, 74, 0.2);
          background: rgba(240, 131, 74, 0.06);
        }
        .shared-interest {
          color: #a9a3f5;
          border-color: rgba(124, 115, 240, 0.2);
          background: rgba(124, 115, 240, 0.06);
        }
        .mutuals {
          color: #72ceaa;
          border-color: rgba(61, 214, 140, 0.18);
          background: rgba(61, 214, 140, 0.05);
        }

        /* Row 4: actions */
        .actions {
          display: flex;
          gap: 8px;
        }
        .actions :global(button) {
          flex: 1;
          justify-content: center;
          font-size: 12px !important;
          padding: 6px 10px !important;
          min-height: 32px !important;
          height: 32px !important;
        }
      `}</style>
    </article>
  );
}
