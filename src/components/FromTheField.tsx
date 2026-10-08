import Image, { type StaticImageData } from "next/image";
import mansanpallyThumb from "@/app/assets/plots-pulse/mansanpally.jpg";
import kokapetThumb from "@/app/assets/plots-pulse/kokapet.jpg";
import nallagandlaThumb from "@/app/assets/plots-pulse/nallagandla.jpg";
import defaultProfile from "@/app/assets/about-panel/hero-property.jpg";
import "./FromTheField.css";

const INSTAGRAM_URL =
  "https://www.instagram.com/ila.homes?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==";

type Reel = {
  thumbnail: StaticImageData;
  title: string;
  location: string;
  duration: string;
  reelUrl: string;
};

const DEFAULT_REELS: Reel[] = [
  {
    thumbnail: mansanpallyThumb,
    title: "Plot A3",
    location: "Mansanpally",
    duration: "0:42",
    reelUrl: INSTAGRAM_URL,
  },
  {
    thumbnail: kokapetThumb,
    title: "Corner plot walk",
    location: "Kokapet Heights",
    duration: "0:58",
    reelUrl: INSTAGRAM_URL,
  },
  {
    thumbnail: nallagandlaThumb,
    title: "Road-facing lot",
    location: "Nallagandla",
    duration: "0:36",
    reelUrl: INSTAGRAM_URL,
  },
];

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
  reels?: Reel[];
  handle?: string;
  profileUrl?: string;
  profileImage?: StaticImageData;
  followers?: string;
  reelCount?: string;
};

export default function FromTheField({
  reels = DEFAULT_REELS,
  handle = "@ila.homes",
  profileUrl = INSTAGRAM_URL,
  profileImage = defaultProfile,
  followers = "26K+",
  reelCount = "50+",
}: FromTheFieldProps) {
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
          <div className="from-field__reels" role="list">
            {reels.map((reel) => {
              const label = `${reel.location} · ${reel.title}`;
              return (
                <a
                  key={`${reel.location}-${reel.title}`}
                  className="from-field__card"
                  href={reel.reelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="listitem"
                  aria-label={`Watch reel: ${label}`}
                >
                  <Image
                    className="from-field__thumb"
                    src={reel.thumbnail}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 66vw, (max-width: 980px) 58vw, (max-width: 1100px) 14vw, 18vw"
                    draggable={false}
                  />
                  <span className="from-field__duration">{reel.duration}</span>
                  <span className="from-field__play" aria-hidden="true">
                    <PlayIcon />
                  </span>
                  <span className="from-field__tag">{label}</span>
                </a>
              );
            })}
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
