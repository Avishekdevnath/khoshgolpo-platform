"use client";

/**
 * PageLoader — full-screen branded loading state for KhoshGolpo.
 *
 * Shows a centered logo animation with ambient orbs matching the app's
 * dark theme. Used as the fallback in Next.js loading.tsx files.
 */

export default function PageLoader() {
  return (
    <div className="pg-loader">
      {/* Ambient orbs */}
      <div className="pg-orb pg-orb-1" />
      <div className="pg-orb pg-orb-2" />
      <div className="pg-orb pg-orb-3" />

      {/* Centered content */}
      <div className="pg-center">
        {/* Logo mark */}
        <div className="pg-logo-wrap">
          <div className="pg-logo-ring" />
          <div className="pg-logo-dot" />
          <span className="pg-logo-text">K</span>
        </div>

        {/* Brand name */}
        <h1 className="pg-brand">KhoshGolpo</h1>

        {/* Loading bar */}
        <div className="pg-bar-track">
          <div className="pg-bar-fill" />
        </div>
      </div>

      <style jsx>{`
        .pg-loader {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #080a10;
          display: grid;
          place-items: center;
          overflow: hidden;
          font-family: var(--font-dm-sans), "Segoe UI", sans-serif;
        }

        /* ── Ambient orbs ── */
        .pg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          animation: orbFloat 6s ease-in-out infinite alternate;
        }
        .pg-orb-1 {
          width: 380px; height: 380px;
          top: -100px; right: -80px;
          background: radial-gradient(circle, rgba(240,131,74,0.10), transparent 70%);
          animation-delay: 0s;
        }
        .pg-orb-2 {
          width: 420px; height: 420px;
          bottom: -160px; left: -120px;
          background: radial-gradient(circle, rgba(124,115,240,0.10), transparent 70%);
          animation-delay: -2s;
        }
        .pg-orb-3 {
          width: 300px; height: 300px;
          top: 40%; left: 50%;
          transform: translateX(-50%);
          background: radial-gradient(circle, rgba(61,214,140,0.06), transparent 70%);
          animation-delay: -4s;
        }
        @keyframes orbFloat {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(12px, -18px) scale(1.08); }
        }

        /* ── Center block ── */
        .pg-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          z-index: 1;
          animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Logo mark ── */
        .pg-logo-wrap {
          position: relative;
          width: 72px; height: 72px;
          display: grid;
          place-items: center;
        }
        .pg-logo-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid transparent;
          border-top-color: #f0834a;
          border-right-color: rgba(124,115,240,0.4);
          animation: ringRotate 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }
        @keyframes ringRotate {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .pg-logo-dot {
          position: absolute;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #3dd68c;
          top: 6px; right: 8px;
          box-shadow: 0 0 10px rgba(61,214,140,0.5);
          animation: dotPulse 1.6s ease-in-out infinite;
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.8); }
        }
        .pg-logo-text {
          font-family: var(--font-syne), var(--font-dm-sans), sans-serif;
          font-size: 28px;
          font-weight: 800;
          color: #e4e8f4;
          letter-spacing: -1px;
          z-index: 1;
          user-select: none;
        }

        /* ── Brand name ── */
        .pg-brand {
          font-family: var(--font-syne), var(--font-dm-sans), sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #e4e8f4;
          letter-spacing: -0.5px;
          margin: 0;
          opacity: 0.9;
        }

        /* ── Loading bar ── */
        .pg-bar-track {
          width: 140px;
          height: 3px;
          background: rgba(255,255,255,0.06);
          border-radius: 3px;
          overflow: hidden;
        }
        .pg-bar-fill {
          height: 100%;
          width: 40%;
          border-radius: 3px;
          background: linear-gradient(90deg, #f0834a, #7c73f0);
          animation: barSlide 1.4s ease-in-out infinite;
        }
        @keyframes barSlide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }

        /* ── Mobile ── */
        @media (max-width: 640px) {
          .pg-logo-wrap { width: 60px; height: 60px; }
          .pg-logo-text { font-size: 24px; }
          .pg-brand { font-size: 17px; }
          .pg-bar-track { width: 110px; }
        }
      `}</style>
    </div>
  );
}
