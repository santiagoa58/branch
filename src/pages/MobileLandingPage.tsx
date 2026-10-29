import { useState } from "react";
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { APP_URL, FEATURES, USE_CASES } from "@/constants/landing";

const PREVIEW_VIDEO_URL = import.meta.env.VITE_PREVIEW_VIDEO_URL || "";

export function MobileLandingPage() {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const hasVideo = Boolean(PREVIEW_VIDEO_URL) && !videoError;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers that deny clipboard without user gesture
      const el = document.createElement("input");
      el.value = APP_URL;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center overflow-x-hidden">
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="w-full flex flex-col items-center px-6 pt-14 pb-10 gap-6 text-center">
        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-2xl bg-zinc-700/30 scale-150" />
          <img
            src="/branch-mark.svg"
            alt="Branch logo"
            className="relative w-20 h-20 drop-shadow-xl"
          />
        </div>

        {/* Name + tagline */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Branch</h1>
          <p className="text-zinc-300 text-base leading-relaxed max-w-xs">
            Design and simulate software architecture — visually.
          </p>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
            Capture not just <em className="text-zinc-400 not-italic">what</em> components exist,
            but <em className="text-zinc-400 not-italic">how data flows</em> between them.
          </p>
        </div>

        {/* "Desktop only" badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Best experienced on desktop
        </span>
      </section>

      {/* ── Screenshot ───────────────────────────────── */}
      <section className="w-full px-5 pb-10 flex justify-center">
        <div className="w-full max-w-sm rounded-xl overflow-hidden border border-zinc-800 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
          {/* Browser chrome bar */}
          <div className="bg-zinc-900 px-3 py-2.5 flex items-center gap-2 border-b border-zinc-800">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <div className="flex-1 mx-2 h-5 rounded-md bg-zinc-800 flex items-center px-2.5">
              <span className="text-zinc-500 text-[10px] font-mono tracking-tight truncate">
                localhost:5173
              </span>
            </div>
          </div>

          {/* Video, screenshot, or SVG placeholder — in priority order */}
          {hasVideo ? (
            <video
              src={PREVIEW_VIDEO_URL}
              className="w-full object-cover object-top"
              autoPlay
              muted
              loop
              playsInline
              onError={() => setVideoError(true)}
            />
          ) : !imgError ? (
            <img
              src="/screenshot.png"
              alt="Branch editor preview"
              className="w-full object-cover object-top"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="bg-zinc-900 aspect-video flex flex-col items-center justify-center gap-2 p-4">
              {/* Placeholder diagram mockup */}
              <svg
                viewBox="0 0 280 160"
                className="w-full opacity-30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Nodes */}
                <rect
                  x="10"
                  y="60"
                  width="60"
                  height="36"
                  rx="6"
                  fill="#3f3f46"
                  stroke="#52525b"
                  strokeWidth="1"
                />
                <rect
                  x="110"
                  y="20"
                  width="60"
                  height="36"
                  rx="6"
                  fill="#3f3f46"
                  stroke="#52525b"
                  strokeWidth="1"
                />
                <rect
                  x="110"
                  y="100"
                  width="60"
                  height="36"
                  rx="6"
                  fill="#3f3f46"
                  stroke="#52525b"
                  strokeWidth="1"
                />
                <rect
                  x="210"
                  y="60"
                  width="60"
                  height="36"
                  rx="6"
                  fill="#3f3f46"
                  stroke="#52525b"
                  strokeWidth="1"
                />
                {/* Edges */}
                <line x1="70" y1="78" x2="110" y2="38" stroke="#52525b" strokeWidth="1.5" />
                <line x1="70" y1="78" x2="110" y2="118" stroke="#52525b" strokeWidth="1.5" />
                <line x1="170" y1="38" x2="210" y2="78" stroke="#52525b" strokeWidth="1.5" />
                <line x1="170" y1="118" x2="210" y2="78" stroke="#52525b" strokeWidth="1.5" />
                {/* Labels */}
                <text x="40" y="82" textAnchor="middle" fill="#71717a" fontSize="8">
                  Client
                </text>
                <text x="140" y="43" textAnchor="middle" fill="#71717a" fontSize="8">
                  Gateway
                </text>
                <text x="140" y="122" textAnchor="middle" fill="#71717a" fontSize="8">
                  Database
                </text>
                <text x="240" y="82" textAnchor="middle" fill="#71717a" fontSize="8">
                  Service
                </text>
              </svg>
              <p className="text-zinc-600 text-[11px] text-center">
                Add{" "}
                <code className="bg-zinc-800 px-1 rounded text-zinc-500">
                  public/screenshot.png
                </code>{" "}
                to show a preview
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Use cases ────────────────────────────────── */}
      <section className="w-full px-5 pb-10 flex justify-center">
        <div className="w-full max-w-sm flex flex-col gap-1.5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">
            Use cases
          </p>
          {USE_CASES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3.5 py-3"
            >
              <Icon className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-zinc-200 leading-none mb-0.5">{label}</p>
                <p className="text-xs text-zinc-500 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section className="w-full px-5 pb-10 flex justify-center">
        <div className="w-full max-w-sm grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 flex flex-col gap-2"
            >
              <Icon className="w-4.5 h-4.5 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-100">{title}</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="w-full px-5 pb-14 flex justify-center">
        <div className="w-full max-w-sm flex flex-col gap-3">
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-900 text-sm font-semibold py-3.5 rounded-md shadow-sm transition-colors"
          >
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            Open on Desktop
          </a>

          <button
            type="button"
            onClick={() => {
              void copyLink();
            }}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium py-3.5 rounded-md transition-colors"
          >
            {copied ? (
              <>
                <CheckIcon className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Link copied!</span>
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="w-4 h-4" />
                Copy link to share
              </>
            )}
          </button>

          <p className="text-center text-zinc-700 text-xs mt-1">{APP_URL}</p>
        </div>
      </section>
    </div>
  );
}
