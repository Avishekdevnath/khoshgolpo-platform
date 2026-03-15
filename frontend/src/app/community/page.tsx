"use client";

import NavBar from "@/components/public/sections/NavBar";
import CTA from "@/components/public/sections/CTA";
import Footer from "@/components/public/sections/Footer";

const voices = [
  {
    quote:
      "Finally a place where I can have a real technical debate without someone turning it into a flame war. The AI tone thing caught me once and honestly, it was right.",
    name: "Rafi K.",
    role: "Senior Backend Engineer - Dhaka",
    initials: "RK",
    avatar: "linear-gradient(135deg, #6366F1, #8B5CF6)",
  },
  {
    quote:
      "I've tried every dev community - Twitter is chaos, Reddit is toxic, Discord messages disappear. KhoshGolpo actually lets long conversations breathe and age well.",
    name: "Sofia L.",
    role: "Product Designer - Istanbul",
    initials: "SL",
    avatar: "linear-gradient(135deg, #F4845F, #F59E0B)",
  },
  {
    quote:
      "The realtime feel is what gets me. It's not like posting into a void. Someone always replies within minutes and you can see them typing. It feels like a real room.",
    name: "Zara A.",
    role: "ML Engineer - Lagos",
    initials: "ZA",
    avatar: "linear-gradient(135deg, #4ADE80, #06B6D4)",
  },
  {
    quote:
      "Moderation here actually works. I feel safe sharing unpopular opinions knowing they won't get drowned out or attacked. The bar for discourse is higher.",
    name: "Mina M.",
    role: "Full Stack Developer - Mumbai",
    initials: "MM",
    avatar: "linear-gradient(135deg, #F87171, #FB923C)",
  },
  {
    quote:
      "The nested threads are a game-changer. Conversations don't collapse into linear chaos. You can actually follow multiple discussion threads in parallel.",
    name: "Tarek H.",
    role: "DevOps Engineer - Cairo",
    initials: "TH",
    avatar: "linear-gradient(135deg, #FBBF24, #84CC16)",
  },
  {
    quote:
      "I joined as a lurker and started contributing after a week. The community made me feel welcome. No gatekeeping, just genuine support.",
    name: "Leila N.",
    role: "Junior Developer - Tehran",
    initials: "LN",
    avatar: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
  },
];

const stats = [
  { value: "48k", label: "Community members" },
  { value: "127k", label: "Threads started" },
  { value: "1.2M", label: "Replies posted" },
  { value: "98.4%", label: "Positive interactions" },
];

export default function CommunityPage() {
  return (
    <div className="page-shell">
      <NavBar />
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />

      <main className="community-shell">
        <section className="community-page">
          <div className="container">
            <p className="section-label">Community voices</p>
            <h1 className="section-title">What members say</h1>

            <div className="voices-grid">
              {voices.map((voice) => (
                <article key={voice.name} className="voice-card">
                  <div className="star-row">*****</div>
                  <p className="voice-quote">{voice.quote}</p>
                  <div className="voice-author">
                    <div className="voice-avatar" style={{ background: voice.avatar }}>
                      {voice.initials}
                    </div>
                    <div className="voice-info">
                      <p className="voice-name">{voice.name}</p>
                      <p className="voice-role">{voice.role}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="stats-section">
          <div className="container">
            <div className="section-intro">
              <h2 className="section-title">By the numbers</h2>
            </div>

            <div className="stats-grid">
              {stats.map((stat) => (
                <article key={stat.label} className="stat">
                  <p className="stat-val">{stat.value}</p>
                  <p className="stat-lbl">{stat.label}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <CTA />
      <Footer />

      <style jsx>{`
        .page-shell {
          position: relative;
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          overflow: hidden;
        }

        .community-shell {
          position: relative;
          z-index: 1;
          padding-top: 88px;
          padding-bottom: 20px;
        }

        .community-page {
          padding: 100px 0;
        }

        .voices-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 16px;
          margin-top: 64px;
          margin-bottom: 100px;
        }

        .voice-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px;
          transition: all 0.25s;
          animation: slide-up 0.6s ease forwards;
          opacity: 0;
        }

        .voice-card:nth-child(1) {
          animation-delay: 0s;
        }

        .voice-card:nth-child(2) {
          animation-delay: 0.1s;
        }

        .voice-card:nth-child(3) {
          animation-delay: 0.2s;
        }

        .voice-card:nth-child(4) {
          animation-delay: 0.3s;
        }

        .voice-card:nth-child(5) {
          animation-delay: 0.4s;
        }

        .voice-card:nth-child(6) {
          animation-delay: 0.5s;
        }

        .voice-card:hover {
          border-color: rgba(244, 132, 95, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }

        .star-row {
          color: var(--yellow);
          font-size: 12px;
          margin-bottom: 14px;
          letter-spacing: 2px;
        }

        .voice-quote {
          font-size: 15px;
          line-height: 1.7;
          color: var(--text);
          margin-bottom: 20px;
          font-weight: 300;
          position: relative;
          padding-left: 16px;
        }

        .voice-quote::before {
          content: '"';
          color: var(--accent);
          font-family: var(--serif);
          font-size: 32px;
          position: absolute;
          left: 0;
          top: -8px;
          line-height: 0;
        }

        .voice-author {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .voice-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          color: #fff;
        }

        .voice-name {
          font-weight: 600;
          font-size: 14px;
          margin: 0;
        }

        .voice-role {
          font-size: 12px;
          color: var(--muted);
          margin: 0;
        }

        .stats-section {
          padding: 80px 0;
          text-align: center;
          margin-bottom: 100px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 32px;
          margin-top: 48px;
        }

        .stat {
          animation: slide-up 0.6s ease forwards;
          opacity: 0;
        }

        .stat:nth-child(1) {
          animation-delay: 0s;
        }

        .stat:nth-child(2) {
          animation-delay: 0.1s;
        }

        .stat:nth-child(3) {
          animation-delay: 0.2s;
        }

        .stat:nth-child(4) {
          animation-delay: 0.3s;
        }

        .stat-val {
          font-family: var(--serif);
          font-size: 36px;
          color: var(--text);
          margin-bottom: 8px;
        }

        .stat-lbl {
          font-size: 13px;
          color: var(--muted);
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .community-shell {
            padding-top: 100px;
          }

          .voices-grid {
            grid-template-columns: 1fr;
          }

          .voice-card {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}
