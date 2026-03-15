"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import NavBar from "@/components/public/sections/NavBar";
import { apiPost } from "@/lib/api";

const icons = {
  lock: "M12 1c-3.866 0-7 3.134-7 7v3H3a2 2 0 00-2 2v8a2 2 0 002 2h18a2 2 0 002-2v-8a2 2 0 00-2-2h-2V8c0-3.866-3.134-7-7-7z",
  check: "M20 6L9 17l-5-5",
  arrow: "M5 12h14M12 5l7 7-7 7",
} as const;

function Icon({ path, size = 14, color = "currentColor" }: { path: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

type PageState = "idle" | "loading" | "success" | "error";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token") ?? "";

  const orbRef = useRef<HTMLDivElement | null>(null);

  const [token, setToken] = useState(urlToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [errors, setErrors] = useState<{ token?: string; password?: string; confirm?: string }>({});

  useEffect(() => {
    const nav = document.getElementById("nav");
    nav?.classList.add("scrolled");
    const handleMouseMove = (e: MouseEvent) => {
      if (!orbRef.current) return;
      const x = (e.clientX / window.innerWidth) * 15 - 7.5;
      const y = (e.clientY / window.innerHeight) * 15 - 7.5;
      orbRef.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      nav?.classList.remove("scrolled");
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Countdown redirect after success
  useEffect(() => {
    if (pageState !== "success") return;
    if (countdown <= 0) { router.push("/login"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [pageState, countdown, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const next: typeof errors = {};
    if (!token.trim()) next.token = "Please enter the reset token";
    if (!newPassword) next.password = "Please enter a new password";
    else if (newPassword.length < 6) next.password = "Password must be at least 6 characters";
    if (!confirmPassword) next.confirm = "Please confirm your password";
    else if (newPassword !== confirmPassword) next.confirm = "Passwords do not match";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPageState("loading");
    setErrorMsg(null);
    try {
      await apiPost("auth/reset-password", { token: token.trim(), new_password: newPassword });
      setPageState("success");
    } catch {
      setErrorMsg("Verification token is invalid or expired. Please go back and verify your identity again.");
      setPageState("error");
    }
  };

  return (
    <main className="rp-page">
      <NavBar />
      <div className="rp-noise" aria-hidden="true" />
      <div ref={orbRef} className="rp-orb rp-orb-1" aria-hidden="true" />
      <div className="rp-orb rp-orb-2" aria-hidden="true" />

      <section className="rp-container">
        {pageState === "success" ? (
          <div className="rp-box success-screen">
            <div className="success-icon" aria-hidden="true">
              <Icon path={icons.check} size={36} color="#4ADE80" />
            </div>
            <h2>Password updated</h2>
            <p className="subtitle">Your password has been reset successfully.</p>
            <p className="countdown-text">Redirecting to login in {countdown}s…</p>
            <Link href="/login" className="submit-btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", marginTop: 16 }}>
              Go to login now
              <Icon path={icons.arrow} color="#fff" />
            </Link>
          </div>
        ) : (
          <div className="rp-box">
            <Link href="/login" className="back-link">
              &lt;- Back to login
            </Link>

            <h2>Set new password</h2>
            <p className="subtitle">Identity verified. Choose a new password for your account.</p>

            {pageState === "error" && errorMsg ? (
              <div className="error-banner" role="alert">
                {errorMsg}
                {" "}
                <Link href="/login" style={{ color: "#fca5a5", fontWeight: 600 }}>Go back →</Link>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} noValidate>
              {/* Show token field only if no URL token was provided */}
              {!urlToken ? (
                <div className="form-group">
                  <label htmlFor="rp-token" className="form-label">
                    Verification token
                  </label>
                  <input
                    id="rp-token"
                    type="text"
                    className={`input-field${errors.token ? " input-error" : ""}`}
                    placeholder="Paste your verification token here"
                    value={token}
                    onChange={e => {
                      setToken(e.target.value);
                      if (errors.token) setErrors(prev => ({ ...prev, token: undefined }));
                    }}
                    disabled={pageState === "loading"}
                    autoComplete="off"
                  />
                  {errors.token ? <p className="error-text">{errors.token}</p> : null}
                </div>
              ) : null}

              <div className="form-group">
                <div className="label-row">
                  <label htmlFor="rp-password" className="form-label no-margin">
                    <Icon path={icons.lock} />
                    New password
                  </label>
                  <button type="button" className="text-btn" onClick={() => setShowPassword(v => !v)}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  id="rp-password"
                  type={showPassword ? "text" : "password"}
                  className={`input-field${errors.password ? " input-error" : ""}`}
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value);
                    if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                  }}
                  disabled={pageState === "loading"}
                  autoComplete="new-password"
                />
                {errors.password ? <p className="error-text">{errors.password}</p> : null}
              </div>

              <div className="form-group">
                <label htmlFor="rp-confirm" className="form-label">
                  <Icon path={icons.lock} />
                  Confirm password
                </label>
                <input
                  id="rp-confirm"
                  type={showPassword ? "text" : "password"}
                  className={`input-field${errors.confirm ? " input-error" : ""}`}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirm) setErrors(prev => ({ ...prev, confirm: undefined }));
                  }}
                  disabled={pageState === "loading"}
                  autoComplete="new-password"
                />
                {errors.confirm ? <p className="error-text">{errors.confirm}</p> : null}
              </div>

              <button type="submit" className="submit-btn" disabled={pageState === "loading"}>
                {pageState === "loading" ? "Updating…" : "Reset password"}
                {pageState !== "loading" ? <Icon path={icons.arrow} color="#fff" /> : null}
              </button>
            </form>
          </div>
        )}
      </section>

      <style jsx>{`
        .rp-page {
          --bg: #0c0e14; --surface: #13151e; --surface2: #1a1d2a; --border: #252836;
          --text: #e8eaf0; --muted: #6b7080; --accent: #f4845f; --green: #4ade80;
          --red: #e74c3c; --serif: var(--font-dm-serif), Georgia, serif;
          --sans: var(--font-dm-sans), sans-serif;
          position: relative; min-height: 100vh; overflow-x: clip;
          background: var(--bg); color: var(--text); font-family: var(--sans);
        }
        .rp-noise { position: fixed; inset: 0; z-index: 0; opacity: 0.35; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); }
        .rp-orb { position: fixed; z-index: 0; border-radius: 50%; filter: blur(100px); pointer-events: none; }
        .rp-orb-1 { width: 500px; height: 500px; top: -150px; right: -100px; transition: transform 0.8s cubic-bezier(0.1,0.5,0.1,1); background: radial-gradient(circle, rgb(244 132 95 / 8%) 0%, transparent 70%); }
        .rp-orb-2 { width: 400px; height: 400px; bottom: -150px; left: -100px; animation: float 8s ease-in-out infinite; background: radial-gradient(circle, rgb(123 110 246 / 8%) 0%, transparent 70%); }
        .rp-container { position: relative; z-index: 1; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 96px 20px 20px; }
        .rp-box { width: 100%; max-width: 420px; animation: fade-in 0.6s ease; }
        h2 { margin: 0 0 8px; font-family: var(--serif); font-size: 28px; line-height: 1.1; }
        .subtitle { margin: 0 0 24px; color: var(--muted); font-size: 15px; font-weight: 300; }
        .back-link { display: inline-block; margin-bottom: 24px; border: 0; padding: 0; background: none; color: var(--muted); text-decoration: underline; font: 13px var(--sans); cursor: pointer; }
        .back-link:hover { color: var(--text); }
        .form-group { margin-bottom: 18px; }
        .form-label { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--muted); font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
        .no-margin { margin: 0; }
        .label-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
        .input-field { width: 100%; border-radius: 12px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text); font: 14px var(--sans); outline: none; padding: 12px 16px; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; }
        .input-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgb(244 132 95 / 10%); }
        .input-field:disabled { opacity: 0.6; cursor: not-allowed; }
        .input-error { border-color: var(--red); }
        .error-text { margin-top: 6px; font-size: 12px; color: var(--red); }
        .error-banner { padding: 10px 14px; margin-bottom: 18px; border-radius: 10px; background: rgb(231 76 60 / 10%); border: 1px solid rgb(231 76 60 / 30%); color: #fca5a5; font-size: 13px; line-height: 1.5; }
        .text-btn { border: 0; padding: 0; background: none; color: var(--muted); text-decoration: underline; font: 13px var(--sans); cursor: pointer; transition: color 0.2s; }
        .text-btn:hover { color: var(--text); }
        .submit-btn { width: 100%; border: 0; border-radius: 12px; background: var(--accent); color: #fff; font: 700 14px var(--sans); padding: 13px 0; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 20px rgb(244 132 95 / 30%); transition: transform 0.2s, box-shadow 0.2s; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 28px rgb(244 132 95 / 40%); }
        .submit-btn:disabled { opacity: 0.8; cursor: not-allowed; }
        .success-screen { text-align: center; }
        .success-icon { width: 80px; height: 80px; margin: 0 auto 24px; border-radius: 16px; display: flex; align-items: center; justify-content: center; background: rgb(74 222 128 / 12%); animation: pulse 2s ease-in-out infinite; }
        .countdown-text { color: var(--muted); font-size: 13px; margin: 0; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @media (max-width: 640px) { .rp-container { align-items: flex-start; padding-top: 90px; } .rp-box { max-width: 100%; } }
      `}</style>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
