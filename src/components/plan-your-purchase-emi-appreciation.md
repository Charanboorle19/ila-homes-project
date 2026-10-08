# Plan your purchase — see size, cost and returns together

> **Superseded.** The canonical documentation for this section and the EMI
> calculator it hosts is [`docs/features/emi-calculator.md`](../../docs/features/emi-calculator.md).
>
> This file previously described a self-contained calculator that has since
> been removed. It was kept only because other handoff documents link to it; it
> is no longer a description of current behaviour.

## What changed

The section used to contain its own hand-rolled calculator alongside a separate
one on the property detail page. The two had drifted: the homepage version was
pinned to a fixed 8.5% rate and 20-year tenure with only a down-payment slider,
and it priced six hard-coded demo plots of which five were permanently locked
as "Coming soon".

The homepage calculator and all of its presentation are gone. The section now:

- fetches real properties from `GET /api/properties`;
- renders them as a selectable picker; and
- delegates the entire calculator to `PriceEmiFuture`, the same component
  `/properties/{propertyId}` uses.

Until a property is chosen, a locked placeholder is shown in place of the
calculator rather than a greyed-out calculator with a fabricated price.

## What was removed

- The six-item static `PLOTS` array and its six imported plot images.
- The hand-rolled `calcEmi` / `buildStory` and the `APPRECIATION_3YR` projection.
- The entire dark desktop frame, plot chips, custom slider, results rows,
  appreciation timeline, insight cards, and the separate `.ea-m` progressive
  mobile tree.
- `EmiAppreciation.css` was rewritten from scratch — roughly 1,400 lines of
  bespoke calculator styling replaced by a shell stylesheet for the frame,
  heading, picker and locked placeholder.
- The homepage's own `WhatsAppBudgetModal` usage; the shared calculator has one.
- The homepage's `EMI_CALCULATOR_USE` slider events. `EMI_PROPERTY_SELECT` is
  retained but now carries `property_id` rather than `plot_id`.

## Where to look instead

| Concern | File |
|---|---|
| Calculator behaviour, formula, state, validation | [`PriceEmiFuture.tsx`](../PropertyDetail/PriceEmiFuture.tsx) |
| Homepage shell, property fetch, picker | [`EmiAppreciation.tsx`](./EmiAppreciation.tsx) |
| Homepage shell styles | [`EmiAppreciation.css`](./EmiAppreciation.css) |
| Full feature documentation | [`docs/features/emi-calculator.md`](../../docs/features/emi-calculator.md) |

Note the filenames in this repository are `.tsx`, not `.jsx`. Earlier revisions
of this document referred to `.jsx` and were already out of date on that point.