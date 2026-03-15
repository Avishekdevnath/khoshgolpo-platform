import { useAuthStore } from "@/store/authStore";
import { useCallback } from "react";

export function useAuth() {
  const store = useAuthStore();

  const isAuthenticated = useCallback(() => store.isAuthenticated(), [store]);
  const isAdmin = useCallback(() => store.isAdmin(), [store]);

  return {
    user: store.user,
    accessToken: store.accessToken,
    isLoading: store.isLoading,
    error: store.error,
    isAuthenticated,
    isAdmin,
    login: store.login,
    register: store.register,
    logout: store.logout,
    refresh: store.refresh,
  };
}
