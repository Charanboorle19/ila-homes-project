"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sends the window to the top of the document on every route change.
 *
 * Next.js does not do this reliably, and the failure mode is specific to this
 * site. Per the App Router `<Link>` docs, the default `scroll` behaviour is to
 * **maintain scroll position**: Next.js walks the top-level elements and scrolls
 * "a scrollable element that is visible in the viewport", bypassing sticky and
 * fixed elements and anything without rendered HTML.
 *
 * On a conventional site — a handful of short pages — that resolves to the
 * window and lands correctly. This homepage is a single very long document
 * packed with independently scrollable regions: the FindYourPlot results panel
 * (`.ila-scroll-dark`), the CompareProperties table (`.ila-search-scroll`), the
 * GrowthCorridors card carousel, and both MapLibre frames. Tapping a property
 * card deep in one of those sections therefore let Next.js resolve its scroll
 * target against the section rather than the document, and the destination page
 * opened at the offset the section happened to be sitting at — which is the
 * reported symptom.
 *
 * Doing it here rather than per-link is deliberate:
 *
 *   - property links live in eight components (Navbar, Footer, PropertiesList,
 *     SimilarProperties, GrowthCorridors, MapSection's PropertySheet,
 *     FindYourPlot, the CompareProperties detail columns). Adding `scroll`
 *     handling to each would be eight chances to forget one, and a new property
 *     card would silently inherit the bug.
 *   - the root layout is the only element that survives every navigation, so one
 *     component here covers every route and every future one.
 *
 * **`useEffect`, not `useLayoutEffect`.** A layout effect would run before paint
 * and so avoid a visible jump, but it also fires during server rendering, where
 * React warns that it is a no-op on the server. The jump is not visible here:
 * this runs in the same commit as the navigation, and the destination pages are
 * short at first paint, so there is little to see before the correction.
 *
 * **Hash navigation is left alone.** A link to `/#faq` or `/#contact` also
 * changes the pathname when it comes from another route, and this effect would
 * race the browser's own scroll to the fragment. `window.location.hash` is
 * already populated by the time the effect runs, so bailing on it hands those
 * links back to the platform. Same-page fragment navigation never changes the
 * pathname and so never reaches this effect at all.
 */
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // No hash: either a plain page navigation, or a same-page link that did not
    // change the pathname and therefore did not run this effect.
    if (window.location.hash) return;

    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}