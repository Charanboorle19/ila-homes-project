"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import HomeReadyToVisit from "@/components/HomeReadyToVisit";

const NAV_LINKS = [
  { href: "/why-us", label: "About" },
  { href: "/properties", label: "Properties" },
  { href: "#contact", label: "Contact" },
] as const;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const lastScrollY = useRef(0);
  const pathname = usePathname();

  /**
   * Current page highlight matching.
   */
  const isCurrent = (href: string) => {
    if (href === "/properties") {
      return pathname.startsWith("/properties");
    }
    if (href === "/why-us") {
      return pathname === "/why-us";
    }
    return false;
  };

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
        className="flex h-14 w-full items-center justify-between px-3 sm:h-16 sm:px-6 lg:px-8"
        aria-label="Primary"
      >
        <Link
          href="/"
          className="relative z-10 -ml-1 flex shrink-0 items-center transition-transform hover:scale-[1.02] sm:ml-0"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/ila-homes-logo.png"
            alt="ILA Homes"
            width={160}
            height={53}
            sizes="(max-width: 640px) 130px, 160px"
            loading="eager"
            decoding="async"
            className="h-11 w-auto object-contain sm:h-14 lg:h-16"
          />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <ul className="flex items-center gap-8">
            {NAV_LINKS.map((link) => {
              const current = isCurrent(link.href);
              const isContact = link.href === "#contact";

              if (isContact) {
                return (
                  <li key={link.href}>
                    <button
                      type="button"
                      onClick={() => setContactModalOpen(true)}
                      className="relative text-sm tracking-[0.14em] uppercase transition-colors duration-200 text-white/70 hover:text-white cursor-pointer"
                    >
                      {link.label}
                    </button>
                  </li>
                );
              }

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

          <Link
            href={pathname === "/why-us" ? "/" : "/why-us"}
            aria-current={pathname === "/why-us" ? "page" : undefined}
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full p-px transition-transform duration-300 active:scale-95"
          >
            {/* Subtle rotating gradient beam along the stroke */}
            <span
              className="absolute -inset-full animate-[spin_4.5s_linear_infinite] [background:conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,rgba(234,179,8,0.7)_88%,transparent_100%)]"
              aria-hidden
            />
            {/* Button body */}
            <span className={`relative inline-flex h-full w-full items-center justify-center rounded-full border border-yellow-500/20 px-4 py-1.5 text-xs font-semibold tracking-wider uppercase backdrop-blur-md transition-colors duration-200 group-hover:bg-[#1a1a1a] group-hover:text-yellow-300 ${
              pathname === "/why-us"
                ? "bg-yellow-500/15 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                : "bg-[#121212]/95 text-yellow-400/90"
            }`}>
              {pathname === "/why-us" ? "Home" : "Why Us ?"}
            </span>
          </Link>
        </div>

        <div className="relative z-10 flex items-center gap-3 md:hidden">
          <Link
            href={pathname === "/why-us" ? "/" : "/why-us"}
            aria-current={pathname === "/why-us" ? "page" : undefined}
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full p-px transition-transform duration-300 active:scale-95"
            onClick={() => setOpen(false)}
          >
            {/* Subtle rotating gradient beam along the stroke */}
            <span
              className="absolute -inset-full animate-[spin_4.5s_linear_infinite] [background:conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,rgba(234,179,8,0.7)_88%,transparent_100%)]"
              aria-hidden
            />
            {/* Button body */}
            <span className={`relative inline-flex h-full w-full items-center justify-center rounded-full border border-yellow-500/20 px-3 py-1 text-[11px] font-semibold tracking-wider uppercase backdrop-blur-md transition-colors duration-200 group-hover:bg-[#1a1a1a] group-hover:text-yellow-300 ${
              pathname === "/why-us"
                ? "bg-yellow-500/15 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                : "bg-[#121212]/95 text-yellow-400/90"
            }`}>
              {pathname === "/why-us" ? "Home" : "Why Us ?"}
            </span>
          </Link>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center text-white"
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
        </div>
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
            const isContact = link.href === "#contact";

            if (isContact) {
              return (
                <li key={link.href}>
                  <button
                    type="button"
                    className="block w-full text-left py-3 text-sm tracking-[0.14em] uppercase transition-colors duration-200 text-white/80 hover:text-white cursor-pointer"
                    onClick={() => {
                      setOpen(false);
                      setContactModalOpen(true);
                    }}
                  >
                    {link.label}
                  </button>
                </li>
              );
            }

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

      {/* Contact Form Modal Popup */}
      {contactModalOpen && (
        <div
          className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm ila-modal-backdrop animate-in fade-in duration-200"
          onClick={() => setContactModalOpen(false)}
        >
          <div
            className="relative flex w-full sm:w-[96vw] max-w-6xl max-h-[92vh] my-auto flex-col rounded-t-3xl sm:rounded-2xl border-t border-x-0 sm:border border-white/15 bg-[#17191d] text-[#f2f0ea] shadow-2xl overflow-hidden ila-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 bg-[#1a1c21]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c6a46c]/20 text-[#c6a46c]">
                  <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Contact ILA Homes
                  </h3>
                  <p className="text-xs text-[#9a9388]">
                    Send us your enquiry or request a callback
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close contact form"
                title="Close"
                onClick={() => setContactModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c6a46c]/50 bg-[#c6a46c]/20 text-[#c6a46c] shadow-md transition hover:bg-[#c6a46c] hover:text-[#17191d] hover:border-[#c6a46c] active:scale-95"
              >
                <svg className="h-4.5 w-4.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body: HomeReadyToVisit Form */}
            <div className="flex-1 overflow-y-auto">
              <HomeReadyToVisit
                propertyName="ILA Homes"
                onSuccess={() => setContactModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
