"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { apiPost } from "@/lib/api";

type ToneCheckResponse = {
  score: number;
  warning: boolean;
  flagged: boolean;
  suggestion: string | null;
  reason: string | null;
};

type ThreadOut = {
  id: string;
};

function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags.slice(0, 8);
}

export default function NewThreadPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [toneResult, setToneResult] = useState<ToneCheckResponse | null>(null);
  const [showToneModal, setShowToneModal] = useState(false);
  const [toneApproved, setToneApproved] = useState(false);

  const parsedTags = useMemo(() => parseTags(tagsInput), [tagsInput]);
  const bodyCount = body.length;

  function handleBackNavigation() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/threads");
  }

  async function runToneCheck(): Promise<ToneCheckResponse> {
    const result = await apiPost<ToneCheckResponse>("ai/tone-check", { content: body });
    setToneResult(result);
    return result;
  }

  async function createThread(skipToneCheck: boolean) {
    if (!title.trim() || !body.trim()) {
      setErrorMessage("Title and body are required.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (!skipToneCheck) {
        const tone = await runToneCheck();
        if (tone.warning) {
          setShowToneModal(true);
          setIsSubmitting(false);
          return;
        }
      }

      const created = await apiPost<ThreadOut>("threads", {
        title: title.trim(),
        body: body.trim(),
        tags: parsedTags,
      });

      router.push(`/threads/${created.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create thread";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="create-page">
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <nav>
        <div className="nav-left">
          <button className="logo" type="button" onClick={() => router.push("/")}>
            <span className="logo-box">K</span>
            <span className="logo-text">KhoshGolpo</span>
          </button>
        </div>
        <button type="button" className="back-btn" onClick={handleBackNavigation}>
          <ArrowLeft size={16} />
          Back to Threads
        </button>
      </nav>

      <div className="wrapper">
        <div className="container">
          <header className="page-header">
            <h1 className="page-title">Create New Thread</h1>
            <p className="page-subtitle">Start a focused discussion with context and warmth.</p>
          </header>

          <section className="form-section">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                type="text"
                placeholder="What do you want to discuss?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tags (comma separated)</label>
              <input
                type="text"
                placeholder="fastapi, backend, career"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
              {parsedTags.length > 0 ? (
                <div className="tags-section">
                  {parsedTags.map((tag) => (
                    <span key={tag} className="tag-badge">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="form-group">
              <label className="form-label">Body</label>
              <textarea
                placeholder="Share context, constraints, and what feedback you want..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="char-counter">
                <span className="tone-chip">
                  <Sparkles size={13} />
                  {toneResult ? `Tone ${toneResult.score.toFixed(2)}${toneResult.warning ? " - warning" : " - clear"}` : "No tone check yet"}
                </span>
                <span className={`char-count ${bodyCount > 1800 ? "warning" : ""}`}>{bodyCount}/2400</span>
              </div>
            </div>

            {errorMessage ? <div className="error">{errorMessage}</div> : null}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!body.trim() || isSubmitting}
                onClick={async () => {
                  try {
                    setErrorMessage(null);
                    await runToneCheck();
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "Tone check failed";
                    setErrorMessage(message);
                  }
                }}
              >
                Tone Check Preview
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={() => createThread(false)}
              >
                {isSubmitting ? "Creating..." : "Create Thread"}
              </button>
            </div>
          </section>
        </div>
      </div>

      {showToneModal ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Tone Warning</h3>
            <p className="modal-subtitle">Your draft may read as harsh. You can edit first or post anyway.</p>
            <div className="modal-box">Score: {toneResult ? toneResult.score.toFixed(2) : "-"}</div>
            {toneResult?.reason ? <div className="modal-box">Reason: {toneResult.reason}</div> : null}
            {toneResult?.suggestion ? (
              <div className="modal-box suggestion">Suggestion: {toneResult.suggestion}</div>
            ) : null}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowToneModal(false);
                  setToneApproved(false);
                }}
              >
                Edit Draft
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (toneApproved) return;
                  setToneApproved(true);
                  setShowToneModal(false);
                  await createThread(true);
                  setToneApproved(false);
                }}
              >
                Post Anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .create-page {
          --bg: #0c0e14;
          --surface: #13151e;
          --surface2: #1a1d2a;
          --border: #252836;
          --text: #e8eaf0;
          --muted: #6b7080;
          --accent: #f4845f;
          --accent2: #7b6ef6;
          --yellow: #fbbf24;
          --red: #e74c3c;
          --serif: var(--font-dm-serif), Georgia, serif;
          --sans: var(--font-dm-sans), sans-serif;

          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          overflow: hidden;
          position: relative;
          font-family: var(--sans);
        }
        .create-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 0;
          opacity: 0.35;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
        }
        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          z-index: 0;
        }
        .orb-1 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(244, 132, 95, 0.08) 0%, transparent 70%);
          top: -150px;
          right: -100px;
        }
        .orb-2 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(123, 110, 246, 0.08) 0%, transparent 70%);
          bottom: -150px;
          left: -100px;
        }
        nav {
          position: sticky;
          top: 0;
          z-index: 10;
          padding: 16px 24px;
          background: rgba(12, 14, 20, 0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .nav-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          background: none;
          border: none;
          cursor: pointer;
        }
        .logo-box {
          width: 32px;
          height: 32px;
          background: var(--accent);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--serif);
          font-size: 18px;
          color: #fff;
          font-weight: bold;
        }
        .logo-text {
          font-family: var(--serif);
          font-size: 20px;
          color: var(--text);
        }
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #c8cfdf;
          text-decoration: none;
          font-size: 13px;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 10px;
          padding: 8px 12px;
          transition: border-color 0.2s, color 0.2s, background 0.2s;
        }
        .back-btn:hover {
          color: var(--text);
          border-color: #3a4157;
          background: var(--surface2);
        }
        .wrapper {
          position: relative;
          z-index: 1;
          height: calc(100vh - 65px);
          overflow-y: auto;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 40px 24px;
        }
        .page-header {
          margin-bottom: 36px;
        }
        .page-title {
          font-family: var(--serif);
          font-size: 38px;
          line-height: 1.1;
          margin-bottom: 8px;
        }
        .page-subtitle {
          font-size: 16px;
          color: var(--muted);
          font-weight: 300;
        }
        .form-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 30px;
        }
        .form-group {
          margin-bottom: 24px;
        }
        .form-label {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
          display: block;
        }
        input,
        textarea {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          background: var(--surface2);
          border: 1.5px solid var(--border);
          color: var(--text);
          font-family: inherit;
          font-size: 14px;
          outline: none;
        }
        textarea {
          min-height: 170px;
          line-height: 1.7;
          resize: vertical;
        }
        input:focus,
        textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(244, 132, 95, 0.1);
        }
        .tags-section {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        .tag-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          background: var(--accent2);
          color: #fff;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .char-counter {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          font-size: 12px;
          color: var(--muted);
        }
        .tone-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .char-count.warning {
          color: var(--yellow);
        }
        .error {
          border: 1px solid rgba(231, 76, 60, 0.35);
          background: rgba(231, 76, 60, 0.1);
          color: #fca5a5;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .form-actions {
          margin-top: 26px;
          padding-top: 22px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .btn {
          border: none;
          border-radius: 10px;
          padding: 11px 18px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-ghost {
          background: var(--surface2);
          border: 1px solid var(--border);
          color: var(--text);
        }
        .btn-primary {
          background: var(--accent);
          color: #fff;
        }
        .btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          background: rgba(7, 8, 13, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .modal {
          width: min(540px, 100%);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 20px;
        }
        .modal h3 {
          font-family: var(--serif);
          font-size: 28px;
          margin-bottom: 8px;
        }
        .modal-subtitle {
          color: var(--muted);
          font-size: 14px;
          margin-bottom: 14px;
        }
        .modal-box {
          border: 1px solid var(--border);
          background: var(--surface2);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .modal-box.suggestion {
          border-color: rgba(244, 132, 95, 0.4);
          background: rgba(244, 132, 95, 0.12);
          color: #f7b097;
        }
        .modal-actions {
          margin-top: 14px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        @media (max-width: 768px) {
          .container {
            padding: 26px 14px;
          }
          .form-section {
            padding: 20px;
          }
          .page-title {
            font-size: 30px;
          }
          .form-actions {
            flex-direction: column;
          }
          .btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
