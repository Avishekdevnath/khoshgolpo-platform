import type { StateStorage } from "zustand/middleware";

const AUTH_COOKIE_NAME = "kg_access_token";
const AUTH_STORE_NAME = "auth-store";
const REMEMBER_ME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type StorageKind = "local" | "session";

type PersistedEnvelope = {
  state?: {
    accessToken?: string | null;
    rememberMe?: boolean;
  };
  version?: number;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function parsePersistedEnvelope(value: string | null): PersistedEnvelope | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as PersistedEnvelope;
  } catch {
    return null;
  }
}

function getStoredAuthValue(name: string): { raw: string | null; kind: StorageKind | null } {
  if (!hasWindow()) return { raw: null, kind: null };

  const sessionValue = window.sessionStorage.getItem(name);
  if (sessionValue) {
    return { raw: sessionValue, kind: "session" };
  }

  const localValue = window.localStorage.getItem(name);
  if (localValue) {
    return { raw: localValue, kind: "local" };
  }

  return { raw: null, kind: null };
}

function withRememberMeFallback(
  envelope: PersistedEnvelope | null,
  kind: StorageKind | null
): PersistedEnvelope | null {
  if (!envelope?.state) return envelope;
  if (typeof envelope.state.rememberMe === "boolean") return envelope;

  const hasToken =
    typeof envelope.state.accessToken === "string" && envelope.state.accessToken.length > 0;

  return {
    ...envelope,
    state: {
      ...envelope.state,
      rememberMe: kind === "local" && hasToken,
    },
  };
}

function getRememberMe(envelope: PersistedEnvelope | null, kind: StorageKind | null) {
  if (typeof envelope?.state?.rememberMe === "boolean") {
    return envelope.state.rememberMe;
  }
  return kind === "local";
}

function getAccessToken(envelope: PersistedEnvelope | null) {
  const token = envelope?.state?.accessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function writeStoredAuthValue(name: string, value: string, rememberMe: boolean) {
  if (!hasWindow()) return;

  if (rememberMe) {
    window.localStorage.setItem(name, value);
    window.sessionStorage.removeItem(name);
    return;
  }

  window.sessionStorage.setItem(name, value);
  window.localStorage.removeItem(name);
}

export function syncAuthCookie(token: string | null, rememberMe = false) {
  if (typeof document === "undefined") return;

  if (!token) {
    document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }

  const parts = [`${AUTH_COOKIE_NAME}=${token}`, "Path=/", "SameSite=Lax"];
  if (rememberMe) {
    parts.push(`Max-Age=${REMEMBER_ME_COOKIE_MAX_AGE_SECONDS}`);
  }
  document.cookie = parts.join("; ");
}

export function clearPersistedAuthState(name = AUTH_STORE_NAME) {
  if (!hasWindow()) return;

  window.localStorage.removeItem(name);
  window.sessionStorage.removeItem(name);
  syncAuthCookie(null);
}

export function getPersistedAuthToken(name = AUTH_STORE_NAME) {
  const { raw, kind } = getStoredAuthValue(name);
  const envelope = withRememberMeFallback(parsePersistedEnvelope(raw), kind);
  return getAccessToken(envelope);
}

export function updatePersistedAuthToken(token: string, name = AUTH_STORE_NAME) {
  if (!hasWindow()) return;

  const { raw, kind } = getStoredAuthValue(name);
  const envelope = withRememberMeFallback(parsePersistedEnvelope(raw), kind);
  const rememberMe = getRememberMe(envelope, kind);

  if (!envelope?.state) {
    syncAuthCookie(token, rememberMe);
    return;
  }

  const nextValue = JSON.stringify({
    ...envelope,
    state: {
      ...envelope.state,
      accessToken: token,
      rememberMe,
    },
  });

  writeStoredAuthValue(name, nextValue, rememberMe);
  syncAuthCookie(token, rememberMe);
}

export const authStoreStorage: StateStorage = {
  getItem: (name) => {
    const { raw, kind } = getStoredAuthValue(name);
    const envelope = withRememberMeFallback(parsePersistedEnvelope(raw), kind);
    return envelope ? JSON.stringify(envelope) : raw;
  },
  setItem: (name, value) => {
    const envelope = parsePersistedEnvelope(value);
    const rememberMe = getRememberMe(envelope, null);

    writeStoredAuthValue(name, value, rememberMe);
    syncAuthCookie(getAccessToken(envelope), rememberMe);
  },
  removeItem: (name) => {
    clearPersistedAuthState(name);
  },
};
