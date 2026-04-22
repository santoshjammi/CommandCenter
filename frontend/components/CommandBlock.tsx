"use client";

import { useState } from "react";

interface CommandBlockProps {
  command: string;
  description: string;
  scenario?: string;
  language?: string;
  manPage?: string;
  tags?: string[];
}

export function CommandBlock({
  command,
  description,
  scenario,
  language,
  manPage,
  tags,
}: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silent fail
    }
  };

  const hasFooter = scenario || (tags && tags.length > 0);

  return (
    <article className="cmd-card" aria-label={description}>

      {/* ── Header bar ─────────────────────────────────────────── */}
      <div className="cmd-header">

        {/* Left: language badge + description */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {language && (
            <span className="cmd-lang-badge" aria-hidden="true">
              {language}
            </span>
          )}
          <span className="cmd-description" title={description}>
            {description}
          </span>
        </div>

        {/* Right: utility actions */}
        <div
          className="relative flex shrink-0 items-center gap-1"
          role="toolbar"
          aria-label="Command actions"
        >
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="cmd-action-btn"
            aria-label={copied ? "Copied to clipboard" : "Copy command"}
            aria-pressed={copied}
            data-success={copied ? "true" : undefined}
            title={copied ? "Copied!" : "Copy to clipboard"}
          >
            {copied ? (
              /* Check mark */
              <svg
                width="14" height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              /* Copy icon */
              <svg
                width="14" height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>

          {/* Copied tooltip */}
          {copied && (
            <span className="cmd-copy-tip" role="status" aria-live="polite">
              Copied!
            </span>
          )}

          {/* Docs / redirect button */}
          {manPage ? (
            <a
              href={manPage}
              target="_blank"
              rel="noopener noreferrer"
              className="cmd-action-btn"
              aria-label="Open documentation"
              title="Open docs"
            >
              <svg
                width="14" height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          ) : (
            <button
              type="button"
              className="cmd-action-btn"
              disabled
              aria-disabled="true"
              aria-label="No documentation available"
              title="No docs available"
            >
              <svg
                width="14" height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Code body ──────────────────────────────────────────── */}
      <div className="cmd-body" role="region" aria-label="Command code">
        <pre className="cmd-pre">
          <code>{command}</code>
        </pre>
      </div>

      {/* ── Footer: scenario + tags ────────────────────────────── */}
      {hasFooter && (
        <footer className="cmd-footer">
          {scenario && (
            <p className="cmd-scenario">
              <span className="cmd-scenario-icon" aria-hidden="true">💡</span>
              <span>{scenario}</span>
            </p>
          )}
          {tags && tags.length > 0 && (
            <div className="cmd-tags" role="list" aria-label="Tags">
              {tags.map((tag) => (
                <span key={tag} className="cmd-tag" role="listitem">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </footer>
      )}

    </article>
  );
}

