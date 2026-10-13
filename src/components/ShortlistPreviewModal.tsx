"use client";

import React, { useEffect, useId, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import type { ShortlistPlot } from "./ShortlistShare";
import "./ShortlistPreviewModal.css";

interface ShortlistPreviewModalProps {
  open: boolean;
  onClose: () => void;
  selectedPlots: ShortlistPlot[];
  urls: string[];
  onConfirmShare: () => void;
  sharing: boolean;
}

export default function ShortlistPreviewModal({
  open,
  onClose,
  selectedPlots,
  urls,
  onConfirmShare,
  sharing,
}: ShortlistPreviewModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    setCopied(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const handleCopy = async () => {
    const sections = selectedPlots.map((plot, idx) => {
      const url = urls[idx]?.trim() || "";
      return [
        `*${plot.name}*`,
        `📍 ${plot.location} · ${plot.meta}`,
        url,
      ].filter(Boolean).join("\n");
    });

    const rawText = [
      "🏡 *My Shortlisted Properties via ILA Homes*",
      "",
      sections.join("\n\n"),
      "",
      "Open the links to review layouts, pricing & financing together.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard fails
    }
  };

  return createPortal(
    <div className="shortlist-preview-modal" role="presentation">
      <button
        type="button"
        className="shortlist-preview-modal__scrim"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div
        className="shortlist-preview-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="shortlist-preview-modal__header">
          <div className="shortlist-preview-modal__header-icon">
            <svg
              className="w-5 h-5 text-[#25D366]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 01-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24l-.18.18zm-3.52 4.26c-.19 0-.5.07-.76.35-.26.29-1 1-1 2.43 0 1.44 1.03 2.83 1.18 3.03.15.19 2.02 3.19 4.97 4.39.7.29 1.25.46 1.68.59.71.22 1.36.19 1.87.11.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.08-.13-.27-.2-.57-.35-.29-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.29-.77.96-.94 1.16-.17.19-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.29-.02-.45.13-.6.13-.13.29-.35.44-.52.15-.17.2-.29.3-.49.1-.19.05-.37-.02-.52-.08-.14-.66-1.62-.92-2.22-.25-.59-.51-.51-.7-.52z" />
            </svg>
          </div>
          <div>
            <span className="shortlist-preview-modal__eyebrow">
              WhatsApp Message Preview
            </span>
            <h3 id={titleId} className="shortlist-preview-modal__title">
              Ready to Share {selectedPlots.length}{" "}
              {selectedPlots.length === 1 ? "Plot" : "Plots"}
            </h3>
          </div>
          <button
            type="button"
            className="shortlist-preview-modal__close-btn"
            onClick={onClose}
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        {/* WhatsApp Chat Bubble Window */}
        <div className="shortlist-preview-modal__chat-window">
          {/* WhatsApp message bubble */}
          <div className="shortlist-preview-modal__bubble">
            {/* Message Header Greeting */}
            <div className="shortlist-preview-modal__bubble-lead">
              <span className="shortlist-preview-modal__bubble-tag">
                ILA Homes Shortlist
              </span>
              <p className="shortlist-preview-modal__bubble-heading">
                Here are the properties I shortlisted to review together:
              </p>
            </div>

            {/* List of distinct property cards */}
            <div className="shortlist-preview-modal__cards-list">
              {selectedPlots.map((plot, index) => (
                <div
                  key={plot.id}
                  className="shortlist-preview-modal__card"
                >
                  <div className="shortlist-preview-modal__card-media">
                    {plot.coverUrl ? (
                      <Image
                        src={plot.coverUrl}
                        alt=""
                        fill
                        className="shortlist-preview-modal__card-img"
                        unoptimized
                      />
                    ) : (
                      <Image
                        src={plot.image}
                        alt=""
                        fill
                        className="shortlist-preview-modal__card-img"
                      />
                    )}
                    <span className="shortlist-preview-modal__card-num">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="shortlist-preview-modal__card-content">
                    <div className="shortlist-preview-modal__card-top">
                      <h4 className="shortlist-preview-modal__card-name">
                        {plot.name}
                      </h4>
                      <span className="shortlist-preview-modal__card-loc">
                        <svg
                          className="w-3 h-3 text-[#c6a46c] inline-block mr-0.5 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {plot.location}
                      </span>
                    </div>

                    <p className="shortlist-preview-modal__card-meta">
                      {plot.meta}
                    </p>

                    <div className="shortlist-preview-modal__card-link-box">
                      <span className="shortlist-preview-modal__card-link-text">
                        {urls[index] || "https://ilahomes.in/p/..."}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bubble Footer Sign-off */}
            <div className="shortlist-preview-modal__bubble-footer">
              <span className="text-[11px] text-neutral-600">
                Click any link above to inspect detailed layouts & financing.
              </span>
              <span className="shortlist-preview-modal__bubble-time">
                Just now · ✓✓
              </span>
            </div>
          </div>
        </div>

        {/* Modal Action Controls */}
        <div className="shortlist-preview-modal__actions">
          <button
            type="button"
            className="shortlist-preview-modal__copy-btn"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied Message
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Text
              </>
            )}
          </button>

          <button
            type="button"
            className="shortlist-preview-modal__share-btn"
            onClick={onConfirmShare}
            disabled={sharing}
          >
            <svg
              className="w-4 h-4 fill-current shrink-0"
              viewBox="0 0 24 24"
            >
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 01-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24l-.18.18zm-3.52 4.26c-.19 0-.5.07-.76.35-.26.29-1 1-1 2.43 0 1.44 1.03 2.83 1.18 3.03.15.19 2.02 3.19 4.97 4.39.7.29 1.25.46 1.68.59.71.22 1.36.19 1.87.11.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.08-.13-.27-.2-.57-.35-.29-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.29-.77.96-.94 1.16-.17.19-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.29-.02-.45.13-.6.13-.13.29-.35.44-.52.15-.17.2-.29.3-.49.1-.19.05-.37-.02-.52-.08-.14-.66-1.62-.92-2.22-.25-.59-.51-.51-.7-.52z" />
            </svg>
            {sharing ? "Opening WhatsApp…" : "Continue to WhatsApp →"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
