export type Thread = {
  author: string;
  initials: string;
  time: string;
  tag: string;
  tagClass: string;
  avatarStyle: string;
  title: string;
  preview: string;
  replies: string;
  views: string;
  upvotes: string;
  featured?: boolean;
  aiWarm?: boolean;
};

export type Feature = {
  icon: string;
  iconStyle: string;
  name: string;
  description: string;
};

export type Voice = {
  author: string;
  initials: string;
  role: string;
  avatarStyle: string;
  quote: string;
};

export const tickerItems = [
  "Rafi K. started a thread on FastAPI async patterns",
  'Sofia L. replied to "Best practices for Tailwind v4"',
  "Mina M. posted in Career and Growth",
  "Zara A. started a thread on open-source contributions",
  'Tarek H. replied to "Debugging Celery workers in prod"',
  'Leila N. started "What is your morning dev routine?"',
  'Omar F. replied to "MongoDB vs PostgreSQL in 2026"',
  "Priya S. posted in Design Systems",
];

export const threads: Thread[] = [
  {
    author: "Rafi K.",
    initials: "RK",
    time: "14 min ago",
    tag: "Tech",
    tagClass: "tag-tech",
    avatarStyle: "background:linear-gradient(135deg,#6366F1,#8B5CF6)",
    title: "FastAPI vs Django in 2026 - which one should you pick for your next SaaS?",
    preview:
      "I keep getting this question from junior devs. Here is my honest breakdown after shipping production apps with both.",
    replies: "84 replies",
    views: "2.1k views",
    upvotes: "312 upvotes",
    featured: true,
    aiWarm: true,
  },
  {
    author: "Sofia L.",
    initials: "SL",
    time: "1 hr ago",
    tag: "Design",
    tagClass: "tag-design",
    avatarStyle: "background:linear-gradient(135deg,#F4845F,#F59E0B)",
    title: "Tailwind v4 completely changed how I think about design tokens",
    preview:
      "The new CSS-first configuration is a game changer. Here is what I learned after migrating a large codebase.",
    replies: "41 replies",
    views: "1.2k views",
    upvotes: "178 upvotes",
    aiWarm: true,
  },
  {
    author: "Zara A.",
    initials: "ZA",
    time: "2 hrs ago",
    tag: "Career",
    tagClass: "tag-career",
    avatarStyle: "background:linear-gradient(135deg,#4ADE80,#06B6D4)",
    title: "I got rejected from 47 jobs before landing my dream role - what changed",
    preview:
      "Sharing what helped me move from constant rejection to meaningful interviews and one great offer.",
    replies: "126 replies",
    views: "3.6k views",
    upvotes: "891 upvotes",
  },
  {
    author: "Mina M.",
    initials: "MM",
    time: "3 hrs ago",
    tag: "ML",
    tagClass: "tag-ml",
    avatarStyle: "background:linear-gradient(135deg,#F87171,#FB923C)",
    title: "Practical RAG in production - lessons from six months in the real world",
    preview:
      "Everyone talks about building RAG. Few talk about cost control, reliability, and tracing hallucinations.",
    replies: "58 replies",
    views: "1.8k views",
    upvotes: "403 upvotes",
    aiWarm: true,
  },
  {
    author: "Tarek H.",
    initials: "TH",
    time: "5 hrs ago",
    tag: "Discussion",
    tagClass: "tag-discuss",
    avatarStyle: "background:linear-gradient(135deg,#FBBF24,#84CC16)",
    title: "What is your non-negotiable in a dev job offer besides salary?",
    preview:
      "Mine is async-first culture and no mandatory clock-in. Curious what others prioritize.",
    replies: "203 replies",
    views: "4.4k views",
    upvotes: "1.1k upvotes",
  },
];

export const features: Feature[] = [
  {
    icon: "AI",
    iconStyle: "background:rgba(244,132,95,0.12)",
    name: "AI Tone Coaching",
    description:
      "Before posting, AI checks whether your message may land harshly. Not censorship, just a mirror.",
  },
  {
    icon: "RT",
    iconStyle: "background:rgba(123,110,246,0.12)",
    name: "Live Threads",
    description:
      "Replies refresh quickly so discussions stay active without constant page reloads.",
  },
  {
    icon: "MOD",
    iconStyle: "background:rgba(74,222,128,0.12)",
    name: "Smart Moderation",
    description:
      "AI scores each post and sends only risky content to human review.",
  },
  {
    icon: "NOTI",
    iconStyle: "background:rgba(251,191,36,0.12)",
    name: "Smart Notifications",
    description: "You get mentions and replies only, not engagement bait.",
  },
  {
    icon: "TREE",
    iconStyle: "background:rgba(248,113,113,0.12)",
    name: "Nested Threads",
    description:
      "Conversations branch naturally so context is never lost in a linear feed.",
  },
  {
    icon: "SUM",
    iconStyle: "background:rgba(6,182,212,0.12)",
    name: "AI Summaries",
    description:
      "Long thread? Get concise takeaways fast so you can catch up in seconds.",
  },
];

export const voices: Voice[] = [
  {
    author: "Rafi K.",
    initials: "RK",
    role: "Senior Backend Engineer - Dhaka",
    avatarStyle: "background:linear-gradient(135deg,#6366F1,#8B5CF6)",
    quote:
      "Finally a place where technical debate does not become a flame war. The tone warning helped me once and it was right.",
  },
  {
    author: "Sofia L.",
    initials: "SL",
    role: "Product Designer - Istanbul",
    avatarStyle: "background:linear-gradient(135deg,#F4845F,#F59E0B)",
    quote:
      "Other communities are noisy or fleeting. Here, long conversations can breathe and stay useful.",
  },
  {
    author: "Zara A.",
    initials: "ZA",
    role: "ML Engineer - Lagos",
    avatarStyle: "background:linear-gradient(135deg,#4ADE80,#06B6D4)",
    quote:
      "The realtime feel is what keeps me here. You do not post into a void and wait forever.",
  },
];
