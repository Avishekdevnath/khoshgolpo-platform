import { api, apiPost, apiGet } from "@/lib/api";
import type {
  ConnectionListResponse,
  ConnectionStatusResponse,
  MessageRequestListResponse,
  MessageRequestOut,
} from "@/types/connection";

export async function sendMessageRequest(
  userId: string,
  message?: string,
): Promise<MessageRequestOut> {
  const url = `/connections/${userId}/request${message ? `?message=${encodeURIComponent(message)}` : ""}`;
  return apiPost(url, {});
}

export async function acceptMessageRequest(requestId: string): Promise<ConnectionStatusResponse> {
  return apiPost(`/connections/${requestId}/accept`, {});
}

export async function rejectMessageRequest(requestId: string): Promise<{ status: string }> {
  return api.delete(`connections/${requestId}/reject`).json<{ status: string }>();
}

export async function getPendingRequests(
  page: number = 1,
  limit: number = 20,
): Promise<MessageRequestListResponse> {
  return apiGet(`/connections/pending?page=${page}&limit=${limit}`);
}

export async function getSentRequests(
  page: number = 1,
  limit: number = 20,
): Promise<MessageRequestListResponse> {
  return apiGet(`/connections/sent?page=${page}&limit=${limit}`);
}

export async function cancelMessageRequest(requestId: string): Promise<{ status: string }> {
  return api.delete(`connections/${requestId}/cancel`).json<{ status: string }>();
}

export async function getConnectionStatus(userId: string): Promise<ConnectionStatusResponse> {
  return apiGet(`/connections/${userId}/status`);
}

export async function getConnections(
  userId: string,
  page: number = 1,
  limit: number = 100,
): Promise<ConnectionListResponse> {
  return apiGet(`/connections/${userId}/list?page=${page}&limit=${limit}`);
}
