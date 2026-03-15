"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";
import type { ReactElement, ReactNode } from "react";

// ─── Sanitize config ──────────────────────────────────────────────────────────
// Allow everything defaultSchema allows, but block raw HTML and unsafe links.
const sanitizeOptions = {
  ...defaultSchema,
  // Only allow http/https links (block javascript:, data:, etc.)
  attributes: {
    ...defaultSchema.attributes,
    a: [["href", /^https?:\/\//]],
  },
};

// ─── Mention regex ────────────────────────────────────────────────────────────
const MENTION_RE = /(^|[\s([{"'.,!?;:])(@[a-zA-Z0-9_.-]{1,30})/g;

function splitMentions(text: string): (string | ReactElement)[] {
  const parts: (string | ReactElement)[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_RE)) {
    const prefix = match[1];
    const mention = match[2];
    const matchStart = match.index ?? 0;
    const mentionStart = matchStart + prefix.length;
    if (mentionStart > last) parts.push(text.slice(last, mentionStart));
    else if (matchStart > last) parts.push(text.slice(last, matchStart));
    if (prefix) parts.push(prefix);
    parts.push(
      <span key={`m-${mentionStart}`} className="rt-mention">
        {mention}
      </span>
    );
    last = mentionStart + mention.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Custom renderer: intercept text nodes to highlight @mentions
function textRenderer(text: string): (string | ReactElement)[] {
  if (!text.includes("@")) return [text];
  return splitMentions(text);
}

// ─── Component map ────────────────────────────────────────────────────────────
function buildComponents(variant: "full" | "compact"): Components {
  return {
    // Paragraphs — split mentions inside
    p({ children }) {
      return (
        <p className={variant === "compact" ? "rt-p-compact" : "rt-p"}>
          {processChildren(children)}
        </p>
      );
    },
    // Headings — only in full variant
    h1: variant === "full" ? ({ children }) => <h1 className="rt-h1">{children}</h1> : "p",
    h2: variant === "full" ? ({ children }) => <h2 className="rt-h2">{children}</h2> : "p",
    h3: variant === "full" ? ({ children }) => <h3 className="rt-h3">{children}</h3> : "p",
    // Inline
    strong: ({ children }) => <strong className="rt-strong">{children}</strong>,
    em: ({ children }) => <em className="rt-em">{children}</em>,
    del: ({ children }) => <del className="rt-del">{children}</del>,
    // Code
    code({ children, className }) {
      const isBlock = className?.startsWith("language-");
      if (isBlock) {
        return <code className="rt-code-block">{children}</code>;
      }
      return <code className="rt-code-inline">{children}</code>;
    },
    pre: ({ children }) => <pre className="rt-pre">{children}</pre>,
    // Blockquote
    blockquote: ({ children }) => (
      <blockquote className="rt-blockquote">{children}</blockquote>
    ),
    // Lists
    ul: ({ children }) => <ul className="rt-ul">{children}</ul>,
    ol: ({ children }) => <ol className="rt-ol">{children}</ol>,
    li: ({ children }) => <li className="rt-li">{children}</li>,
    // Links — open in new tab, safe
    a({ href, children }) {
      if (!href?.match(/^https?:\/\//)) return <>{children}</>;
      return (
        <a href={href} className="rt-link" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
  };
}

// Walk ReactMarkdown children and apply mention splitting to plain strings
function processChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") return textRenderer(children);
  if (Array.isArray(children)) return children.map((c, i) => {
    if (typeof c === "string") {
      const parts = textRenderer(c);
      return parts.length === 1 && typeof parts[0] === "string"
        ? parts[0]
        : <span key={i}>{parts}</span>;
    }
    return c;
  });
  return children;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface RichTextProps {
  content: string;
  /** "full" renders headings and full prose; "compact" flattens headings to <p> */
  variant?: "full" | "compact";
  className?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RichText({
  content,
  variant = "full",
  className,
}: RichTextProps) {
  return (
    <div className={`rt-root${className ? ` ${className}` : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeOptions]]}
        components={buildComponents(variant)}
      >
        {content}
      </ReactMarkdown>
      <style jsx>{`
        /* ── Root ─────────────────────────────────────────── */
        .rt-root { color: #c4cbe0; font-size: 13px; line-height: 1.65; }

        /* ── Paragraphs ───────────────────────────────────── */
        .rt-root :global(.rt-p)         { margin: 0 0 8px; }
        .rt-root :global(.rt-p:last-child) { margin-bottom: 0; }
        .rt-root :global(.rt-p-compact) { margin: 0; }

        /* ── Headings ─────────────────────────────────────── */
        .rt-root :global(.rt-h1) { font-size: 18px; font-weight: 700; color: #e8eaf6; margin: 12px 0 6px; line-height: 1.3; }
        .rt-root :global(.rt-h2) { font-size: 15px; font-weight: 700; color: #e8eaf6; margin: 10px 0 5px; line-height: 1.3; }
        .rt-root :global(.rt-h3) { font-size: 13px; font-weight: 700; color: #e8eaf6; margin: 8px 0 4px; line-height: 1.3; }

        /* ── Inline ───────────────────────────────────────── */
        .rt-root :global(.rt-strong) { font-weight: 700; color: #dde1f0; }
        .rt-root :global(.rt-em)     { font-style: italic; color: #b8c0d8; }
        .rt-root :global(.rt-del)    { text-decoration: line-through; color: #7a7f99; }

        /* ── Code ─────────────────────────────────────────── */
        .rt-root :global(.rt-code-inline) {
          background: #1e2235;
          color: #f0834a;
          font-family: 'Fira Code', 'Courier New', monospace;
          font-size: 12px;
          padding: 1px 5px;
          border-radius: 4px;
          border: 1px solid #2a2f45;
        }
        .rt-root :global(.rt-pre) {
          background: #10131d;
          border: 1px solid #1e2235;
          border-radius: 6px;
          padding: 10px 12px;
          overflow-x: auto;
          margin: 8px 0;
        }
        .rt-root :global(.rt-code-block) {
          font-family: 'Fira Code', 'Courier New', monospace;
          font-size: 12px;
          color: #a8d8a8;
          white-space: pre;
        }

        /* ── Blockquote ───────────────────────────────────── */
        .rt-root :global(.rt-blockquote) {
          border-left: 3px solid #7c73f0;
          margin: 8px 0;
          padding: 4px 0 4px 12px;
          color: #8a90aa;
          font-style: italic;
        }

        /* ── Lists ────────────────────────────────────────── */
        .rt-root :global(.rt-ul),
        .rt-root :global(.rt-ol) {
          padding-left: 20px;
          margin: 6px 0;
        }
        .rt-root :global(.rt-ul) { list-style-type: disc; }
        .rt-root :global(.rt-ol) { list-style-type: decimal; }
        .rt-root :global(.rt-li) { margin: 2px 0; line-height: 1.55; }

        /* ── Links ────────────────────────────────────────── */
        .rt-root :global(.rt-link) {
          color: #7c73f0;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .rt-root :global(.rt-link:hover) { color: #a09af8; }

        /* ── Mentions ─────────────────────────────────────── */
        .rt-root :global(.rt-mention) {
          color: #f0834a;
          font-weight: 600;
          background: rgba(240, 131, 74, 0.12);
          border-radius: 3px;
          padding: 0 2px;
        }
      `}</style>
    </div>
  );
}
