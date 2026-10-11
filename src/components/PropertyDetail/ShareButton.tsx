"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { whatsappUrl } from "@/lib/propertyUtils";
import { buildShareUrl, createPropertyShare } from "@/services/shareService";

type ShareStatus = "idle" | "loading" | "ready" | "error";

type ShareButtonProps = {
  /** Must be the property's `property_id`. */
  propertyId: string;
  propertyName: string;
  /** Prefilled WhatsApp text sent along with the share. */
  message: string;
  className?: string;
};

/**
 * Mints a tracked share link for a property and displays it in a clean popup modal.
 *
 * Uses createPortal(..., document.body) to ensure the popup escapes all
 * ancestor positioning, flex containers, and overflow clipping so it is
 * always perfectly centered on screen.
 */
export default function ShareButton({
  propertyId,
  propertyName,
  message,
  className = "",
}: ShareButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Lock body scroll and listen for Escape key when popup is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // A different property means a stale link must not linger.
  useEffect(() => {
    setStatus("idle");
    setShareUrl("");
    setCopied(false);
    setIsOpen(false);
  }, [propertyId]);

  const create = async () => {
    setStatus("loading");
    try {
      const result = await createPropertyShare({
        entityId: propertyId,
        message,
      });
      const token = result.tracking_token ?? "";
      const url = token ? buildShareUrl(token, window.location.origin) : "";
      setShareUrl(url);
      setStatus("ready");
    } catch (error) {
      console.warn("[share] create failed", error);
      setStatus("error");
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (!shareUrl && status !== "loading") {
      void create();
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const modalContent = isOpen && mounted ? (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 overflow-y-auto"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0c0e10]/80 backdrop-blur-xs transition-opacity"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Dialog Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="relative z-10 w-full max-w-[min(26rem,calc(100vw-2rem))] mx-auto rounded-2xl border border-[rgba(201,168,76,0.3)] bg-[#12151a] p-5 sm:p-6 text-[#f4f5f7] shadow-[0_28px_60px_rgba(0,0,0,0.65)]"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 100% 0%, rgba(201, 168, 76, 0.14), transparent 55%), #12151a",
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          className="absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/6 text-white/70 transition hover:bg-white/12 hover:text-white"
          aria-label="Close dialog"
          onClick={() => setIsOpen(false)}
        >
          ✕
        </button>

        {/* Header */}
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#c9a84c]">
          Share Property
        </p>
        <h2 id="share-modal-title" className="mt-1 text-base font-bold text-white tracking-tight pr-6">
          {propertyName}
        </h2>

        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <span className="ila-loader ila-loader--sm" aria-hidden="true" />
            <p className="text-xs text-white/60">Creating tracked link…</p>
          </div>
        )}

        {status === "error" && (
          <div className="py-6 text-center">
            <p className="text-xs text-rose-400">
              We could not create a share link. Please try again.
            </p>
            <button
              type="button"
              onClick={create}
              className="mt-3 inline-flex items-center justify-center rounded-full bg-[#c9a84c] px-4 py-2 text-xs font-bold text-[#0f1114] uppercase tracking-wider transition hover:bg-[#d4b57e]"
            >
              Retry share
            </button>
          </div>
        )}

        {status === "ready" && shareUrl && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50 mb-1.5">
              Tracked link
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-black/40 p-2.5">
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                title={shareUrl}
                className="flex-1 font-mono text-[11px] text-[#d4b57e] hover:text-[#f3e3be] hover:underline underline-offset-2 truncate transition"
              >
                {shareUrl}
              </a>
              <button
                type="button"
                onClick={copy}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  copied
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                }`}
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <a
                href={whatsappUrl(`${message}\n${shareUrl}`)}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c9a84c] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0f1114] shadow-md transition hover:bg-[#d4b57e]"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M19.05 4.93A9.82 9.82 0 0 0 12.04 2a9.94 9.94 0 0 0-8.6 14.92L2 22l5.25-1.38A9.94 9.94 0 0 0 22 12.04a9.83 9.83 0 0 0-2.95-7.11Zm-7.01 15.16a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.12.82.83-3.04-.2-.31a8.1 8.1 0 1 1 6.92 3.84Zm4.45-6.08c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.68 2.56 4.07 3.59.57.25 1.01.4 1.35.51.57.18 1.09.16 1.5.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
                </svg>
                Share on WhatsApp
              </a>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-full border border-white/16 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
              >
                Open link in new tab ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className={`pd-share pd-share--bare ${className}`}>
        <button
          type="button"
          className="pd-btn pd-btn--ghost pd-share-trigger"
          onClick={handleOpen}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={`Share ${propertyName}`}
          title={`Share ${propertyName}`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.3 3.3 0 0 0 0-1.4l7.05-4.11A3 3 0 1 0 15 5.5c0 .24.03.47.08.69L8.03 10.3a3 3 0 1 0 0 3.4l7.12 4.16c-.04.2-.06.4-.06.62A2.92 2.92 0 1 0 18 16.08Z" />
          </svg>
          <span>Share</span>
        </button>
      </div>

      {mounted && typeof document !== "undefined" && modalContent
        ? createPortal(modalContent, document.body)
        : null}
    </>
  );
}