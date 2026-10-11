"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV_LINKS = [
  { href: "#about", label: "About" },
  { href: "#projects", label: "Projects" },
  { href: "#services", label: "Services" },
  { href: "/properties", label: "Properties" },
  { href: "#contact", label: "Contact" },
] as const;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const pathname = usePathname();

  /**
   * Current page, not current section.
   *
   * Four of the five links are homepage fragments — `#about`, `#projects`,
   * `#services`, `#contact` all resolve inside components that only render on
   * `/`. On `/properties/{id}` they have no target, so they can never be the
   * section in view and are deliberately left out of this. `/properties` is the
   * one link that does match a route, and `startsWith` keeps it active on the
   * detail pages nested underneath it.
   */
  const isCurrent = (href: string) =>
    href === "/properties" && pathname.startsWith("/properties");

  useEffect(() => {
    const onScroll = () => {
      // Desktop: always show
      if (!window.matchMedia("(max-width: 767px)").matches) {
        setHidden(false);
        return;
      }

      // Keep visible while menu is open
      if (open) {
        setHidden(false);
        lastScrollY.current = window.scrollY;
        return;
      }

      const current = window.scrollY;
      const delta = current - lastScrollY.current;

      // Always show near the top
      if (current < 24) {
        setHidden(false);
      } else if (delta > 8) {
        // Scrolling down
        setHidden(true);
        setOpen(false);
      } else if (delta < -8) {
        // Scrolling up
        setHidden(false);
      }

      lastScrollY.current = current;
    };

    lastScrollY.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-md transition-transform duration-300 ease-out md:translate-y-0 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <nav
        className="ila-gutter-x flex h-14 w-full items-center justify-between sm:h-16"
        aria-label="Primary"
      >
        <Link
          href="/"
          className="relative z-10 flex shrink-0 items-center"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/ila-homes-logo.png"
            alt="ILA Homes"
            width={1086}
            height={362}
            priority
            /*
             * The supplied file is an opaque near-black rectangle with the mark
             * in light grey, not a transparent PNG. Against the black header
             * that box reads as a grey patch, and over a white page it shows a
             * hard seam.
             *
             * `screen` is the conventional way to drop a black field without a
             * new asset: screen(base, black) === base, so the rectangle
             * disappears and the mark survives with a slight lift. This is a
             * workaround, not a fix — a PNG with a real alpha channel would
             * also let the logo sit on a light surface later.
             */
            className="mix-blend-screen h-12 w-auto sm:h-14 lg:h-16"
          />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => {
            const current = isCurrent(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`relative text-sm tracking-[0.14em] uppercase transition-colors duration-200 hover:text-white ${
                    current
                      ? /* Full white plus a gold rule. Colour alone would be
                           indistinguishable from hover, and hover is
                           transient — an active state that only looks different
                           while the cursor is on it is not an active state. */
                        "text-white after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:bg-[#c6a46c]"
                      : "text-white/70"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          className="relative z-10 flex h-10 w-10 items-center justify-center text-white md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span className="flex w-5 flex-col gap-1.5">
            <span
              className={`block h-px w-full bg-white transition-transform duration-200 ${
                open ? "translate-y-1.75 rotate-45" : ""
              }`}
            />
            <span
              className={`block h-px w-full bg-white transition-opacity duration-200 ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`block h-px w-full bg-white transition-transform duration-200 ${
                open ? "-translate-y-1.75 -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </nav>

      <div
        id="mobile-nav"
        className={`border-t border-white/10 md:hidden ${
          open ? "block" : "hidden"
        }`}
      >
        <ul className="ila-gutter-x flex w-full flex-col gap-1 py-4">
          {NAV_LINKS.map((link) => {
            const current = isCurrent(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`block py-3 text-sm tracking-[0.14em] uppercase transition-colors duration-200 hover:text-white ${
                    current ? "text-[#c6a46c]" : "text-white/80"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </header>
  );
}
