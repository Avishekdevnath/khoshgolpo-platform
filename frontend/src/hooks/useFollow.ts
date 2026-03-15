import { useState, useCallback, useEffect } from "react";
import { followUser, unfollowUser, listFollowers, listFollowing } from "@/lib/followApi";
import type { FollowStats } from "@/types/follow";

export function useFollow(userId: string, initialFollowing: boolean = false) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFollow = useCallback(async (): Promise<FollowStats | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await followUser(userId);
      setIsFollowing(true);
      setFollowersCount(res.followers_count);
      setFollowingCount(res.following_count);
      return res;
    } catch {
      setError("Failed to follow user");
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleUnfollow = useCallback(async (): Promise<FollowStats | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await unfollowUser(userId);
      setIsFollowing(false);
      setFollowersCount(res.followers_count);
      setFollowingCount(res.following_count);
      return res;
    } catch {
      setError("Failed to unfollow user");
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadFollowers = useCallback(
    async (page: number = 1) => {
      try {
        return await listFollowers(userId, page);
      } catch {
        setError("Failed to load followers");
        return null;
      }
    },
    [userId]
  );

  const loadFollowing = useCallback(
    async (page: number = 1) => {
      try {
        return await listFollowing(userId, page);
      } catch {
        setError("Failed to load following");
        return null;
      }
    },
    [userId],
  );

  useEffect(() => {
    setIsFollowing(initialFollowing);
  }, [initialFollowing]);

  return {
    isFollowing,
    followersCount,
    followingCount,
    loading,
    error,
    follow: handleFollow,
    unfollow: handleUnfollow,
    loadFollowers,
    loadFollowing,
  };
}
