"use client";

import { useRouter } from "next/navigation";
import { Check, Clock, MessageSquare, ShieldBan, UserPlus, X } from "lucide-react";

import { useConnection } from "@/hooks/useConnection";
import type { ConnectionStatusResponse } from "@/types/connection";

interface ConnectionButtonProps {
  userId: string;
  initialStatus?: ConnectionStatusResponse | null;
  skipStatusFetch?: boolean;
  onConnectionChange?: (status: ConnectionStatusResponse) => void;
}

export default function ConnectionButton({
  userId,
  initialStatus,
  skipStatusFetch = false,
  onConnectionChange,
}: ConnectionButtonProps) {
  const router = useRouter();
  const hookState = useConnection(userId, { initialStatus, skipInitialLoad: skipStatusFetch });
  const {
    isConnected: connectedState,
    hasPendingRequest: pendingState,
    isRequester: requesterState,
    pendingRequestId: requestIdState,
    canMessage: messageState,
    blockedByMe: blockedByMeState,
    blockedYou: blockedYouState,
    loading: statusLoading,
    sendRequest: sendConnectionRequest,
    acceptRequest: acceptConnectionRequest,
    cancelRequest: cancelConnectionRequest,
  } = hookState;

  const handleClick = async () => {
    if (messageState) {
      router.push(`/messages?start=${encodeURIComponent(userId)}`);
      return;
    }
    if (pendingState && requesterState && requestIdState) {
      const nextStatus = await cancelConnectionRequest(requestIdState);
      if (nextStatus) onConnectionChange?.(nextStatus);
      return;
    }
    if (pendingState && !requesterState && requestIdState) {
      const nextStatus = await acceptConnectionRequest(requestIdState);
      if (nextStatus) onConnectionChange?.(nextStatus);
      return;
    }
    const nextStatus = await sendConnectionRequest();
    if (nextStatus) onConnectionChange?.(nextStatus);
  };

  let bgColor = "rgba(240, 131, 74, 0.1)";
  let borderColor = "#f0834a";
  let textColor = "#f0834a";
  let buttonText = "Connect";
  let icon = <UserPlus size={14} />;
  let disabled =
    statusLoading ||
    blockedByMeState ||
    blockedYouState ||
    (connectedState && !messageState);
  let title = "Send connection request to message";

  if (messageState) {
    bgColor = "rgba(61, 214, 140, 0.1)";
    borderColor = "#3dd68c";
    textColor = "#90e7be";
    buttonText = "Message";
    icon = <MessageSquare size={14} />;
    disabled = statusLoading;
    title = "Open direct messages";
  } else if (blockedByMeState || blockedYouState) {
    bgColor = "rgba(240, 107, 107, 0.1)";
    borderColor = "#f06b6b";
    textColor = "#f6b0b0";
    buttonText = blockedByMeState ? "Blocked" : "Cannot Message";
    icon = <ShieldBan size={14} />;
    title = blockedByMeState ? "You blocked this user" : "This user blocked you";
  } else if (connectedState) {
    bgColor = "rgba(99, 111, 141, 0.12)";
    borderColor = "#636f8d";
    textColor = "#c7cee2";
    buttonText = "Connected";
    icon = <MessageSquare size={14} />;
    title = "Connected, but messaging is unavailable right now";
  } else if (pendingState && !requesterState && requestIdState) {
    bgColor = "rgba(61, 214, 140, 0.1)";
    borderColor = "#3dd68c";
    textColor = "#90e7be";
    buttonText = "Accept";
    icon = <Check size={14} />;
    disabled = statusLoading;
    title = "Accept this connection request";
  } else if (pendingState && requesterState) {
    bgColor = "rgba(229, 192, 123, 0.08)";
    borderColor = "#e5c07b";
    textColor = "#f0c78a";
    buttonText = "Cancel Request";
    icon = <X size={14} />;
    title = "Cancel your connection request";
  } else if (pendingState) {
    bgColor = "rgba(61, 214, 140, 0.1)";
    borderColor = "#3dd68c";
    textColor = "#90e7be";
    buttonText = "Accept";
    icon = <Check size={14} />;
    title = "Accept this connection request";
  }

  return (
    <button
      onClick={() => void handleClick()}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 16px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "600",
        border: `1px solid ${borderColor}`,
        background: bgColor,
        color: textColor,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: statusLoading ? 0.6 : 1,
        transition: "all 0.2s ease",
      }}
      title={title}
    >
      {icon}
      <span>{statusLoading ? "..." : buttonText}</span>
    </button>
  );
}
