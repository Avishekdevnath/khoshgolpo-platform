import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { HTTPError } from "ky";
import { apiPost } from "@/lib/api";
import { authStoreStorage, clearPersistedAuthState } from "@/lib/authStorage";

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  bio: string | null;
  role: "member" | "moderator" | "admin";
  is_active: boolean;
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  profile_slug?: string | null;
  profile_slug_changed_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthResponse {
  access_token: string;
  token_type?: string;
  user: User;
}

interface RegisterResponse extends AuthResponse {
  recovery_code: string;
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  rememberMe: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  register: (
    username: string,
    email: string,
    display_name: string,
    password: string,
    options?: { fav_animal?: string; fav_person?: string; first_name?: string; last_name?: string; gender?: string }
  ) => Promise<string>; // returns recovery_code
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
}

async function parseApiError(error: unknown, fallback: string): Promise<string> {
  if (!(error instanceof HTTPError)) return fallback;
  try {
    const payload = (await error.response.json()) as { detail?: string };
    return payload.detail ?? fallback;
  } catch {
    return fallback;
  }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      rememberMe: false,
      isLoading: false,
      error: null,

      register: async (
        username: string,
        email: string,
        display_name: string,
        password: string,
        options?: { fav_animal?: string; fav_person?: string; first_name?: string; last_name?: string; gender?: string }
      ) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiPost<RegisterResponse>("/auth/register", {
            username,
            email,
            display_name,
            password,
            fav_animal: options?.fav_animal || undefined,
            fav_person: options?.fav_person || undefined,
            first_name: options?.first_name || undefined,
            last_name: options?.last_name || undefined,
            gender: options?.gender || undefined,
          });

          set({
            user: response.user,
            accessToken: response.access_token,
            rememberMe: true,
            isLoading: false,
          });
          return response.recovery_code;
        } catch (error: unknown) {
          const message = await parseApiError(error, "Registration failed. Please try again.");
          set({
            error: message,
            isLoading: false,
          });
          throw error;
        }
      },

      login: async (identifier: string, password: string, rememberMe = false) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiPost<AuthResponse>("/auth/login", {
            identifier,
            password,
            remember_me: rememberMe,
          });

          set({
            user: response.user,
            accessToken: response.access_token,
            rememberMe,
            isLoading: false,
          });
        } catch (error: unknown) {
          const message = await parseApiError(error, "Login failed. Please check your credentials.");
          set({
            error: message,
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await apiPost("/auth/logout", {});
        } catch {
          // Logout error isn't critical
        } finally {
          set({
            user: null,
            accessToken: null,
            rememberMe: false,
            isLoading: false,
            error: null,
          });
          clearPersistedAuthState();
        }
      },

      refresh: async () => {
        try {
          const response = await apiPost<AuthResponse>("/auth/refresh", {});
          set({
            user: response.user,
            accessToken: response.access_token,
            rememberMe: get().rememberMe,
          });
        } catch {
          set({
            user: null,
            accessToken: null,
            rememberMe: false,
          });
          clearPersistedAuthState();
        }
      },

      setUser: (user: User | null) => {
        set({ user });
      },

      setAccessToken: (token: string | null) => {
        if (!token) {
          set({ accessToken: null, rememberMe: false });
          clearPersistedAuthState();
          return;
        }
        set({ accessToken: token });
      },

      isAuthenticated: () => {
        const { user, accessToken } = get();
        return !!(user && accessToken);
      },

      isAdmin: () => {
        const { user } = get();
        return user?.role === "admin";
      },
    }),
    {
      name: "auth-store",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        rememberMe: state.rememberMe,
      }),
      storage: createJSONStorage(() => authStoreStorage),
    }
  )
);
