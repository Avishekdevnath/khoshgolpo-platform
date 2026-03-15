export interface FollowStats {
  followers_count: number;
  following_count: number;
}

export interface FollowStatus {
  is_following: boolean;
  follows_you: boolean;
  followers_count: number;
  following_count: number;
}

export interface FollowerOut {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FollowerListResponse {
  data: FollowerOut[];
  page: number;
  limit: number;
  total: number;
}
