export type MessageParticipant = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_bot: boolean;
};

export type Conversation = {
  id: string;
  participant_ids: string[];
  other_participant: MessageParticipant;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  message_count: number;
  unread_count: number;
  blocked_by_me: boolean;
  blocked_you: boolean;
  can_message: boolean;
  created_at: string;
  updated_at: string;
};

export type ConversationListResponse = {
  data: Conversation[];
  next_cursor: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  sequence: number;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  is_deleted: boolean;
  is_own: boolean;
};

export type MessageListResponse = {
  conversation: Conversation;
  data: Message[];
  next_cursor: string | null;
};

export type MessageUnreadCountResponse = {
  unread_count: number;
};

export type MessageBlockStatusResponse = {
  target_user_id: string;
  blocked_by_me: boolean;
  blocked_you: boolean;
  can_message: boolean;
};
