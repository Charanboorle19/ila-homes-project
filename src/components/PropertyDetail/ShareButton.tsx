"use client";

import { useEffect, useRef, useState } from "react";
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
 * Mints a tracked share link for a property.
 *
 * POST /api/shares only runs when the button is pressed — a share that nobody
 * asked for would inflate the property's share count against the visitor's
 * intent. The returned tracking_token becomes the link, which is then offered
 * for copying or forwarding on WhatsApp (the channel the share was created
 * for).
 *
 * Every click mints a fresh token, so the link a visitor sends always reflects
 * that click.
 */
export default function ShareButton({
  propertyId,
  propertyName,
  message,
  className = "",
}: ShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // A different property means a stale link must not linger.
  useEffect(() => {
    setStatus("idle");
    setShareUrl("");
    setCopied(false);
  }, [propertyId]);

  const create = async () => {
    setStatus("loading");
    try {
      const result = await createPropertyShare({
        entityId: propertyId,
        message,
      });
      const token = result.tracking_token ?? "";
      setShareUrl(token ? buildShareUrl(token, window.location.origin) : "");
      setStatus("ready");
    } catch (error) {
      console.warn("[share] create failed", error);
      setStatus("error");
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
      // Clipboard is blocked in some embedded/permission contexts. The link
      // stays visible and selectable in the field, so it is still reachable.
      setCopied(false);
    }
  };

  if (status === "ready" && shareUrl) {
    return (
      <div className={`pd-share ${className}`}>
        <span className="pd-share__label">Tracked link</span>
        {/* The URL is the link. Viewing and sharing the same string keeps one
            element to read, select and open, rather than the address plus a
            button that repeats it. */}
        <a
          className="pd-share__link"
          href={shareUrl}
          target="_blank"
          rel="noreferrer"
          title={shareUrl}
        >
          {shareUrl}
        </a>
        <div className="pd-share__actions">
          <button
            type="button"
            className="pd-btn pd-btn--ghost pd-btn--sm"
            onClick={copy}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <a
            className="pd-btn pd-btn--primary pd-btn--sm"
            href={whatsappUrl(`${message}\n${shareUrl}`)}
            target="_blank"
            rel="noreferrer"
          >
            Share on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`pd-share pd-share--bare ${className}`}>
      <button
        type="button"
        className="pd-btn pd-btn--ghost pd-share-trigger"
        onClick={create}
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        aria-label={
          status === "loading"
            ? "Creating share link"
            : status === "error"
              ? "Retry share"
              : `Share ${propertyName}`
        }
        title={`Share ${propertyName}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.3 3.3 0 0 0 0-1.4l7.05-4.11A3 3 0 1 0 15 5.5c0 .24.03.47.08.69L8.03 10.3a3 3 0 1 0 0 3.4l7.12 4.16c-.04.2-.06.4-.06.62A2.92 2.92 0 1 0 18 16.08Z" />
        </svg>
        <span>Share</span>
      </button>
      {status === "error" ? (
        <p className="pd-share__error" role="alert">
          We could not create a share link. Please try again.
        </p>
      ) : null}
    </div>
  );
}