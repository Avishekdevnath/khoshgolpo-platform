import ky from "ky";
import {
  clearPersistedAuthState,
  getPersistedAuthToken,
  updatePersistedAuthToken,
} from "@/lib/authStorage";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// Get the current auth store without importing it directly (to avoid circular deps)
function getAuthToken(): string | null {
  return getPersistedAuthToken();
}

// Update the token in whichever storage backs the current session
function setAuthToken(token: string) {
  updatePersistedAuthToken(token);
}

// Refresh token function
async function refreshToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    const currentToken = getAuthToken();
    if (!currentToken) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        // Refresh failed - clear auth
        if (typeof window !== "undefined") {
          clearPersistedAuthState();
          window.location.href = "/login";
        }
        return null;
      }

      const data = (await response.json()) as {
        access_token: string;
      };
      const newToken = data.access_token;
      setAuthToken(newToken);
      return newToken;
    } catch {
      if (typeof window !== "undefined") {
        clearPersistedAuthState();
        window.location.href = "/login";
      }
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const api = ky.create({
  prefixUrl: API_BASE_URL,
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window === "undefined") return;
        const token = getAuthToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        // If 401 and not already refreshing, try to refresh
        if (response.status === 401 && !request.url.includes("/auth/")) {
          const newToken = await refreshToken();
          if (newToken) {
            // Retry the request with new token
            const newRequest = new Request(request.clone(), {
              headers: {
                ...Object.fromEntries(request.headers),
                Authorization: `Bearer ${newToken}`,
              },
            });
            return ky(newRequest);
          }
        }
        return response;
      },
    ],
  },
  retry: 0,
  timeout: 15000,
});

export async function apiGet<T>(path: string): Promise<T> {
  const normalized = path.replace(/^\/+/, "");
  return api.get(normalized).json<T>();
}

export async function apiPost<T>(path: string, json?: unknown): Promise<T> {
  const normalized = path.replace(/^\/+/, "");
  return api.post(normalized, { json }).json<T>();
}

export async function apiPatch<T>(path: string, json?: unknown): Promise<T> {
  const normalized = path.replace(/^\/+/, "");
  return api.patch(normalized, { json }).json<T>();
}

export async function apiPut<T>(path: string, json?: unknown): Promise<T> {
  const normalized = path.replace(/^\/+/, "");
  return api.put(normalized, { json }).json<T>();
}

export async function apiDelete(path: string): Promise<void> {
  const normalized = path.replace(/^\/+/, "");
  await api.delete(normalized);
}
