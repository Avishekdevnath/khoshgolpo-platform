export const SOCKET_EVENTS = {
  JOIN_THREAD: "join_thread",
  LEAVE_THREAD: "leave_thread",
  NEW_POST: "new_post",
  NOTIFICATION: "notification",
  TYPING_START: "typing_start",
  TYPING_STOP: "typing_stop",
} as const;

export const USER_ROLES = {
  MEMBER: "member",
  MODERATOR: "moderator",
  ADMIN: "admin",
} as const;
