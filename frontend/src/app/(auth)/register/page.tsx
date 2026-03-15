"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import NavBar from "@/components/public/sections/NavBar";
import { useAuth } from "@/hooks";

type FormErrors = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const icons = {
  user: "M12 12a5 5 0 100-10 5 5 0 000 10zM3 21a9 9 0 0118 0",
  mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  lock: "M12 1c-3.866 0-7 3.134-7 7v3H3a2 2 0 00-2 2v8a2 2 0 002 2h18a2 2 0 002-2v-8a2 2 0 00-2-2h-2V8c0-3.866-3.134-7-7-7z",
  arrow: "M5 12h14M12 5l7 7-7 7",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  copy: "M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4v4h8V4M8 4a2 2 0 012-2h0a2 2 0 012 2",
  check: "M20 6L9 17l-5-5",
} as const;

function Icon({ path, size = 14, color = "currentColor" }: { path: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function emailIsValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function RegisterPage() {
  const router = useRouter();
  const orbRef = useRef<HTMLDivElement | null>(null);
  const { register, isLoading, error } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [favAnimal, setFavAnimal] = useState("");
  const [favPerson, setFavPerson] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};

    if (!firstName.trim()) nextErrors.firstName = "Please enter your first name";
    if (!lastName.trim()) nextErrors.lastName = "Please enter your last name";
    if (!username.trim()) nextErrors.username = "Please choose a username";
    if (!email.trim()) nextErrors.email = "Please enter your email";
    else if (!emailIsValid(email)) nextErrors.email = "Please enter a valid email";
    if (!password.trim()) nextErrors.password = "Please create a password";
    else if (password.length < 6) nextErrors.password = "Password must be at least 6 characters";
    if (!confirmPassword.trim()) nextErrors.confirmPassword = "Please confirm your password";
    else if (confirmPassword !== password) nextErrors.confirmPassword = "Passwords do not match";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

    try {
      const code = await register(
        username.trim().toLowerCase(),
        email.trim().toLowerCase(),
        displayName,
        password,
        {
          fav_animal: favAnimal.trim() || undefined,
          fav_person: favPerson.trim() || undefined,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          gender: gender || undefined,
        }
      );
      setRecoveryCode(code);
    } catch {}
  }

  function copyCode() {
    if (!recoveryCode) return;
    void navigator.clipboard.writeText(recoveryCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="register-page">
      <NavBar />
      <div className="register-noise" aria-hidden="true" />
      <div ref={orbRef} className="register-orb register-orb-1" aria-hidden="true" />
      <div className="register-orb register-orb-2" aria-hidden="true" />

      <section className="register-container">
        {recoveryCode ? (
          <div className="register-box recovery-box">
            <div className="recovery-icon" aria-hidden="true">
              <Icon path={icons.shield} size={36} color="#7c73f0" />
            </div>
            <h1>Save your recovery code</h1>
            <p className="subtitle">
              This is shown <strong>only once</strong>. Store it somewhere safe —
              you will need it to recover your account if you forget your password.
            </p>

            <div className="code-block">
              <span className="code-text">{recoveryCode}</span>
              <button type="button" className="copy-btn" onClick={copyCode} aria-label="Copy code">
                <Icon path={copied ? icons.check : icons.copy} size={15} color={copied ? "#3dd68c" : "currentColor"} />
              </button>
            </div>

            <p className="code-hint">
              Your favourite animal and person name also work as backup — any one of the three unlocks your account.
            </p>

            <button type="button" className="submit-btn" onClick={() => router.push("/threads")}>
              I&apos;ve saved it — continue
              <Icon path={icons.arrow} color="#fff" />
            </button>
          </div>
        ) : (
          <div className="register-box">
            <h1>Create account</h1>
            <p className="subtitle">Join KhoshGolpo and start thoughtful conversations.</p>

            <form onSubmit={onSubmit} noValidate>
              <div className="name-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="register-first-name" className="form-label">
                    <Icon path={icons.user} />First name
                  </label>
                  <input id="register-first-name" type="text" placeholder="First"
                    className={`input-field ${errors.firstName ? "input-error" : ""}`}
                    value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  {errors.firstName ? <p className="error-text">{errors.firstName}</p> : null}
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="register-last-name" className="form-label">
                    Last name
                  </label>
                  <input id="register-last-name" type="text" placeholder="Last"
                    className={`input-field ${errors.lastName ? "input-error" : ""}`}
                    value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  {errors.lastName ? <p className="error-text">{errors.lastName}</p> : null}
                </div>
              </div>

              <div className="form-group">
                <span className="form-label">Gender <span className="optional-badge" style={{ marginLeft: 4 }}>optional</span></span>
                <div className="gender-pills">
                  {["Male", "Female", "Non-binary", "Prefer not to say"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`gender-pill${gender === opt ? " gender-pill-active" : ""}`}
                      onClick={() => setGender(prev => prev === opt ? "" : opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="register-username" className="form-label">
                  <Icon path={icons.user} />Username
                </label>
                <input id="register-username" type="text" placeholder="your_username"
                  className={`input-field ${errors.username ? "input-error" : ""}`}
                  value={username} onChange={(e) => setUsername(e.target.value)} />
                {errors.username ? <p className="error-text">{errors.username}</p> : null}
              </div>

              <div className="form-group">
                <label htmlFor="register-email" className="form-label">
                  <Icon path={icons.mail} />Email
                </label>
                <input id="register-email" type="email" placeholder="you@example.com"
                  className={`input-field ${errors.email ? "input-error" : ""}`}
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                {errors.email ? <p className="error-text">{errors.email}</p> : null}
              </div>

              <div className="form-group">
                <div className="label-row">
                  <label htmlFor="register-password" className="form-label no-margin">
                    <Icon path={icons.lock} />Password
                  </label>
                  <button type="button" className="text-btn" onClick={() => setShowPassword((p) => !p)}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input id="register-password" type={showPassword ? "text" : "password"}
                  placeholder="Create password"
                  className={`input-field ${errors.password ? "input-error" : ""}`}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                {errors.password ? <p className="error-text">{errors.password}</p> : null}
              </div>

              <div className="form-group">
                <div className="label-row">
                  <label htmlFor="register-confirm-password" className="form-label no-margin">
                    <Icon path={icons.lock} />Confirm password
                  </label>
                  <button type="button" className="text-btn" onClick={() => setShowConfirmPassword((p) => !p)}>
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input id="register-confirm-password" type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  className={`input-field ${errors.confirmPassword ? "input-error" : ""}`}
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                {errors.confirmPassword ? <p className="error-text">{errors.confirmPassword}</p> : null}
              </div>

              {/* ── Recovery setup ── */}
              <div className="recovery-section">
                <div className="recovery-header">
                  <Icon path={icons.shield} size={13} color="#7c73f0" />
                  <span>Account recovery <span className="optional-badge">optional</span></span>
                </div>
                <p className="recovery-desc">
                  Set at least one so you can recover your account without email.
                </p>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label htmlFor="register-animal" className="form-label">Favourite animal</label>
                  <input id="register-animal" type="text" placeholder="e.g. elephant"
                    className="input-field" value={favAnimal}
                    onChange={(e) => setFavAnimal(e.target.value)} autoComplete="off" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="register-person" className="form-label">Favourite person&apos;s name</label>
                  <input id="register-person" type="text" placeholder="e.g. grandmother"
                    className="input-field" value={favPerson}
                    onChange={(e) => setFavPerson(e.target.value)} autoComplete="off" />
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create account"}
                <Icon path={icons.arrow} color="#ffffff" />
              </button>
              {error ? <p className="error-text">{error}</p> : null}
            </form>

            <p className="register-footer">
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
          </div>
        )}
      </section>

      <style jsx>{`
        .register-page {
          --bg: #0c0e14; --surface: #13151e; --border: #252836;
          --text: #e8eaf0; --muted: #6b7080; --accent: #f4845f;
          --accent2: #7b6ef6; --red: #e74c3c;
          --serif: var(--font-dm-serif), Georgia, serif;
          --sans: var(--font-dm-sans), sans-serif;
          position: relative; min-height: 100vh; overflow-x: clip;
          background: var(--bg); color: var(--text); font-family: var(--sans);
        }
        .register-noise { position: fixed; inset: 0; z-index: 0; opacity: 0.35; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); }
        .register-orb { position: fixed; z-index: 0; border-radius: 50%; filter: blur(100px); pointer-events: none; }
        .register-orb-1 { width: 500px; height: 500px; top: -150px; right: -100px; transition: transform 0.8s cubic-bezier(0.1,0.5,0.1,1); background: radial-gradient(circle, rgb(244 132 95 / 8%) 0%, transparent 70%); }
        .register-orb-2 { width: 400px; height: 400px; bottom: -150px; left: -100px; background: radial-gradient(circle, rgb(123 110 246 / 8%) 0%, transparent 70%); }
        .register-container { position: relative; z-index: 1; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 94px 20px 32px; }
        .register-box { width: 100%; max-width: 420px; border: 1px solid var(--border); border-radius: 18px; background: rgb(19 21 30 / 82%); backdrop-filter: blur(10px); padding: 20px; }
        h1 { font-family: var(--serif); font-size: clamp(32px, 5vw, 46px); line-height: 1; margin-bottom: 8px; }
        .subtitle { font-size: 15px; color: var(--muted); margin-bottom: 22px; }
        .name-row { display: flex; gap: 10px; margin-bottom: 0; }
        .name-row .form-group { margin-bottom: 13px; }
        .form-group { margin-bottom: 13px; }
        .form-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
        .gender-pills { display: flex; flex-wrap: wrap; gap: 7px; }
        .gender-pill { padding: 6px 13px; border-radius: 999px; border: 1.5px solid var(--border); background: var(--surface); color: var(--muted); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
        .gender-pill:hover { border-color: var(--accent); color: var(--text); }
        .gender-pill-active { border-color: var(--accent); background: rgba(244,132,95,0.1); color: var(--accent); }
        .label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .no-margin { margin-bottom: 0; }
        .input-field { width: 100%; padding: 11px 14px; border-radius: 11px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text); font-size: 14px; outline: none; box-sizing: border-box; }
        .input-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgb(244 132 95 / 10%); }
        .input-error { border-color: var(--red); }
        .text-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; }
        .submit-btn { width: 100%; padding: 12px 0; border-radius: 12px; border: none; background: var(--accent); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 4px 20px rgb(244 132 95 / 25%); }
        .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 28px rgb(244 132 95 / 35%); }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .error-text { font-size: 12px; color: var(--red); margin-top: 6px; }
        .register-footer { margin-top: 16px; font-size: 14px; color: var(--muted); }
        .register-footer a { color: var(--accent); text-decoration: none; font-weight: 600; }
        .recovery-section { border: 1px solid rgba(123,110,246,0.2); border-radius: 12px; padding: 14px; margin-bottom: 14px; background: rgba(123,110,246,0.04); }
        .recovery-header { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: #a89cf7; margin-bottom: 6px; }
        .optional-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; background: rgba(123,110,246,0.15); color: #a89cf7; border-radius: 4px; padding: 1px 5px; }
        .recovery-desc { font-size: 12px; color: var(--muted); margin-bottom: 10px; }
        .recovery-box { text-align: center; }
        .recovery-icon { width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 20px; display: flex; align-items: center; justify-content: center; background: rgba(124,115,240,0.12); }
        .code-block { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #0d0f18; border: 1px solid rgba(124,115,240,0.3); border-radius: 12px; padding: 14px 16px; margin: 20px 0 12px; }
        .code-text { font-family: monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.08em; color: #c4bdff; }
        .copy-btn { background: none; border: none; cursor: pointer; padding: 4px; color: #7c73f0; border-radius: 6px; display: flex; transition: background 0.15s; }
        .copy-btn:hover { background: rgba(124,115,240,0.15); }
        .code-hint { font-size: 13px; color: var(--muted); margin-bottom: 24px; line-height: 1.5; }
      `}</style>
    </main>
  );
}
