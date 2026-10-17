"use client";

import React from "react";
import "./IlaIntroLoader.css";

type IlaIntroLoaderProps = {
  className?: string;
};

export default function IlaIntroLoader({ className = "" }: IlaIntroLoaderProps) {
  return (
    <div
      className={`ila-intro-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#090a0c] text-white transition-opacity duration-700 ${className}`}
      aria-label="Loading ILA Homes..."
      role="status"
    >
      <div className="ila-intro-stage relative flex w-[92%] max-w-[680px] flex-col items-center gap-10">
        <div className="ila-intro-ambient" aria-hidden />

        <svg
          className="ila-intro-canvas w-full h-auto overflow-visible"
          viewBox="20 0 546 190"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Metallic Gold Gradient */}
            <linearGradient id="intro-gold-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c59b61" />
              <stop offset="50%" stopColor="#f3e5ab" />
              <stop offset="100%" stopColor="#d4af7a" />
            </linearGradient>

            {/* Shimmer Gradient for Light Sweep */}
            <linearGradient id="intro-sheen-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="50%" stopColor="rgba(255,248,231,0.85)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>

            {/* Horizontal Clip Mask for floor rise */}
            <clipPath id="intro-text-floor-mask">
              <rect x="30" y="80" width="500" height="75" />
            </clipPath>

            {/* Clip Mask for Final Shimmer Overlay */}
            <clipPath id="intro-full-logo-mask">
              <rect x="46" y="94" width="10" height="44" rx="0.5" />
              <path d="M 62 94 H 72 V 136 H 104 V 146 H 68 Q 62 146 62 140 Z" />
              <path d="M 118 94 H 132 L 158 138 H 145 L 139 128 H 111 L 105 138 H 92 Z M 116 119 H 134 L 125 103 Z" />
              <path d="M 184 94 H 195 V 111 H 222 V 94 H 233 V 138 H 222 V 121 H 195 V 138 H 184 Z" />
              <path d="M 254 94 H 284 Q 296 94 296 106 V 126 Q 296 138 284 138 H 254 Q 242 138 242 126 V 106 Q 242 94 254 94 Z" />
              <path d="M 306 94 H 320 L 336 118 L 352 94 H 366 V 138 H 355 V 109 L 336 136 L 317 109 V 138 H 306 Z" />
              <path d="M 378 94 H 426 V 103 H 389 V 111 H 422 V 120 H 389 V 129 H 426 V 138 H 378 Z" />
              <path d="M 446 94 H 484 Q 492 94 492 102 V 105 H 481 V 103 H 447 V 111 H 483 Q 492 111 492 120 V 129 Q 492 138 483 138 H 444 Q 435 138 435 129 V 125 H 446 V 129 H 481 V 120 H 445 Q 436 120 436 111 V 102 Q 436 94 446 94 Z" />
            </clipPath>
          </defs>

          <g className="ila-intro-logo-master">
            {/* STEP 01: Golden Laser Accent along baseline */}
            <path className="intro-baseline-laser" d="M 44 148 H 145" fill="none" />

            {/* STEP 02: ROOF RISE (Glides & Draws) */}
            <g className="intro-roof-wrap">
              <path className="intro-roof-line outer" d="M 352 84 L 386 50 L 420 84 L 518 84" />
              <path className="intro-roof-line inner" d="M 365 84 L 386 63 L 407 84 L 518 84" />
            </g>

            {/* STEP 03: PILLAR SLIDE & LOCK */}
            <g className="intro-pillar-wrap">
              <path className="intro-pillar-shape" d="M 526 69 L 542 83 L 542 141 L 526 141 Z" />
              <line className="intro-pillar-shape" x1="526" y1="132" x2="542" y2="132" />
            </g>

            {/* STEP 01: ARCHITECTURAL TYPOGRAPHY */}
            <g clipPath="url(#intro-text-floor-mask)">
              {/* I */}
              <rect className="intro-char intro-char-ila intro-c-1" x="46" y="94" width="10" height="44" rx="0.5" />
              {/* L */}
              <path className="intro-char intro-char-ila intro-c-2" d="M 62 94 H 72 V 136 H 104 V 146 H 68 Q 62 146 62 140 Z" />
              {/* A */}
              <path className="intro-char intro-char-ila intro-c-3" d="M 118 94 H 132 L 158 138 H 145 L 139 128 H 111 L 105 138 H 92 Z M 116 119 H 134 L 125 103 Z" />
              {/* H */}
              <path className="intro-char intro-c-4" d="M 184 94 H 195 V 111 H 222 V 94 H 233 V 138 H 222 V 121 H 195 V 138 H 184 Z" />
              {/* O */}
              <path className="intro-char intro-c-5" d="M 254 94 H 284 Q 296 94 296 106 V 126 Q 296 138 284 138 H 254 Q 242 138 242 126 V 106 Q 242 94 254 94 Z M 253 106 V 126 Q 253 128 256 128 H 282 Q 285 128 285 126 V 106 Q 285 104 282 104 H 256 Q 253 104 253 106 Z" />
              {/* M */}
              <path className="intro-char intro-c-6" d="M 306 94 H 320 L 336 118 L 352 94 H 366 V 138 H 355 V 109 L 336 136 L 317 109 V 138 H 306 Z" />
              {/* E */}
              <path className="intro-char intro-c-7" d="M 378 94 H 426 V 103 H 389 V 111 H 422 V 120 H 389 V 129 H 426 V 138 H 378 Z" />
              {/* S */}
              <path className="intro-char intro-c-8" d="M 446 94 H 484 Q 492 94 492 102 V 105 H 481 V 103 H 447 V 111 H 483 Q 492 111 492 120 V 129 Q 492 138 483 138 H 444 Q 435 138 435 129 V 125 H 446 V 129 H 481 V 120 H 445 Q 436 120 436 111 V 102 Q 436 94 446 94 Z" />
            </g>

            {/* STEP 04: LIGHT SHEEN ACROSS SOLID LETTERS */}
            <g clipPath="url(#intro-full-logo-mask)">
              <rect className="intro-light-sheen" x="0" y="40" width="90" height="120" fill="url(#intro-sheen-grad)" />
            </g>
          </g>
        </svg>

        {/* Minimalist Progress Track */}
        <div className="ila-intro-progress-track">
          <div className="ila-intro-progress-fill" />
        </div>
      </div>
    </div>
  );
}
