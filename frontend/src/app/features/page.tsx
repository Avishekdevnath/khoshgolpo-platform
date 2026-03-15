"use client";

import NavBar from "@/components/public/sections/NavBar";
import CTA from "@/components/public/sections/CTA";
import Footer from "@/components/public/sections/Footer";

const featureTiles = [
  {
    title: "AI Tone Coaching",
    desc: "Before you post, AI checks if your message might land harshly. Not censorship -- just a mirror to help you say it better.",
    details:
      "Our tone coach analyzes sentiment and suggests friendlier phrasings when needed. You always have the final say.",
    icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    accent: "rgba(244,132,95,0.15)",
    color: "#F4845F",
  },
  {
    title: "Live Threads",
    desc: "Replies refresh quickly so discussions stay active and easy to follow.",
    details: "The current release uses short-interval polling for fresh updates, with realtime sockets planned after v1.",
    icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
    accent: "rgba(123,110,246,0.12)",
    color: "#7B6EF6",
  },
  {
    title: "Smart Moderation",
    desc: "AI scores every post automatically. Risky content goes to human review. Safe content flows through in milliseconds.",
    details: "Our moderation pipeline catches spam and toxicity while letting genuine conversation thrive.",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    accent: "rgba(74,222,128,0.12)",
    color: "#4ADE80",
  },
  {
    title: "Smart Notifications",
    desc: "Get notified for mentions and replies -- never for engagement bait. No dark patterns designed to keep you scrolling.",
    details: "We respect your attention. Notifications are about connection, not addiction.",
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0018 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    accent: "rgba(251,191,36,0.15)",
    color: "#FBBF24",
  },
  {
    title: "Nested Threads",
    desc: "Conversations branch naturally. Reply to any post, not just the top-level thread. Context never gets lost in a linear feed.",
    details: "Hierarchical threading lets conversations unfold organically with every voice heard.",
    icon: "M7 8a3 3 0 100-6 3 3 0 000 6zM7 15a6 6 0 110-12 6 6 0 010 12zm8-5a2 2 0 11-4 0 2 2 0 014 0zM16 19a4 4 0 11-8 0 4 4 0 018 0z",
    accent: "rgba(244,132,95,0.12)",
    color: "#F4845F",
  },
  {
    title: "AI Summaries",
    desc: "Long thread? Get a TL;DR in one click. Key decisions and insights surfaced automatically so you never miss the point.",
    details: "Summaries are generated on demand and highlight consensus, decisions, and next steps.",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    accent: "rgba(123,110,246,0.12)",
    color: "#7B6EF6",
  },
];

const steps = [
  {
    number: 1,
    title: "Start a thread",
    desc: "Write your idea, question, or story. AI checks the tone before you post -- helping you land it the way you mean it.",
  },
  {
    number: 2,
    title: "Community replies",
    desc: "Replies refresh every few seconds. Branch conversations naturally and keep context clear.",
  },
  {
    number: 3,
    title: "AI keeps it warm",
    desc: "Moderation runs silently in the background. Good conversations flow freely. Bad actors get caught -- not good people.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="page-shell">
      <NavBar />
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />

      <main className="features-shell">
        <section className="features-page">
          <div className="container">
            <p className="section-label">Why KhoshGolpo</p>
            <h1 className="section-title">
              Built different,
              <br /> on purpose
            </h1>
            <p className="section-sub">
              Every feature exists to protect the quality of conversation -- not engagement metrics.
            </p>

            <div className="features-grid">
              {featureTiles.map((feature) => (
                <article key={feature.title} className="feature-tile">
                  <div className="feature-icon" style={{ background: feature.accent, color: feature.color }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="feature-name">{feature.title}</h3>
                  <p className="feature-desc">{feature.desc}</p>
                  <p className="feature-details">{feature.details}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="how-section">
          <div className="container">
            <div className="section-intro">
              <p className="section-label">How it works</p>
              <h2 className="section-title">Designed for real conversations</h2>
            </div>
            <div className="steps">
              {steps.map((step) => (
                <article key={step.number} className="step">
                  <div className="step-num">{step.number}</div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.desc}</p>
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

        .features-shell {
          position: relative;
          z-index: 1;
          padding-top: 88px;
          padding-bottom: 32px;
        }

        .features-page {
          padding: 100px 0;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 2px;
          background: var(--border);
          border-radius: 20px;
          overflow: hidden;
          margin-top: 64px;
          margin-bottom: 100px;
        }

        .feature-tile {
          background: var(--surface);
          padding: 36px 32px;
          transition: background 0.25s ease, transform 0.25s ease;
          animation: slide-up 0.6s ease forwards;
          opacity: 0;
        }

        .feature-tile:nth-child(1) {
          animation-delay: 0s;
        }

        .feature-tile:nth-child(2) {
          animation-delay: 0.1s;
        }

        .feature-tile:nth-child(3) {
          animation-delay: 0.2s;
        }

        .feature-tile:nth-child(4) {
          animation-delay: 0.3s;
        }

        .feature-tile:nth-child(5) {
          animation-delay: 0.4s;
        }

        .feature-tile:nth-child(6) {
          animation-delay: 0.5s;
        }

        .feature-tile:hover {
          background: var(--surface2);
          transform: translateY(-4px);
        }

        .feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        .feature-icon svg {
          width: 22px;
          height: 22px;
          stroke: currentColor;
          stroke-width: 2;
          fill: none;
        }

        .feature-name {
          font-weight: 700;
          font-size: 15px;
          margin-bottom: 8px;
        }

        .feature-desc {
          font-size: 14px;
          color: var(--muted);
          line-height: 1.65;
        }

        .feature-details {
          display: none;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
          font-size: 13px;
          color: var(--muted);
          line-height: 1.7;
        }

        .how-section {
          padding: 100px 0;
        }

        .section-intro {
          text-align: center;
          margin-bottom: 64px;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 48px;
        }

        .step {
          text-align: center;
          animation: slide-up 0.6s ease forwards;
          opacity: 0;
        }

        .step:nth-child(1) {
          animation-delay: 0.1s;
        }

        .step:nth-child(2) {
          animation-delay: 0.2s;
        }

        .step:nth-child(3) {
          animation-delay: 0.3s;
        }

        .step-num {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--serif);
          font-size: 22px;
          color: var(--accent);
          margin: 0 auto 24px;
          transition: all 0.25s ease;
        }

        .step:hover .step-num {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent);
          transform: scale(1.1);
        }

        .step-title {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 10px;
        }

        .step-desc {
          font-size: 14px;
          color: var(--muted);
          line-height: 1.65;
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
          .features-shell {
            padding-top: 100px;
          }

          .feature-tile {
            padding: 28px 22px;
          }

          .steps {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
