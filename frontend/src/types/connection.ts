export type MessageRequestOut = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string | null;
  status: string;
  created_at: string;
  other_user_id: string | null;
  other_user_username: string | null;
  other_user_display_name: string | null;
};

export type MessageRequestListResponse = {
  data: MessageRequestOut[];
  total: number;
  page: number;
  limit: number;
};

export type ConnectionOut = {
  id: string;
  user_id: string;
  connected_user_id: string;
  status: string;
  created_at: string;
  connected_user_username: string | null;
  connected_user_display_name: string | null;
  connected_user_avatar_url: string | null;
  connected_user_is_active: boolean | null;
  connected_user_is_bot: boolean | null;
};

export type ConnectionListResponse = {
  data: ConnectionOut[];
  total: number;
};

export type ConnectionStatusResponse = {
  is_connected: boolean;
  has_pending_request: boolean;
  is_requester: boolean;
  pending_request_id: string | null;
  can_message: boolean;
  blocked_by_me: boolean;
  blocked_you: boolean;
};
