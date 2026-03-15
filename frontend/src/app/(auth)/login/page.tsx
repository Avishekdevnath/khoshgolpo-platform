"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import NavBar from "@/components/public/sections/NavBar";
import { useAuth } from "@/hooks";
import { apiPost } from "@/lib/api";
import { useAuthStore } from "@/store";

type Step = "login" | "forgot" | "verify";
type FormErrors = {
  email?: string;
  password?: string;
};
type VerifyIdentityResponse = {
  identity_token?: string;
  needs_questions?: boolean;
};

const icons = {
  mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  lock: "M12 1c-3.866 0-7 3.134-7 7v3H3a2 2 0 00-2 2v8a2 2 0 002 2h18a2 2 0 002-2v-8a2 2 0 00-2-2h-2V8c0-3.866-3.134-7-7-7z",
  arrow: "M5 12h14M12 5l7 7-7 7",
  check: "M20 6L9 17l-5-5",
} as const;

function Icon({ path, size = 14, color = "currentColor" }: { path: string; size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function emailIsValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginPage() {
  const router = useRouter();
  const orbRef = useRef<HTMLDivElement | null>(null);
  const { login, isLoading, error, user, accessToken } = useAuth();

  const [authHydrated, setAuthHydrated] = useState(false);
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Forgot flow state
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Security answer state (Step 2)
  const [recoveryCode, setRecoveryCode] = useState("");
  const [favAnimal, setFavAnimal] = useState("");
  const [favPerson, setFavPerson] = useState("");

  useEffect(() => {
    setAuthHydrated(useAuthStore.persist.hasHydrated());
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setAuthHydrated(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authHydrated) return;
    if (!user || !accessToken) return;
    router.replace("/threads");
  }, [accessToken, authHydrated, router, user]);

  useEffect(() => {
    const nav = document.getElementById("nav");
    nav?.classList.add("scrolled");

    const handleMouseMove = (event: MouseEvent) => {
      if (!orbRef.current) return;
      const x = (event.clientX / window.innerWidth) * 15 - 7.5;
      const y = (event.clientY / window.innerHeight) * 15 - 7.5;
      orbRef.current.style.transform = `translate(${x}px, ${y}px)`;
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      nav?.classList.remove("scrolled");
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Please enter your email";
    } else if (!emailIsValid(email)) {
      nextErrors.email = "Please enter a valid email";
    }

    if (!password.trim()) {
      nextErrors.password = "Please enter your password";
    } else if (password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await login(email.trim().toLowerCase(), password, rememberMe);
      router.push("/threads");
    } catch {
      // Error is already set in the auth store
    }
  };

  const handleForgotIdentifierSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!forgotIdentifier.trim()) { setForgotError("Please enter your email or username"); return; }
    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await apiPost<VerifyIdentityResponse>("auth/verify-identity", {
        identifier: forgotIdentifier.trim().toLowerCase(),
      });
      if (res.identity_token) {
        // No security questions set — identifier alone was enough
        router.push(`/reset-password?token=${res.identity_token}`);
      } else {
        // Has security questions — ask them
        setStep("verify");
      }
    } catch {
      setForgotError("No account found with that email or username.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recoveryCode.trim() && !favAnimal.trim() && !favPerson.trim()) {
      setForgotError("Please fill in at least one security answer");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await apiPost<VerifyIdentityResponse>("auth/verify-identity", {
        identifier: forgotIdentifier.trim().toLowerCase(),
        recovery_code: recoveryCode.trim() || undefined,
        fav_animal: favAnimal.trim() || undefined,
        fav_person: favPerson.trim() || undefined,
      });
      router.push(`/reset-password?token=${res.identity_token}`);
    } catch {
      setForgotError("Security answer incorrect. Please try again.");
      setForgotLoading(false);
    }
  };

  if (!authHydrated || (user && accessToken)) {
    return null;
  }

  return (
    <main className="login-page">
      <NavBar />

      <div className="login-noise" aria-hidden="true" />
      <div ref={orbRef} className="login-orb login-orb-1" aria-hidden="true" />
      <div className="login-orb login-orb-2" aria-hidden="true" />

      <section className="login-container">
        {step === "login" ? (
          <div className="login-box">
            <h1>Welcome back</h1>
            <p className="subtitle">Continue your conversations and pick up where you left off.</p>

            <form onSubmit={handleLoginSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="login-email" className="form-label">
                  <Icon path={icons.mail} />
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  className={`input-field ${errors.email ? "input-error" : ""}`}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errors.email) {
                      setErrors((previous) => ({ ...previous, email: undefined }));
                    }
                  }}
                />
                {errors.email ? <p className="error-text">{errors.email}</p> : null}
              </div>

              <div className="form-group">
                <div className="label-row">
                  <label htmlFor="login-password" className="form-label no-margin">
                    <Icon path={icons.lock} />
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className={`input-field ${errors.password ? "input-error" : ""}`}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errors.password) {
                      setErrors((previous) => ({ ...previous, password: undefined }));
                    }
                  }}
                />
                {errors.password ? <p className="error-text">{errors.password}</p> : null}
              </div>

              <div className="form-footer">
                <label htmlFor="remember-me" className="checkbox-wrapper">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    setForgotIdentifier(email);
                    setStep("forgot");
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Continue"}
                <Icon path={icons.arrow} color="#ffffff" />
              </button>
              {error ? <p className="error-text">{error}</p> : null}
            </form>

            <p className="login-footer">
              New here? <Link href="/register">Create account</Link>
            </p>

            <div className="demo-box">
              <strong>Demo account:</strong>
              <div>user1@demo.com / user1demo</div>
            </div>
          </div>
        ) : null}

        {step === "forgot" ? (
          <div className="login-box">
            <button type="button" className="back-link" onClick={() => setStep("login")}>
              &lt;- Back to login
            </button>
            <h2>Recover account</h2>
            <p className="subtitle">Enter your email or username to continue.</p>

            <form onSubmit={handleForgotIdentifierSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="forgot-id" className="form-label">Email or username</label>
                <input
                  id="forgot-id"
                  type="text"
                  className="input-field"
                  placeholder="you@example.com or your_username"
                  value={forgotIdentifier}
                  onChange={(e) => { setForgotIdentifier(e.target.value); setForgotError(null); }}
                  autoComplete="username"
                />
              </div>
              {forgotError ? <p className="error-text">{forgotError}</p> : null}
              <button type="submit" className="submit-btn" disabled={forgotLoading}>
                {forgotLoading ? "Checking…" : "Continue"}
                {!forgotLoading && <Icon path={icons.arrow} color="#fff" />}
              </button>
            </form>
          </div>
        ) : null}

        {step === "verify" ? (
          <div className="login-box">
            <button type="button" className="back-link" onClick={() => { setStep("forgot"); setForgotError(null); }}>
              &lt;- Back
            </button>
            <h2>Verify your identity</h2>
            <p className="subtitle">
              Answer <strong>any one</strong> of the questions below to prove it&apos;s you.
            </p>

            <form onSubmit={handleVerifySubmit} noValidate>
              <div className="sq-group">
                <label htmlFor="v-code" className="form-label">Recovery code</label>
                <input id="v-code" type="text" className="input-field"
                  placeholder="khosh-xxxx-xxxx"
                  value={recoveryCode}
                  onChange={(e) => { setRecoveryCode(e.target.value); setForgotError(null); }}
                  autoComplete="off" />
              </div>
              <div className="sq-divider"><span>or</span></div>
              <div className="sq-group">
                <label htmlFor="v-animal" className="form-label">Favourite animal</label>
                <input id="v-animal" type="text" className="input-field"
                  placeholder="e.g. elephant"
                  value={favAnimal}
                  onChange={(e) => { setFavAnimal(e.target.value); setForgotError(null); }}
                  autoComplete="off" />
              </div>
              <div className="sq-divider"><span>or</span></div>
              <div className="sq-group">
                <label htmlFor="v-person" className="form-label">Favourite person&apos;s name</label>
                <input id="v-person" type="text" className="input-field"
                  placeholder="e.g. grandmother"
                  value={favPerson}
                  onChange={(e) => { setFavPerson(e.target.value); setForgotError(null); }}
                  autoComplete="off" />
              </div>

              {forgotError ? <p className="error-text" style={{ marginBottom: 12 }}>{forgotError}</p> : null}

              <button type="submit" className="submit-btn" disabled={forgotLoading}>
                {forgotLoading ? "Verifying…" : "Verify & reset password"}
                {!forgotLoading && <Icon path={icons.arrow} color="#fff" />}
              </button>
            </form>
          </div>
        ) : null}
      </section>

      <style jsx>{`
        .login-page {
          --bg: #0c0e14;
          --surface: #13151e;
          --border: #252836;
          --text: #e8eaf0;
          --muted: #6b7080;
          --accent: #f4845f;
          --accent2: #7b6ef6;
          --green: #4ade80;
          --red: #e74c3c;
          --serif: var(--font-dm-serif), Georgia, serif;
          --sans: var(--font-dm-sans), sans-serif;

          position: relative;
          min-height: 100vh;
          overflow-x: clip;
          background: var(--bg);
          color: var(--text);
          font-family: var(--sans);
        }

        .login-noise {
          position: fixed;
          inset: 0;
          z-index: 0;
          opacity: 0.35;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
        }

        .login-orb {
          position: fixed;
          z-index: 0;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
        }

        .login-orb-1 {
          width: 500px;
          height: 500px;
          top: -150px;
          right: -100px;
          transition: transform 0.8s cubic-bezier(0.1, 0.5, 0.1, 1);
          background: radial-gradient(circle, rgb(244 132 95 / 8%) 0%, transparent 70%);
        }

        .login-orb-2 {
          width: 400px;
          height: 400px;
          bottom: -150px;
          left: -100px;
          animation: float 8s ease-in-out infinite;
          background: radial-gradient(circle, rgb(123 110 246 / 8%) 0%, transparent 70%);
        }

        .login-container {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 96px 20px 20px;
        }

        .login-box {
          width: 100%;
          max-width: 420px;
          animation: fade-in 0.6s ease;
        }

        h1,
        h2 {
          margin: 0 0 8px;
          font-family: var(--serif);
          line-height: 1.1;
        }

        h1 {
          font-size: 32px;
        }

        h2 {
          font-size: 28px;
        }

        .subtitle {
          margin: 0 0 24px;
          color: var(--muted);
          font-size: 15px;
          font-weight: 300;
        }

        .form-group {
          margin-bottom: 18px;
        }

        .form-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .no-margin {
          margin: 0;
        }

        .label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .input-field {
          width: 100%;
          border-radius: 12px;
          border: 1.5px solid var(--border);
          background: var(--surface);
          color: var(--text);
          font: 14px var(--sans);
          outline: none;
          padding: 12px 16px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .input-field:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgb(244 132 95 / 10%);
        }

        .input-error {
          border-color: var(--red);
        }

        .error-text {
          margin-top: 6px;
          font-size: 12px;
          color: var(--red);
        }

        .form-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .checkbox-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-size: 13px;
          cursor: pointer;
        }

        .checkbox-wrapper input {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          accent-color: var(--accent);
        }

        .text-btn {
          border: 0;
          padding: 0;
          background: none;
          color: var(--muted);
          text-decoration: underline;
          font: 13px var(--sans);
          cursor: pointer;
          transition: color 0.2s;
        }

        .text-btn:hover,
        .back-link:hover {
          color: var(--text);
        }

        .submit-btn {
          width: 100%;
          border: 0;
          border-radius: 12px;
          background: var(--accent);
          color: #fff;
          font: 700 14px var(--sans);
          padding: 13px 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 20px rgb(244 132 95 / 30%);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgb(244 132 95 / 40%);
        }

        .submit-btn:disabled {
          opacity: 0.8;
          cursor: not-allowed;
        }

        .login-footer {
          margin: 24px 0 0;
          text-align: center;
          color: var(--muted);
          font-size: 13px;
        }

        .login-footer :global(a) {
          color: var(--accent);
          text-decoration: underline;
          font-weight: 600;
        }

        .login-footer :global(a):hover {
          color: #ffffff;
        }

        .demo-box {
          margin-top: 20px;
          border: 1px solid rgb(123 110 246 / 15%);
          border-radius: 10px;
          background: rgb(123 110 246 / 8%);
          color: var(--muted);
          font-size: 11px;
          padding: 12px;
        }

        .demo-box strong {
          display: block;
          margin-bottom: 6px;
          color: var(--accent2);
        }

        .demo-box div {
          font-family: "Courier New", monospace;
          font-size: 10px;
        }

        .back-link {
          margin-bottom: 24px;
          border: 0;
          padding: 0;
          background: none;
          color: var(--muted);
          text-decoration: underline;
          font: 13px var(--sans);
          cursor: pointer;
        }

        .sq-group { margin-bottom: 14px; }
        .sq-divider {
          display: flex; align-items: center; gap: 10px; margin: 2px 0 14px;
        }
        .sq-divider::before, .sq-divider::after {
          content: ""; flex: 1; height: 1px; background: var(--border);
        }
        .sq-divider span { font-size: 11px; color: var(--muted); }

        .verify-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 24px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgb(74 222 128 / 12%);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @media (max-width: 640px) {
          .login-container {
            align-items: flex-start;
            padding-top: 90px;
          }

          .login-box {
            max-width: 100%;
          }

          h1 {
            font-size: 28px;
          }
        }
      `}</style>
    </main>
  );
}
