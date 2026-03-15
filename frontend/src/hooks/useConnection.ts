import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptMessageRequest,
  cancelMessageRequest,
  getConnectionStatus,
  rejectMessageRequest,
  sendMessageRequest,
} from "@/lib/connectionApi";
import type { ConnectionStatusResponse } from "@/types/connection";

type UseConnectionOptions = {
  initialStatus?: ConnectionStatusResponse | null;
  skipInitialLoad?: boolean;
};

const DISCONNECTED: ConnectionStatusResponse = {
  is_connected: false,
  has_pending_request: false,
  is_requester: false,
  pending_request_id: null,
  can_message: false,
  blocked_by_me: false,
  blocked_you: false,
};

export function useConnection(userId: string, options: UseConnectionOptions = {}) {
  const { initialStatus = null, skipInitialLoad = false } = options;
  const [status, setStatus] = useState<ConnectionStatusResponse | null>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generation counter: incremented on every user action.
  // loadStatus checks this before writing — if an action happened while
  // the GET was in-flight, the stale response is discarded.
  const genRef = useRef(0);

  const loadStatus = useCallback(async () => {
    const myGen = genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await getConnectionStatus(userId);
      if (genRef.current === myGen) {
        setStatus(res);
      }
    } catch {
      if (genRef.current === myGen) {
        setError("Failed to load connection status");
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // When userId changes: reset state and generation
  useEffect(() => {
    genRef.current = 0;
    setStatus(initialStatus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (skipInitialLoad) return;
    void loadStatus();
  }, [loadStatus, skipInitialLoad]);

  const sendRequest = useCallback(
    async (message?: string): Promise<ConnectionStatusResponse | null> => {
      genRef.current += 1;
      setError(null);
      let prevStatus: ConnectionStatusResponse | null = null;
      setStatus((current) => {
        prevStatus = current;
        return {
          ...DISCONNECTED,
          has_pending_request: true,
          is_requester: true,
        };
      });
      try {
        const req = await sendMessageRequest(userId, message);
        const confirmed: ConnectionStatusResponse = {
          ...DISCONNECTED,
          has_pending_request: true,
          is_requester: true,
          pending_request_id: req.id,
        };
        setStatus(confirmed);
        return confirmed;
      } catch {
        setStatus(prevStatus);
        setError("Failed to send connection request");
        return null;
      }
    },
    [userId],
  );

  const acceptRequest = useCallback(
    async (requestId: string): Promise<ConnectionStatusResponse | null> => {
      genRef.current += 1;
      setError(null);
      let prevStatus: ConnectionStatusResponse | null = null;
      const optimistic: ConnectionStatusResponse = {
        ...DISCONNECTED,
        is_connected: true,
        can_message: true,
      };
      setStatus((current) => { prevStatus = current; return optimistic; });
      try {
        await acceptMessageRequest(requestId);
        return optimistic;
      } catch {
        setStatus(prevStatus);
        setError("Failed to accept request");
        return null;
      }
    },
    [],
  );

  const rejectRequest = useCallback(
    async (requestId: string): Promise<ConnectionStatusResponse | null> => {
      genRef.current += 1;
      setError(null);
      let prevStatus: ConnectionStatusResponse | null = null;
      setStatus((current) => { prevStatus = current; return DISCONNECTED; });
      try {
        await rejectMessageRequest(requestId);
        return DISCONNECTED;
      } catch {
        setStatus(prevStatus);
        setError("Failed to reject request");
        return null;
      }
    },
    [],
  );

  const cancelRequest = useCallback(
    async (requestId: string): Promise<ConnectionStatusResponse | null> => {
      genRef.current += 1;
      setError(null);
      let prevStatus: ConnectionStatusResponse | null = null;
      setStatus((current) => { prevStatus = current; return DISCONNECTED; });
      try {
        await cancelMessageRequest(requestId);
        return DISCONNECTED;
      } catch {
        setStatus(prevStatus);
        setError("Failed to cancel request");
        return null;
      }
    },
    [],
  );

  return {
    status,
    loading,
    error,
    isConnected: status?.is_connected ?? false,
    hasPendingRequest: status?.has_pending_request ?? false,
    isRequester: status?.is_requester ?? false,
    pendingRequestId: status?.pending_request_id ?? null,
    canMessage: status?.can_message ?? false,
    blockedByMe: status?.blocked_by_me ?? false,
    blockedYou: status?.blocked_you ?? false,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    refetch: loadStatus,
  };
}
