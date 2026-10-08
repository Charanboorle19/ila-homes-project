"use client";

import Image from "next/image";
import Link from "next/link";
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
        className="flex h-14 w-full items-center justify-between px-6 sm:h-16 sm:px-8 lg:px-12"
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
            className="h-12 w-auto sm:h-14 lg:h-16"
          />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm tracking-[0.14em] text-white/70 uppercase transition-colors duration-200 hover:text-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
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
        <ul className="flex w-full flex-col gap-1 px-6 py-4 sm:px-8 lg:px-12">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block py-3 text-sm tracking-[0.14em] text-white/80 uppercase transition-colors duration-200 hover:text-white"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
