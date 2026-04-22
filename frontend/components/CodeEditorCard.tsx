"use client";

import { useState, useId, useRef, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CodeEditorCardProps {
  /** Label shown in the card header */
  title: string;
  /** Subtle sub-label shown below the title  */
  helperText?: string;
  /** The code / command string to display or edit */
  value: string;
  /** Pass to make the textarea editable */
  onChange?: (value: string) => void;
  /** Textarea placeholder */
  placeholder?: string;
  /** Called after a successful clipboard write */
  onCopy?: () => void;
  /** Opens in a new tab when provided */
  redirectUrl?: string;
  /** Grays-out the whole card */
  disabled?: boolean;
  /** true = generic red error ring; string = error ring + message under title */
  error?: boolean | string;
  /** Green success ring */
  success?: boolean;
  /** Shown as a mono badge next to the title (e.g. "bash", "python") */
  language?: string;
  /** Extra Tailwind classes applied to the outer article */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline SVG primitives used by action buttons
// ─────────────────────────────────────────────────────────────────────────────

function IconCopy() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CodeEditorCard({
  title,
  helperText,
  value,
  onChange,
  placeholder = "// …",
  onCopy,
  redirectUrl,
  disabled = false,
  error = false,
  success = false,
  language,
  className = "",
}: CodeEditorCardProps) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const errorMsg = typeof error === "string" ? error : undefined;
  const isError   = Boolean(error);
  const isSuccess = success && !isError;
  const isReadOnly = !onChange;

  // ── Auto-grow textarea to fit full content ───────────────────────────────
  // Runs after mount and whenever value changes.
  // Server renders rows={1}; client sets exact pixel height — no hydration mismatch.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";           // collapse first so shrink works too
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // ── Copy handler ─────────────────────────────────────────────────────────
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — silent */
    }
  };

  // ── Dynamic card ring class ───────────────────────────────────────────────
  // Computed once per render — no hydration risk (depends only on stable state).
  let ringClass: string;
  if (isError) {
    ringClass =
      "border-red-500/50 shadow-[0_0_0_3px_rgba(239,68,68,0.10),0_1px_4px_rgba(0,0,0,0.5)]";
  } else if (isSuccess) {
    ringClass =
      "border-[#9fe870]/60 shadow-[0_0_0_3px_rgba(159,232,112,0.12),0_1px_4px_rgba(0,0,0,0.5)]";
  } else if (focused) {
    ringClass =
      "border-[#9fe870]/45 shadow-[0_0_0_3px_rgba(159,232,112,0.10),0_4px_16px_rgba(0,0,0,0.5)]";
  } else {
    ringClass =
      "border-white/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_4px_12px_rgba(0,0,0,0.3)] hover:border-[#9fe870]/25 hover:shadow-[0_2px_8px_rgba(0,0,0,0.5),0_8px_24px_rgba(0,0,0,0.4)]";
  }

  // ── Shared action-button classes ─────────────────────────────────────────
  const btnBase =
    "inline-flex items-center justify-center h-[28px] w-[28px] rounded-lg " +
    "border transition-all duration-100 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9fe870] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a1a1c] " +
    "active:scale-95 select-none";

  const btnIdle =
    btnBase +
    " border-white/[0.09] bg-white/[0.04] text-white/50 " +
    "hover:bg-white/[0.08] hover:border-white/[0.14] hover:text-white/80";

  const btnSuccess =
    btnBase +
    " border-[#9fe870]/35 bg-[#9fe870]/10 text-[#9fe870]";

  const btnDisabled =
    btnBase +
    " border-white/[0.04] bg-transparent text-white/[0.18] cursor-not-allowed pointer-events-none";

  return (
    <article
      className={[
        // shape + surface
        "rounded-2xl border overflow-hidden",
        "bg-[#0d0e10]",
        // transition
        "transition-all duration-200",
        // ring state
        ringClass,
        // disabled
        disabled ? "opacity-50 pointer-events-none" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={title}
    >
      {/* ━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex items-center gap-3 bg-[#1c1d1f] border-b border-white/[0.055] px-4 py-3 min-h-[46px]">

        {/* Left — label + language badge + helper/error text */}
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="flex items-center gap-2 min-w-0">
            <label
              htmlFor={id}
              className="truncate text-[12.5px] font-semibold leading-tight text-white/85 cursor-default"
            >
              {title}
            </label>

            {language && (
              <span
                aria-hidden="true"
                className={
                  "shrink-0 rounded-[5px] px-[6px] py-[2px] " +
                  "font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] " +
                  "border border-[#9fe870]/20 bg-[#9fe870]/[0.07] text-[#9fe870]/65"
                }
              >
                {language}
              </span>
            )}
          </div>

          {/* Helper text */}
          {helperText && !errorMsg && (
            <p
              id={`${id}-helper`}
              className="truncate text-[11px] leading-tight text-white/35"
            >
              {helperText}
            </p>
          )}

          {/* Inline error message */}
          {errorMsg && (
            <p
              id={`${id}-error`}
              role="alert"
              className="text-[11px] leading-tight text-red-400"
            >
              {errorMsg}
            </p>
          )}
        </div>

        {/* Right — action toolbar */}
        <div
          className="flex shrink-0 items-center gap-1.5"
          role="toolbar"
          aria-label="Editor actions"
        >
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={disabled}
            aria-label={copied ? "Copied!" : "Copy to clipboard"}
            aria-pressed={copied}
            className={copied ? btnSuccess : btnIdle}
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </button>

          {/* Docs button / link */}
          {redirectUrl ? (
            <a
              href={redirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open documentation"
              className={btnIdle}
            >
              <IconExternalLink />
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-label="No documentation available"
              className={btnDisabled}
            >
              <IconExternalLink />
            </button>
          )}
        </div>
      </div>

      {/* ━━━ CODE SURFACE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <textarea
        id={id}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={isReadOnly}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        aria-invalid={isError}
        aria-describedby={
          errorMsg
            ? `${id}-error`
            : helperText
            ? `${id}-helper`
            : undefined
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={[
          // shape + surface — rounded bottom matches outer card
          "block w-full",
          "bg-[#0d0e10]",
          // typography
          "font-[JetBrains_Mono,Fira_Code,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace]",
          "text-[13px] leading-[1.7] text-[#9fe870]",
          // spacing — tighter vertically so single-line stays compact
          "px-4 py-3",
          // placeholder
          "placeholder:text-[#9fe870]/20",
          // no native border/outline — card handles focus
          "border-0 outline-none ring-0 focus:ring-0 focus:outline-none",
          // resize
          "resize-none",
          // scroll — hidden until JS sets exact height; prevents scrollbar flash
          "overflow-hidden",
          // cursor
          isReadOnly ? "cursor-default" : "cursor-text",
        ]
          .filter(Boolean)
          .join(" ")}
        ref={textareaRef}
      />
    </article>
  );
}
