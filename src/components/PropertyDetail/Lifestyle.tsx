"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PropertyRecord } from "@/data/properties";
import { getPropertyLifestyle } from "@/data/properties";

/**
 * Six tiles fill two columns on a phone three rows deep, so the first screen
 * is already a complete grid. An API property publishes every amenity it has,
 * and fourteen of them unrolled is a lot of scrolling for information nobody
 * is looking for yet — the rest stays behind one tap.
 */
const VISIBLE_TILE_COUNT = 6;

/**
 * The backend sends no icon — `ApiProperty.amenities` is a plain `string[]` —
 * so the tile icon is matched on the amenity name here. Every path is drawn on
 * the same 24×24 grid with the same 1.5 stroke so the set reads as one family,
 * and `fallback` catches anything the lookup does not recognise.
 */
const AMENITY_ICON_PATHS = {
  gate: [
    "M4 20V10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10",
    "M6 20v-6",
    "M10 20v-6",
    "M14 20v-6",
    "M18 20v-6",
    "M4 14h16",
  ],
  security: [
    "M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z",
  ],
  park: ["M12 3 6.5 10h11z", "M12 8.5 5 17h14z", "M12 17v4"],
  garden: [
    "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z",
    "M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12",
  ],
  club: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  pool: [
    "M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
    "M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
    "M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
  ],
  road: ["M7 21 10 3", "M17 21 14 3", "M12 4v3", "M12 10v3", "M12 16v3"],
  water: [
    "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z",
  ],
  power: ["M13 2 3 14h9l-1 8 10-12h-9z"],
  streetLight: ["M8 4h8l1.6 5H6.4L8 4z", "M12 9v11", "M9 20h6"],
  drainage: ["M3 6h18v12H3z", "M8 6v12", "M12 6v12", "M16 6v12"],
  playArea: [
    "M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20",
    "M8.5 14.5a4.5 4.5 0 0 0 7 0",
    "M9 9.5h.01",
    "M15 9.5h.01",
  ],
  jogging: ["m17 2 4 4-4 4", "M3 11v-1a4 4 0 0 1 4-4h14", "m7 22-4-4 4-4", "M21 13v1a4 4 0 0 1-4 4H3"],
  fallback: ["M20 6 9 17l-5-5"],
} as const;

type AmenityIconName = keyof typeof AMENITY_ICON_PATHS;

/**
 * First match wins, so the two-word amenities sit above the single words they
 * contain — "Street Light" has to reach `streetLight` before "Street" reaches
 * `road`.
 */
const AMENITY_ICON_KEYWORDS: ReadonlyArray<readonly [RegExp, AmenityIconName]> = [
  [/street\s*light|streetlight|street\s*lamp|lamp\s*post/i, "streetLight"],
  [/drain|sewage|runoff/i, "drainage"],
  [/jogging|running\s*track|walking\s*track|promenade/i, "jogging"],
  [/play\s*(area|ground|zone)|child|kids/i, "playArea"],
  [/secur|cctv|guard|surveillance/i, "security"],
  [/club/i, "club"],
  [/pool|swim/i, "pool"],
  [/park|lawn/i, "park"],
  [/garden|landscap/i, "garden"],
  [/road|street|boulevard|avenue/i, "road"],
  [/water|borewell|lake|pond/i, "water"],
  [/power|electric|generator|solar/i, "power"],
  [/gate|entrance|entry/i, "gate"],
];

function formatAmenityCaption(caption: string): string {
  if (!caption) return "";
  return caption
    .trim()
    .replace(/_+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.toLowerCase() === "24/7" || word === "24" || word === "7") return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function iconFor(caption: string): AmenityIconName {
  const clean = caption.replace(/_+/g, " ");
  const hit = AMENITY_ICON_KEYWORDS.find(([pattern]) => pattern.test(clean));
  return hit ? hit[1] : "fallback";
}

/**
 * Columns follow the tile count so every row fills instead of trailing off.
 * Six amenity points sit on three columns (3+3), eight on four (4+4), four on
 * one row of four. The desktop grid used to be a flat four columns whatever
 * the count, which left a six-tile grid two slots short in its second row and
 * read as an unfinished right edge rather than a grid.
 *
 * Every tile stays one fixed width in every row: the last row is never allowed
 * to stretch to fill, because a stretched row makes the tiles read as two
 * different objects.
 *
 * The stylesheet caps this per breakpoint, because four columns of ~100px
 * tiles is not a grid a phone can hold.
 */
const TILE_COLUMN_CHOICES = [4, 3, 2] as const;

function columnCountForTileCount(tileCount: number): number {
  if (tileCount <= 2) return Math.max(tileCount, 1);

  // A choice that divides the tile count leaves no row short.
  for (const columns of TILE_COLUMN_CHOICES) {
    if (tileCount % columns === 0) return columns;
  }

  // Nothing divides it evenly (7, 11, 13 …), so the last row takes the
  // remainder. Keep that row as full as possible and, all else equal, the grid
  // as short as possible — seven amenities land on four columns, so 4+3.
  return TILE_COLUMN_CHOICES.reduce((best, columns) => {
    const bestGap = best - (tileCount % best);
    const gap = columns - (tileCount % columns);
    if (gap !== bestGap) return gap < bestGap ? columns : best;
    return Math.ceil(tileCount / columns) < Math.ceil(tileCount / best)
      ? columns
      : best;
  });
}

export default function Lifestyle({ property }: { property: PropertyRecord }) {
  const items = getPropertyLifestyle(property);

  // Navigating to another property remounts this via its `key`, so the
  // collapsed grid resets without an effect.

  const [showAll, setShowAll] = useState(false);

  const collapsible = items.length > VISIBLE_TILE_COUNT;
  const visibleItems = showAll ? items : items.slice(0, VISIBLE_TILE_COUNT);
  const hiddenCount = items.length - visibleItems.length;

  const headingRef = useRef<HTMLHeadingElement>(null);
  const tilesRef = useRef<HTMLUListElement>(null);
  const collapsing = useRef(false);
  /* The grid's height immediately before a toggle, kept until the effect below
     has run with the new tile count in the DOM. Once React has re-rendered,
     the old height is gone from the layout, so the click handler is the only
     place it can still be read. */
  const heightBeforeToggle = useRef<number | null>(null);
  const resizeAnimation = useRef<Animation | null>(null);

  function toggleTiles() {
    // Expanding only adds rows below the button the reader is already looking
    // at, so the page is left where it is. Collapsing is the direction that
    // strands someone: rows vanish from under them and the shorter document
    // clamps the scroll out from under their feet. That one scrolls back.
    collapsing.current = showAll;
    heightBeforeToggle.current =
      tilesRef.current?.getBoundingClientRect().height ?? null;
    setShowAll((value) => !value);
  }

  useEffect(() => {
    const from = heightBeforeToggle.current;
    heightBeforeToggle.current = null;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const tiles = tilesRef.current;
    if (tiles && from !== null && !reduceMotion) {
      const to = tiles.getBoundingClientRect().height;
      if (Math.abs(to - from) > 1) {
        // Web Animations rather than a CSS transition: the target is whatever
        // height the new tile count needs, and there is no `auto` value to
        // transition to. Nothing is written to the element, so there is no
        // inline style left to clean up and no transitionend to chase.
        resizeAnimation.current?.cancel();
        resizeAnimation.current = tiles.animate(
          [
            { height: `${from}px` },
            { height: `${to}px` },
          ],
          { duration: 200, easing: "ease-out" },
        );
      }
    }

    if (!collapsing.current) return;
    collapsing.current = false;
    const heading = headingRef.current;
    if (!heading) return;
    heading.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [showAll]);

  // A property with no amenities gets no section at all. Rendering the heading
  // over an empty grid would announce a section with nothing in it. Checked
  // after the hooks so their order stays unconditional.
  if (items.length === 0) return null;

  const tileColumns = columnCountForTileCount(visibleItems.length);

  return (
    <section className="pd-section pd-lifestyle" aria-labelledby="pd-life-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Lifestyle</p>
        <h2 id="pd-life-title" ref={headingRef}>How days could feel here</h2>
        <p className="pd-section__lead">
          Every amenity on this plot, in one place.
        </p>

        {/* No tabs, no stage: every name is already on screen, so there is
            nothing for a tap to reveal. The tiles stay inert — a tile that
            looks tappable but does nothing is worse than a quiet tile. */}
        <ul
          id="pd-lifestyle-tiles"
          ref={tilesRef}
          className="pd-lifestyle__grid"
          role="list"
          style={{ "--pd-lifestyle-columns": tileColumns } as CSSProperties}
        >
          {visibleItems.map((item) => {
            const formattedCaption = formatAmenityCaption(item.caption);
            return (
              <li key={item.id} className="pd-lifestyle__tile">
                <span className="pd-lifestyle__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    {AMENITY_ICON_PATHS[iconFor(formattedCaption)].map((d) => (
                      <path key={d} d={d} />
                    ))}
                  </svg>
                </span>
                <span className="pd-lifestyle__tile-body">
                  <span
                    className="pd-lifestyle__tile-title"
                    title={formattedCaption}
                  >
                    {formattedCaption}
                  </span>
                  {/* Amenities usually arrive with no second line. Rendering it
                      conditionally leaves no gap and no placeholder behind. */}
                  {item.alt ? (
                    <span className="pd-lifestyle__tile-alt">{item.alt}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        {collapsible ? (
          <button
            type="button"
            className="pd-lifestyle__show-all"
            aria-expanded={showAll}
            aria-controls="pd-lifestyle-tiles"
            onClick={toggleTiles}
          >
            {showAll ? "Show less" : `Show ${hiddenCount} more`}
            <svg
              className={`pd-lifestyle__chevron${
                showAll ? " pd-lifestyle__chevron--up" : ""
              }`}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        ) : null}
      </div>
    </section>
  );
}
