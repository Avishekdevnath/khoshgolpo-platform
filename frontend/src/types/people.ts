export type PeopleReason = {
  kind: string;
  label: string;
};

export type PeopleCard = {
  id: string;
  username: string;
  display_name: string;
  profile_slug: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  created_at: string;
  followers_count: number;
  mutual_follow_count: number;
  shared_interest_count: number;
  is_following: boolean;
  follows_you: boolean;
  is_connected: boolean;
  has_pending_request: boolean;
  is_requester: boolean;
  pending_request_id: string | null;
  can_message: boolean;
  blocked_by_me: boolean;
  blocked_you: boolean;
  reason: PeopleReason;
};

export type PeopleSearchSort = "relevance" | "most_followed" | "newest";
export type PeopleRelationshipFilter = "all" | "not_following" | "can_connect" | "connections";
export type PeopleExploreSort = "social" | "most_followed" | "newest";

export type PeopleSearchResponse = {
  data: PeopleCard[];
  page: number;
  limit: number;
  total: number;
  q: string;
  sort: PeopleSearchSort;
  relationship: PeopleRelationshipFilter;
};

export type PeopleExploreSection = {
  key: "suggested" | "popular" | "new";
  title: string;
  data: PeopleCard[];
};

export type PeopleExploreRanked = {
  data: PeopleCard[];
  page: number;
  limit: number;
  total: number;
};

export type PeopleExploreResponse = {
  sections: PeopleExploreSection[];
  ranked: PeopleExploreRanked;
  sort: PeopleExploreSort;
};
