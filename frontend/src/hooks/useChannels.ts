export interface Channel {
  id: string;
  name: string;
  slug: string;
  tag: string;
  description: string;
  color: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChannelListResponse {
  data: Channel[];
  page: number;
  limit: number;
  total: number;
}

const MVP_CHANNELS: Channel[] = [
  {
    id: "general",
    name: "General",
    slug: "general",
    tag: "general",
    description: "General discussion",
    color: "#7C73F0",
    is_default: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "frontend",
    name: "Frontend",
    slug: "frontend",
    tag: "frontend",
    description: "UI and UX discussions",
    color: "#F0834A",
    is_default: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "backend",
    name: "Backend",
    slug: "backend",
    tag: "backend",
    description: "API and server architecture",
    color: "#06B6D4",
    is_default: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

/** MVP fallback until channels APIs are implemented */
export function useChannels() {
  return {
    channels: MVP_CHANNELS,
    isLoading: false,
    error: null,
    mutate: async () => undefined,
  };
}

/** MVP fallback: no persisted subscriptions yet */
export function useMyChannels() {
  const subscribe = async (slug: string) => {
    void slug;
    return undefined;
  };
  const unsubscribe = async (slug: string) => {
    void slug;
    return undefined;
  };

  return {
    myChannels: [] as Channel[],
    isLoading: false,
    error: null,
    mutate: async () => undefined,
    subscribe,
    unsubscribe,
  };
}
