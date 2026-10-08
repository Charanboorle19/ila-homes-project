"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useState } from "react";
import reelFallbackThumb from "@/app/assets/plots-pulse/mansanpally.jpg";
import defaultProfile from "@/app/assets/about-panel/hero-property.jpg";
import { fetchActiveTenantReel } from "@/services/tenantReelsService";
import "./FromTheField.css";

const INSTAGRAM_URL =
  "https://www.instagram.com/ila.homes?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==";

function PlayIcon() {
  return (
    <svg
      className="from-field__play-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,0.22)" />
      <path d="M10 8.5v7l6-3.5-6-3.5z" fill="#fff" />
    </svg>
  );
}

type FromTheFieldProps = {
  handle?: string;
  profileUrl?: string;
  profileImage?: StaticImageData;
  followers?: string;
  reelCount?: string;
};

export default function FromTheField({
  handle = "@ila.homes",
  profileUrl = INSTAGRAM_URL,
  profileImage = defaultProfile,
  followers = "26K+",
  reelCount = "50+",
}: FromTheFieldProps) {
  const [activeReelUrl, setActiveReelUrl] = useState<string | null>(null);
  const [reelLoading, setReelLoading] = useState(true);
  const [reelError, setReelError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchActiveTenantReel(controller.signal)
      .then((reel) => setActiveReelUrl(reel?.reel_url ?? null))
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setReelError(true);
        }
      })
      .finally(() => setReelLoading(false));

    return () => controller.abort();
  }, []);

  return (
    <section data-section="live_activity" className="from-field" aria-labelledby="from-field-heading">
      <div className="from-field__frame">
        <header className="from-field__intro">
          <p className="from-field__eyebrow">From the field</p>
          <h2 id="from-field-heading" className="from-field__heading">
            Hear it straight from the ground
          </h2>
          <p className="from-field__lede">
            Short walkthroughs. Real plots. No filters.
          </p>
        </header>

        <div className="from-field__grid">
          <div className="from-field__reels" role="list" aria-live="polite">
            {reelLoading ? <p className="from-field__state" role="status">Loading the latest reel…</p> : null}
            {!reelLoading && reelError ? <p className="from-field__state" role="alert">The latest reel is unavailable right now.</p> : null}
            {!reelLoading && !reelError && activeReelUrl ? (
                <a
                  className="from-field__card"
                  href={activeReelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="listitem"
                  aria-label="Watch the latest ILA Homes reel"
                >
                  <Image
                    className="from-field__thumb"
                    src={reelFallbackThumb}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 66vw, (max-width: 980px) 58vw, (max-width: 1100px) 14vw, 18vw"
                    draggable={false}
                  />
                  <span className="from-field__play" aria-hidden="true">
                    <PlayIcon />
                  </span>
                  <span className="from-field__tag">Latest ILA Homes reel</span>
                </a>
            ) : null}
          </div>

          <aside className="from-field__profile" aria-label="Instagram profile">
            <div className="from-field__avatar-wrap">
              <div className="from-field__avatar-inner">
                <Image
                  className="from-field__avatar"
                  src={profileImage}
                  alt=""
                  fill
                  sizes="112px"
                />
              </div>
            </div>
            <p className="from-field__ig-handle">{handle}</p>
            <p className="from-field__ig-bio">
              Follow for weekly plot walkthroughs, location updates &amp;
              investment tips.
            </p>
            <a
              className="from-field__cta"
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Follow on Instagram
            </a>
            <p className="from-field__stats">
              {followers} Followers
              <span aria-hidden="true"> · </span>
              {reelCount} Reels
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
