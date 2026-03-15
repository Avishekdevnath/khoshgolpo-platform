import { api, apiPost, apiGet } from "@/lib/api";
import type { FollowStats, FollowStatus, FollowerListResponse } from "@/types/follow";

export async function getFollowStatus(userId: string): Promise<FollowStatus> {
  return apiGet(`/users/${userId}/follow-status`);
}

export async function followUser(userId: string): Promise<FollowStats> {
  return apiPost(`/users/${userId}/follow`, {});
}

export async function unfollowUser(userId: string): Promise<FollowStats> {
  return api.delete(`users/${userId}/follow`).json<FollowStats>();
}

export async function listFollowers(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<FollowerListResponse> {
  return apiGet(`/users/${userId}/followers?page=${page}&limit=${limit}`);
}

export async function listFollowing(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<FollowerListResponse> {
  return apiGet(`/users/${userId}/following?page=${page}&limit=${limit}`);
}
