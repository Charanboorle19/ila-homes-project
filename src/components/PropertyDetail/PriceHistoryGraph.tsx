"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { PropertyRecord } from "@/data/properties";
import { fetchPriceHistory, type PriceHistoryPoint } from "@/services/apiClient";
import "./PropertyDetail.css";

/**
 * Price history — the trend of this plot's rate per square yard.
 *
 * The section is three surfaces over one dataset: four summary cards, the line
 * graph, and a year-by-year table. The graph is the centrepiece; the table is
 * what a phone can read, because hover does not exist there, and what a screen
 * reader gets without any of the interaction.
 *
 * Every coordinate in the chart is a real pixel, measured from the container
 * with a ResizeObserver, rather than a scaled `viewBox`. A `viewBox` stretches
 * with `preserveAspectRatio="none"` — which distorts the line and the type — or
 * letterboxes with `meet`, which leaves the plot floating in dead space.
 */

/** Inner plot height in px. The SVG is exactly as tall as its own geometry. */
const PLOT_HEIGHT = 240;
const PAD_TOP = 14;
const PAD_RIGHT = 14;
const PAD_BOTTOM = 30;
const PAD_LEFT = 58;
const Y_TICK_COUNT = 4;

/**
 * Half of the widest tooltip layout, used to clamp it inside the plot. An
 * estimate is fine: it only decides where the tooltip is not allowed to go.
 */
const TOOLTIP_HALF_WIDTH = 88;

/** Year labels closer together than this collide, so intermediate ones drop. */
const MIN_YEAR_LABEL_GAP = 38;

/**
 * One plotted point plus its year-on-year movement.
 *
 * `change` is the absolute rupee difference and `growth` the percentage, both
 * taken from the API when it sends them and derived from the prices when it
 * does not — the endpoint documents both, with nulls on the first year.
 */
type TrendRow = {
  year: number;
  price: number;
  change: number | null;
  growth: number | null;
};

/**
 * Drops unusable points, sorts by year and fills in the year-on-year movement.
 *
 * The endpoint documents `yearly_change` (absolute rupees) and `yearly_growth`
 * (percentage) against the previous year, so those are used when present; the
 * prices themselves are the fallback, which keeps the section working for a
 * payload that only carries `year` and `price`.
 */
function buildRows(points: PriceHistoryPoint[]): TrendRow[] {
  const usable = points
    .filter(
      (point): point is PriceHistoryPoint =>
        Boolean(point) &&
        Number.isFinite(point.year) &&
        Number.isFinite(point.price),
    )
    .sort((a, b) => a.year - b.year);

  const rows: TrendRow[] = usable.map((point) => ({
    year: point.year,
    price: point.price,
    change: null,
    growth: null,
  }));

  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1].price;
    const delta = rows[index].price - previous;
    const source = usable[index];

    rows[index].change = Number.isFinite(source.yearly_change)
      ? source.yearly_change
      : delta;
    rows[index].growth = Number.isFinite(source.yearly_growth)
      ? source.yearly_growth
      : previous > 0
        ? (delta / previous) * 100
        : null;
  }

  return rows;
}

/** Indian-format rupees, full precision: ₹1,68,000. */
function formatRupees(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/**
 * Rupees shortened for the axis. Per-square-yard prices run into five figures,
 * and five of those along the left edge would take a third of the plot width.
 */
function formatAxisRupees(value: number): string {
  const abs = Math.abs(value);
  const short = (scaled: number) =>
    `₹${scaled.toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;

  if (abs >= 1e7) return `${short(value / 1e7)}Cr`;
  if (abs >= 1e5) return `${short(value / 1e5)}L`;
  if (abs >= 1e3) return `${short(value / 1e3)}k`;
  return short(value);
}

/** Signed percentage: +15.9%, -3.2%, or an em dash when there is nothing to say. */
function formatGrowth(growth: number | null): string {
  if (growth === null || !Number.isFinite(growth)) return "—";
  const rounded = Math.round(growth * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("en-IN", {
    maximumFractionDigits: 1,
  })}%`;
}

/** Signed rupees: +₹250, −₹150. */
function formatSignedRupees(change: number | null): string {
  if (change === null || !Number.isFinite(change)) return "—";
  const rounded = Math.round(change);
  if (rounded === 0) return "₹0";
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}₹${Math.abs(rounded).toLocaleString("en-IN")}`;
}

/**
 * Round tick values on a 1 / 2 / 2.5 / 5 / 10 step, so the axis reads as
 * deliberate numbers rather than whatever the data happened to span.
 */
function niceTicks(min: number, max: number, count: number): number[] {
  if (!(max > min)) return [min];

  const rough = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const stepFactor =
    normalised >= 5 ? 10 : normalised >= 2.5 ? 5 : normalised >= 2 ? 2.5 : 2;
  const step = stepFactor * magnitude;

  const ticks: number[] = [];
  const first = Math.ceil(min / step) * step;
  for (let tick = first; tick <= max + step / 1000; tick += step) {
    // Floating point steps accumulate dust (0.30000000000000004) on the axis.
    ticks.push(Math.round(tick * 1e6) / 1e6);
  }
  return ticks;
}

/** The line, or null when there is nothing to join. */
function linePath(points: Array<{ x: number; y: number }>): string | null {
  if (points.length < 2) return null;
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

export default function PriceHistoryGraph({
  property,
}: {
  property: PropertyRecord;
}) {
  const [data, setData] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchPriceHistory(property.id, controller.signal)
      .then((result) => {
        setData(Array.isArray(result) ? result : []);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        // An aborted request is this effect cleaning up after itself, not a
        // failure the reader needs to be told about.
        if (controller.signal.aborted) return;
        setError("Could not load price history");
        setLoading(false);
      });

    return () => controller.abort();
  }, [property.id]);

  const rows = useMemo(() => buildRows(data), [data]);

  if (loading) {
    return (
      <section className="pd-section pd-price" aria-labelledby="pd-price-history-title">
        <div className="pd-section__inner">
          <p className="pd-kicker">Price history</p>
          <h2 id="pd-price-history-title">Price trend over the years</h2>
          <p className="pd-section__lead">
            <span className="pd-price__loading">
              <span className="ila-loader ila-loader--sm" aria-hidden />
              Loading the price trend…
            </span>
          </p>

          {/* The skeleton keeps the shape of the loaded section, so nothing
              below it moves once the numbers arrive. */}
          <div className="pd-price__stats" aria-hidden>
            {[0, 1, 2, 3].map((slot) => (
              <div key={slot} className="pd-price__skeleton pd-price__skeleton--stat" />
            ))}
          </div>
          <div className="pd-price__skeleton pd-price__skeleton--chart" aria-hidden />
        </div>
      </section>
    );
  }

  if (error || rows.length === 0) {
    return (
      <section className="pd-section pd-price" aria-labelledby="pd-price-history-title">
        <div className="pd-section__inner">
          <p className="pd-kicker">Price history</p>
          <h2 id="pd-price-history-title">Price trend over the years</h2>
          <p className="pd-section__lead">
            {error ?? "No price history has been published for this property yet."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="pd-section pd-price" aria-labelledby="pd-price-history-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Price history</p>
        <h2 id="pd-price-history-title">Price trend over the years</h2>
        <p className="pd-section__lead">
          Price per square yard, year by year. Hover the line — or focus it and
          use the arrow keys — to read any single year.
        </p>

        <PriceTrendSummary rows={rows} />
        {/* Keyed so a different property remounts the graph: the pointer state
            and the draw-in animation both start again, rather than carrying
            over from the property that was here before. */}
        <PriceTrendChart key={property.id} rows={rows} />
        <PriceTrendTable rows={rows} />
      </div>
    </section>
  );
}

/** The four headline numbers above the graph. */
function PriceTrendSummary({ rows }: { rows: TrendRow[] }) {
  const first = rows[0];
  const latest = rows[rows.length - 1];
  const years = latest.year - first.year;

  const totalGrowth =
    first.price > 0 && rows.length > 1
      ? ((latest.price - first.price) / first.price) * 100
      : null;

  // Compound annual growth over the span in years, not over the number of
  // points: three points spanning two years is two years of growth.
  const cagr =
    first.price > 0 && years > 0
      ? (Math.pow(latest.price / first.price, 1 / years) - 1) * 100
      : null;

  const best = rows.reduce<TrendRow | null>((winner, row, index) => {
    if (index === 0 || row.growth === null) return winner;
    if (!winner || (winner.growth ?? -Infinity) < row.growth) return row;
    return winner;
  }, null);

  return (
    <div className="pd-price__stats">
      <div className="pd-price__stat">
        <span className="pd-price__stat-label">Latest price</span>
        <span className="pd-price__stat-value">{formatRupees(latest.price)}</span>
        <span className="pd-price__stat-note">
          per sq yard · {latest.year}
        </span>
      </div>
      <div className="pd-price__stat">
        <span className="pd-price__stat-label">Total growth</span>
        <span className="pd-price__stat-value">{formatGrowth(totalGrowth)}</span>
        <span className="pd-price__stat-note">
          {rows.length > 1 ? `since ${first.year}` : "single year on record"}
        </span>
      </div>
      <div className="pd-price__stat">
        <span className="pd-price__stat-label">Avg. annual growth</span>
        <span className="pd-price__stat-value">{formatGrowth(cagr)}</span>
        <span className="pd-price__stat-note">
          {years > 0 ? `compound, ${first.year}–${latest.year}` : "not enough years"}
        </span>
      </div>
      <div className="pd-price__stat">
        <span className="pd-price__stat-label">Best year</span>
        <span className="pd-price__stat-value">
          {best ? best.year : "—"}
        </span>
        <span className="pd-price__stat-note">
          {best ? `${formatGrowth(best.growth)} that year` : "no movement on record"}
        </span>
      </div>
    </div>
  );
}

/**
 * The line graph.
 *
 * Mounts only once the data has arrived, so its ResizeObserver and its
 * animation state are set up against a container that exists.
 */
function PriceTrendChart({ rows }: { rows: TrendRow[] }) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  /** The point the pointer or the keyboard is on, or null for none. */
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const hintId = useId();

  useEffect(() => {
    const node = plotRef.current;
    if (!node) return undefined;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      // Sub-pixel churn on scroll (mobile toolbars) would otherwise re-render
      // the chart for changes nobody can see.
      setWidth((current) => (Math.abs(current - next) > 0.5 ? next : current));
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const prices = rows.map((row) => row.price);
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const span = highest - lowest || Math.max(Math.abs(highest), 1);

  /**
   * The domain is padded around the data rather than pinned to zero. Zero
   * would flat-line anything under a few thousand rupees — a property that
   * went from ₹1,200 to ₹2,100 would draw a line along the floor.
   */
  const domainMin = lowest - span * 0.14;
  const domainMax = highest + span * 0.14;
  const ticks = niceTicks(domainMin, domainMax, Y_TICK_COUNT);

  const plotWidth = Math.max(width - PAD_LEFT - PAD_RIGHT, 0);
  const plotHeight = PLOT_HEIGHT;
  const count = rows.length;

  const xAt = (index: number) =>
    PAD_LEFT +
    (count === 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);

  const yAt = (value: number) =>
    PAD_TOP +
    plotHeight -
    ((value - domainMin) / (domainMax - domainMin)) * plotHeight;

  const points = rows.map((row, index) => ({
    row,
    x: xAt(index),
    y: yAt(row.price),
  }));

  const line = linePath(points);
  const area = line
    ? `${line} L ${xAt(count - 1)} ${PAD_TOP + plotHeight} L ${xAt(0)} ${
      PAD_TOP + plotHeight
    } Z`
    : null;

  /** Every `step`th year gets a label, but the latest one always does. */
  const labelStep = Math.max(
    1,
    Math.ceil((count * MIN_YEAR_LABEL_GAP) / Math.max(plotWidth, 1)),
  );

  const active = activeIndex === null ? null : rows[activeIndex];
  const activePoint = activeIndex === null ? null : points[activeIndex];

  const indexFromClientX = (clientX: number) => {
    const node = plotRef.current;
    if (!node || count < 2) return count - 1;
    const rect = node.getBoundingClientRect();
    const offset = clientX - rect.left - PAD_LEFT;
    const raw = Math.round((offset / Math.max(plotWidth, 1)) * (count - 1));
    return Math.min(Math.max(raw, 0), count - 1);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    setActiveIndex(indexFromClientX(event.clientX));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = (delta: number) => {
      event.preventDefault();
      setActiveIndex((current) => {
        const from = current ?? (delta > 0 ? -1 : count);
        return Math.min(Math.max(from + delta, 0), count - 1);
      });
    };

    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        step(1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        step(-1);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(count - 1);
        break;
      case "Escape":
        setActiveIndex(null);
        break;
      default:
        break;
    }
  };

  // The tooltip flips below its point when the point is too near the top of
  // the plot for the tooltip to sit above it.
  const tipStyle: CSSProperties | null = activePoint
    ? {
        left: `${Math.min(
          Math.max(activePoint.x, TOOLTIP_HALF_WIDTH + 4),
          Math.max(width - TOOLTIP_HALF_WIDTH - 4, TOOLTIP_HALF_WIDTH + 4),
        )}px`,
        top: `${activePoint.y}px`,
        transform:
          activePoint.y > PAD_TOP + 96
            ? "translate(-50%, calc(-100% - 12px))"
            : "translate(-50%, 12px)",
      }
    : null;

  const summary = `Line graph of price per square yard, ${rows[0].year} to ${
    rows[count - 1].year
  }, from ${formatRupees(rows[0].price)} to ${formatRupees(
    rows[count - 1].price,
  )}. The table below lists every year.`;

  return (
    <figure className="pd-price__chart-card">
      <figcaption className="pd-price__chart-head">
        <span className="pd-price__chart-title">Price per sq yard</span>
        <span className="pd-price__chart-range">
          {rows[0].year} – {rows[count - 1].year}
        </span>
      </figcaption>

      <div
        ref={plotRef}
        className="pd-price__plot"
        role="img"
        aria-label={summary}
        aria-describedby={hintId}
        tabIndex={0}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerMove}
        onPointerLeave={() => setActiveIndex(null)}
        onFocus={() => setActiveIndex(count - 1)}
        onBlur={() => setActiveIndex(null)}
        onKeyDown={handleKeyDown}
      >
        {width > 0 ? (
          <svg
            className="pd-price__svg"
            width={width}
            height={PAD_TOP + plotHeight + PAD_BOTTOM}
            viewBox={`0 0 ${width} ${PAD_TOP + plotHeight + PAD_BOTTOM}`}
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="pd-price-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c6a46c" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#c6a46c" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal grid, one line per rupee tick. */}
            {ticks.map((tick) => (
              <line
                key={tick}
                className="pd-price__grid"
                x1={PAD_LEFT}
                x2={PAD_LEFT + plotWidth}
                y1={yAt(tick)}
                y2={yAt(tick)}
              />
            ))}

            {/* The axis itself sits under the plot, not through it. */}
            <line
              className="pd-price__axis"
              x1={PAD_LEFT}
              x2={PAD_LEFT + plotWidth}
              y1={PAD_TOP + plotHeight}
              y2={PAD_TOP + plotHeight}
            />

            {ticks.map((tick) => (
              <text
                key={tick}
                className="pd-price__tick"
                x={PAD_LEFT - 10}
                y={yAt(tick)}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatAxisRupees(tick)}
              </text>
            ))}

            {area ? (
              <path className="pd-price__area" d={area} fill="url(#pd-price-area)" />
            ) : null}

            {line ? (
              <path
                className="pd-price__line"
                d={line}
                pathLength={1}
                fill="none"
                stroke="#c6a46c"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {activePoint ? (
              <line
                className="pd-price__crosshair"
                x1={activePoint.x}
                x2={activePoint.x}
                y1={PAD_TOP}
                y2={PAD_TOP + plotHeight}
              />
            ) : null}

            {points.map((point, index) => {
              const isActive = index === activeIndex;
              return (
                <g key={point.row.year} className="pd-price__point-group">
                  {isActive ? (
                    <circle
                      className="pd-price__halo"
                      cx={point.x}
                      cy={point.y}
                      r={11}
                    />
                  ) : null}
                  <circle
                    className={`pd-price__point${isActive ? " is-active" : ""}`}
                    cx={point.x}
                    cy={point.y}
                    r={isActive ? 6 : 4}
                    style={{ animationDelay: `${0.25 + (index / Math.max(count - 1, 1)) * 0.55}s` }}
                  />
                  {index % labelStep === 0 || index === count - 1 ? (
                    <text
                      className="pd-price__year"
                      x={point.x}
                      y={PAD_TOP + plotHeight + 19}
                      textAnchor="middle"
                    >
                      {point.row.year}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : null}

        {active && tipStyle ? (
          <div className="pd-price__tip" style={tipStyle} aria-hidden="true">
            <span className="pd-price__tip-year">{active.year}</span>
            <span className="pd-price__tip-price">
              {formatRupees(active.price)}
              <span className="pd-price__tip-unit">/sq yd</span>
            </span>
            <span
              className={`pd-price__tip-delta ${
                active.growth === null
                  ? "is-flat"
                  : active.growth >= 0
                    ? "is-up"
                    : "is-down"
              }`}
            >
              {active.growth === null ? (
                activeIndex === 0 ? "First year on record" : "No change on record"
              ) : (
                <>
                  <span aria-hidden="true">
                    {active.growth >= 0 ? "▲" : "▼"}
                  </span>{" "}
                  {formatGrowth(active.growth)}
                  <span className="pd-price__tip-abs">
                    {formatSignedRupees(active.change)}
                  </span>
                </>
              )}
            </span>
          </div>
        ) : null}

        {/* Announced instead of the tooltip: the tooltip is painted for the
            eye only, and a pointer has no way to read it anyway. */}
        <p className="pd-price__sr" role="status">
          {active
            ? `${active.year}: ${formatRupees(active.price)} per square yard${
                active.growth === null
                  ? activeIndex === 0
                    ? ", first year on record"
                    : ", no recorded change"
                  : `, ${formatGrowth(active.growth)} on the year`
              }.`
            : ""}
        </p>
      </div>

      <p className="pd-price__hint" id={hintId}>
        Focus the graph and use the arrow keys, Home or End to walk through the
        years.
      </p>
    </figure>
  );
}

/**
 * Every year as a row, newest first.
 *
 * The graph is the picture; this is the record. It is also the only part that
 * works without a pointer, so it stays a real table with row headers.
 */
function PriceTrendTable({ rows }: { rows: TrendRow[] }) {
  return (
    <table className="pd-price__table">
      <caption className="pd-price__sr">
        Price per square yard for {rows[0].year} to {rows[rows.length - 1].year},
        with the change from the year before, newest first.
      </caption>
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Price / sq yd</th>
          <th scope="col">Year on year</th>
        </tr>
      </thead>
      <tbody>
        {[...rows].reverse().map((row, index) => (
          <tr key={row.year} className={index === 0 ? "is-current" : undefined}>
            <th scope="row">{row.year}</th>
            <td className="pd-price__table-price">{formatRupees(row.price)}</td>
            <td>
              {row.growth === null ? (
                <span className="pd-price__delta is-flat">
                  {index === rows.length - 1 ? "First year" : "—"}
                </span>
              ) : (
                <span
                  className={`pd-price__delta ${
                    row.growth >= 0 ? "is-up" : "is-down"
                  }`}
                >
                  <span aria-hidden="true">{row.growth >= 0 ? "▲" : "▼"}</span>{" "}
                  {formatGrowth(row.growth)}
                </span>
              )}
              <span className="pd-price__table-change">
                {formatSignedRupees(row.change)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
