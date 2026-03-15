import { useFollow } from "@/hooks/useFollow";
import { UserPlus, UserCheck } from "lucide-react";

interface FollowButtonProps {
  userId: string;
  initialFollowing?: boolean;
  followsYou?: boolean;
  onFollowChange?: (isFollowing: boolean, followersCount: number, followingCount: number) => void;
}

export default function FollowButton({
  userId,
  initialFollowing = false,
  followsYou = false,
  onFollowChange,
}: FollowButtonProps) {
  const { isFollowing, loading, error, follow, unfollow } = useFollow(userId, initialFollowing);

  const handleClick = async () => {
    if (isFollowing) {
      const stats = await unfollow();
      if (stats) onFollowChange?.(false, stats.followers_count, stats.following_count);
    } else {
      const stats = await follow();
      if (stats) onFollowChange?.(true, stats.followers_count, stats.following_count);
    }
  };

  return (
    <button
      onClick={() => void handleClick()}
      disabled={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 16px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "600",
        border: `1px solid ${isFollowing ? "#7c73f0" : "#f0834a"}`,
        background: isFollowing ? "rgba(124, 115, 240, 0.1)" : "rgba(240, 131, 74, 0.1)",
        color: isFollowing ? "#b5a8f0" : "#f0834a",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        transition: "all 0.2s ease",
      }}
      title={error || ""}
    >
      {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
      <span>{isFollowing ? "Following" : followsYou ? "Follow back" : "Follow"}</span>
    </button>
  );
}
