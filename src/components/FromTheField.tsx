"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useState } from "react";
import defaultProfile from "@/app/assets/about-panel/hero-property.jpg";
import plotKokapet from "@/app/assets/plots-pulse/kokapet.jpg";
import plotMansanpally from "@/app/assets/plots-pulse/mansanpally.jpg";
import plotNallagandla from "@/app/assets/plots-pulse/nallagandla.jpg";
import plotHero from "@/app/assets/Hero-image.png";
import {
  fetchActiveTenantReels,
  type TenantReel,
} from "@/services/tenantReelsService";
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
      <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,0.25)" />
      <path d="M10 8.5v7l6-3.5-6-3.5z" fill="#fff" />
    </svg>
  );
}

function VerifiedBadge() {
  return (
    <svg
      className="from-field__verified-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <title>Verified</title>
      <path
        fill="var(--ff-gold)"
        d="M10.29 2.308a2.5 2.5 0 0 1 3.42 0l.66.613a2.5 2.5 0 0 0 2.214.652l.882-.17a2.5 2.5 0 0 1 2.87 1.884l.22.872a2.5 2.5 0 0 0 1.566 1.74l.842.316a2.5 2.5 0 0 1 1.488 3.106l-.265.86a2.5 2.5 0 0 0 .52 2.248l.583.69a2.5 2.5 0 0 1 0 3.442l-.583.69a2.5 2.5 0 0 0-.52 2.248l.265.86a2.5 2.5 0 0 1-1.488 3.106l-.842.316a2.5 2.5 0 0 0-1.566 1.74l-.22.872a2.5 2.5 0 0 1-2.87 1.884l-.882.17a2.5 2.5 0 0 0-2.214-.652l-.66-.613z"
      />
      <path fill="#0f1114" d="M9.5 12.5l-2-2-1.4 1.4 3.4 3.4 7-7-1.4-1.4z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      className="from-field__ig-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function ReelGlyphIcon() {
  return (
    <svg
      className="from-field__reel-glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="4" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
    </svg>
  );
}

const REEL_FALLBACK_IMAGES: StaticImageData[] = [
  plotMansanpally,
  plotKokapet,
  plotNallagandla,
  plotHero,
];

function ReelPlaceholderCard({
  index = 0,
  title,
  location,
}: {
  index?: number;
  title?: string;
  location?: string;
}) {
  const image = REEL_FALLBACK_IMAGES[index % REEL_FALLBACK_IMAGES.length];

  return (
    <div className="from-field__placeholder-canvas" aria-hidden="true">
      <Image
        className="from-field__thumb"
        src={image}
        alt=""
        fill
        sizes="(max-width: 980px) 72vw, 20vw"
        draggable={false}
      />
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="from-field__link-icon"
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
  );
}

type FromTheFieldProps = {
  handle?: string;
  profileUrl?: string;
  profileImage?: StaticImageData;
  followers?: string;
  reelCount?: string;
  initialReels?: TenantReel[];
};

export default function FromTheField({
  handle = "@ila.homes",
  profileUrl = INSTAGRAM_URL,
  profileImage = defaultProfile,
  followers = "26K+",
  reelCount = "50+",
  initialReels = [],
}: FromTheFieldProps) {
  const [reels, setReels] = useState<TenantReel[]>(initialReels);
  const [reelLoading, setReelLoading] = useState(initialReels.length === 0);
  const [reelError, setReelError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchActiveTenantReels(controller.signal)
      .then((apiReels) => {
        setReels(apiReels);
      })
      .catch((requestError: unknown) => {
        if (
          !(
            requestError instanceof DOMException &&
            requestError.name === "AbortError"
          )
        ) {
          setReelError(true);
        }
      })
      .finally(() => setReelLoading(false));

    return () => controller.abort();
  }, []);

  const hasReels = reels.length > 0;
  const isMultiReel = reels.length > 1;

  return (
    <section
      data-section="live_activity"
      className="from-field"
      aria-labelledby="from-field-heading"
    >
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

        {/* Desktop View: Grid + Profile Sidebar */}
        <div className="from-field__desktop">
          <div className="from-field__grid">
            <div className="from-field__reels" role="list" aria-live="polite">
              {reelLoading ? (
                <p
                  className="from-field__state inline-flex items-center gap-2"
                  role="status"
                >
                  <span className="ila-loader ila-loader--sm" aria-hidden />
                  Loading the latest reel…
                </p>
              ) : null}

              {!reelLoading && reelError ? (
                <p className="from-field__state" role="alert">
                  The latest reel is unavailable right now.
                </p>
              ) : null}

              {!reelLoading && !reelError && !hasReels ? (
                <p className="from-field__state">
                  No active walkthrough reels configured at this time.
                </p>
              ) : null}

              {!reelLoading && !reelError &&
                reels.map((reel, index) => {
                  const title = reel.title || "Latest ILA Homes reel";
                  return (
                    <a
                      key={reel.id}
                      className="from-field__card"
                      href={reel.reel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      role="listitem"
                      aria-label={`Watch ${title} on Instagram`}
                    >
                      {reel.thumbnail_url ? (
                        <Image
                          className="from-field__thumb"
                          src={reel.thumbnail_url}
                          alt=""
                          fill
                          sizes="(max-width: 1100px) 14vw, 18vw"
                          draggable={false}
                          unoptimized={reel.thumbnail_url.startsWith("http")}
                        />
                      ) : (
                        <ReelPlaceholderCard index={index} title={title} location={reel.location} />
                      )}
                      {reel.duration ? (
                        <span className="from-field__duration">
                          {reel.duration}
                        </span>
                      ) : null}
                      <span className="from-field__play" aria-hidden="true">
                        <PlayIcon />
                      </span>
                      <span className="from-field__tag">{title}</span>
                    </a>
                  );
                })}
            </div>

            <aside
              className="from-field__profile"
              aria-label="Instagram profile"
            >
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

        {/* Mobile View: Renders strictly based on API response */}
        <div className="from-field__mobile">
          {/* Instagram Account Profile Bar */}
          <div className="from-field__mobile-profile-bar">
            <div className="from-field__post-author">
              <div className="from-field__post-avatar-ring">
                <Image
                  className="from-field__post-avatar"
                  src={profileImage}
                  alt=""
                  width={42}
                  height={42}
                />
              </div>
              <div className="from-field__post-meta">
                <div className="from-field__post-handle-row">
                  <span className="from-field__post-handle">{handle}</span>
                  <VerifiedBadge />
                </div>
                <span className="from-field__post-sub">
                  {followers} Followers · {reelCount} Reels
                </span>
              </div>
            </div>

            <div className="from-field__post-header-actions">
              <a
                className="from-field__post-follow-pill"
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Follow ${handle} on Instagram`}
              >
                Follow
              </a>
              <a
                className="from-field__post-ig-link"
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open ILA Homes Instagram"
              >
                <InstagramIcon />
              </a>
            </div>
          </div>

          {/* Loading state */}
          {reelLoading ? (
            <div
              className="from-field__mobile-reel-card from-field__mobile-reel-card--state"
              role="status"
            >
              <span className="ila-loader ila-loader--sm" aria-hidden />
              <span className="from-field__state">Loading walkthrough reels…</span>
            </div>
          ) : null}

          {/* Error state */}
          {!reelLoading && reelError ? (
            <div
              className="from-field__mobile-reel-card from-field__mobile-reel-card--state"
              role="alert"
            >
              <p className="from-field__state">
                Walkthrough reels are temporarily unavailable.
              </p>
            </div>
          ) : null}

          {/* API-driven Multi-Reel Carousel (when API returns > 1 reel) */}
          {!reelLoading && !reelError && isMultiReel ? (
            <div
              className="from-field__mobile-carousel"
              role="list"
              aria-label="Ground walkthrough reels"
            >
              {reels.map((reel, index) => {
                const title = reel.title || "Walkthrough reel";
                return (
                  <a
                    key={reel.id}
                    className="from-field__mobile-reel-card"
                    href={reel.reel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="listitem"
                    aria-label={`Watch ${title} on Instagram`}
                  >
                    {reel.thumbnail_url ? (
                      <Image
                        className="from-field__mobile-reel-thumb"
                        src={reel.thumbnail_url}
                        alt=""
                        fill
                        sizes="72vw"
                        draggable={false}
                        unoptimized={reel.thumbnail_url.startsWith("http")}
                      />
                    ) : (
                      <ReelPlaceholderCard index={index} title={title} location={reel.location} />
                    )}
                    <div className="from-field__mobile-reel-overlay">
                      <div className="from-field__mobile-reel-top">
                        <span className="from-field__post-reel-badge">
                          <ReelGlyphIcon />
                          <span>{reel.location || "Reels"}</span>
                        </span>
                        {reel.duration ? (
                          <span className="from-field__mobile-duration">
                            {reel.duration}
                          </span>
                        ) : null}
                      </div>

                      <div className="from-field__mobile-play-center">
                        <span className="from-field__post-play-glass">
                          <PlayIcon />
                        </span>
                        <span className="from-field__post-play-label">
                          Watch Reel
                        </span>
                      </div>

                      <div className="from-field__mobile-reel-bottom">
                        <p className="from-field__mobile-reel-title">{title}</p>
                        <span className="from-field__mobile-reel-ig">
                          Watch on Instagram →
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : null}

          {/* API-driven Single Featured Reel (when API returns exactly 1 reel) */}
          {!reelLoading && !reelError && reels.length === 1 ? (
            <a
              className="from-field__mobile-single-card"
              href={reels[0].reel_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Watch the latest ILA Homes walkthrough reel on Instagram"
            >
              {reels[0].thumbnail_url ? (
                <Image
                  className="from-field__mobile-reel-thumb"
                  src={reels[0].thumbnail_url}
                  alt=""
                  fill
                  sizes="(max-width: 980px) 92vw, 420px"
                  draggable={false}
                  unoptimized={reels[0].thumbnail_url.startsWith("http")}
                />
              ) : (
                <ReelPlaceholderCard
                  title={reels[0].title || "Latest ILA Homes reel"}
                  location={reels[0].location}
                />
              )}
              <div className="from-field__mobile-reel-overlay">
                <div className="from-field__mobile-reel-top">
                  <span className="from-field__post-reel-badge">
                    <ReelGlyphIcon />
                    <span>{reels[0].location || "Latest Reel"}</span>
                  </span>
                  {reels[0].duration ? (
                    <span className="from-field__mobile-duration">
                      {reels[0].duration}
                    </span>
                  ) : null}
                </div>

                <div className="from-field__mobile-play-center">
                  <span className="from-field__post-play-glass">
                    <PlayIcon />
                  </span>
                  <span className="from-field__post-play-label">
                    Watch Walkthrough
                  </span>
                </div>

                <div className="from-field__mobile-reel-bottom">
                  <p className="from-field__mobile-reel-title">
                    {reels[0].title || "Latest ILA Homes reel"}
                  </p>
                  <span className="from-field__mobile-reel-ig">
                    Watch on Instagram →
                  </span>
                </div>
              </div>
            </a>
          ) : null}

          {/* Mobile Footer CTA */}
          <div className="from-field__mobile-footer">
            {isMultiReel ? (
              <div className="from-field__mobile-swipe-hint">
                <span className="from-field__mobile-swipe-dot" aria-hidden="true" />
                <span>Swipe horizontally to watch more walkthroughs</span>
              </div>
            ) : null}

            <a
              className="from-field__post-primary-cta"
              href={reels[0]?.reel_url || profileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                {hasReels ? "Watch Reels on Instagram" : "Follow on Instagram"}
              </span>
              <ExternalLinkIcon />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
