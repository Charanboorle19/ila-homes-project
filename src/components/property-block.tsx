"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { EstateProject } from "@/data/projects";
import type { PropertyRecord } from "@/data/properties";
import type { Plot } from "@/data/plots";
import { formatPrice, type ApiProperty } from "@/services/propertiesService";
import { formatInr } from "@/lib/propertyUtils";
import {
  fetchFavorites,
  saveFavorite,
  removeFavorite,
} from "@/services/favoritesService";
import ShortlistPreviewModal from "@/components/ShortlistPreviewModal";
import type { ShortlistPlot } from "@/components/ShortlistShare";
import { createPropertyShares, buildShareUrl } from "@/services/shareService";
import PlotsWithPulse from "@/components/PlotsWithPulse";
import HomeReadyToVisit from "@/components/HomeReadyToVisit";
import familyCommunityImg from "@/app/assets/Family Dreams Over a New Community.png";

// SVG Icons tailored for the property block
function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function HeartIcon({ className = "", filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "#c6a46c" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CompareIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
      <rect x="18" y="22" width="26" height="26" rx="5.5" />
      <rect x="64" y="22" width="26" height="26" rx="5.5" />
      <rect x="18" y="53" width="72" height="5.5" rx="2.75" />
      <path d="M 48 56 H 60 L 70.5 76.5 A 5.5 5.5 0 0 1 65.6 84.5 H 42.4 A 5.5 5.5 0 0 1 37.5 76.5 Z" />
    </svg>
  );
}

function ShareIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function WhatsappIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.41a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.03-1.24-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29z" />
    </svg>
  );
}

function CalculatorIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="16" y1="14" x2="16" y2="18" />
      <path d="M16 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 10h.01" />
      <path d="M12 14h.01" />
      <path d="M8 14h.01" />
      <path d="M12 18h.01" />
      <path d="M8 18h.01" />
    </svg>
  );
}

function PhoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function SchoolIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function TreesIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" />
      <path d="M7 16v6" />
      <path d="M13 19v3" />
      <path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-4 4.3a1 1 0 0 0 .8 1.7H10l-3 3.3a1 1 0 0 0 .7 1.7H10" />
    </svg>
  );
}

function RoadIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19L9 5" />
      <path d="M20 19L15 5" />
      <path d="M12 6v3" />
      <path d="M12 12v3" />
      <path d="M12 18v3" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CheckCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function EyeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ExpandIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
    </svg>
  );
}

export type PropertyBlockProps = {
  desktopOpen: boolean;
  onCloseDesktop: () => void;
  portalReady: boolean;
  selectedPlot: unknown | null;
  mapFullscreen: boolean;
  mobileExpanded: boolean;
  onToggleMobileExpand: () => void;
  onCloseMobile: () => void;
  project: EstateProject | null;
  property: PropertyRecord | undefined;
  apiProperty: ApiProperty | null;
  tab?: string;
  onTabChange?: (tab: any) => void;
  onSelectPlot?: (plot: Plot) => void;
  onOpenCompare?: (propertyId?: string) => void;
  onOpenEmi?: (propertyInfo: { id: string; name: string; price: number; location?: string }) => void;
};

/**
 * PropertyBlock component strictly adhering to user specifications:
 * 1. Property Image Gallery (Large cover, available status badge, carousel with nav arrows, pagination dots, close button)
 * 2. Property Information (Name, location with map-pin icon, plot size range, starting price, HMDA, RERA)
 * 3. Your Fit (Suitability highlights: Near schools, Quiet surroundings, Good road access)
 * 4. Available Plots (Selectable plot cards: plot number, size, facing direction, gold border highlight, view all plots)
 * 5. Availability and Activity (People viewing this week, total available plots count with green indicator)
 * 6. Quick Actions (Wishlist, Compare, Share, WhatsApp, EMI)
 * 7. Primary Actions (Book a site visit, Call)
 * 8. UI and Interaction (Warm ivory background, soft shadows, subtle borders, gold accents, green badges)
 */
export default function PropertyBlock({
  desktopOpen,
  onCloseDesktop,
  portalReady,
  selectedPlot,
  mapFullscreen,
  mobileExpanded,
  onToggleMobileExpand,
  onCloseMobile,
  project,
  property,
  apiProperty,
  onSelectPlot,
  onOpenCompare,
  onOpenEmi,
}: PropertyBlockProps) {
  // Gallery state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [wishlistSaved, setWishlistSaved] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [compareSaved, setCompareSaved] = useState(false);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [showAllPlots, setShowAllPlots] = useState(false);

  // Active property ID for favorites API
  const activePropertyId = apiProperty?.id || property?.id || project?.id;

  // Pulse ("See what others are viewing") modal popup state
  const [pulseModalOpen, setPulseModalOpen] = useState(false);

  // Site visit ("Next step") modal popup state
  const [siteVisitModalOpen, setSiteVisitModalOpen] = useState(false);

  // Touch drag state to automatically maximize on upward drag, and minimize on downward drag
  const touchStartYRef = React.useRef<number | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = touchStartYRef.current - currentY;

    // Upward drag while minimized -> automatically maximize
    if (!mobileExpanded && deltaY > 28) {
      touchStartYRef.current = null;
      onToggleMobileExpand();
      return;
    }

    // Downward drag while maximized -> automatically minimize
    // If inside the scrollable content, only trigger when user is scrolled to the very top (scrollTop <= 0)
    if (mobileExpanded && deltaY < -32) {
      const scrollPos = scrollContainerRef.current?.scrollTop ?? 0;
      if (scrollPos <= 2) {
        touchStartYRef.current = null;
        onToggleMobileExpand();
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartYRef.current = null;
  };

  // Shortlist WhatsApp Preview Share Modal state
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);
  const [shareUrls, setShareUrls] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);

  // Check if current property is saved in favorites
  useEffect(() => {
    let cancelled = false;
    const checkFavorite = async () => {
      if (!activePropertyId) return;
      try {
        const favs = await fetchFavorites();
        if (!cancelled) {
          const isSaved = favs.some(
            (f) =>
              f.property_id === activePropertyId ||
              f.property_id === property?.id ||
              f.property_id === project?.id,
          );
          setWishlistSaved(isSaved);
        }
      } catch {
        // visitor code or network error
      }
    };
    void checkFavorite();
    return () => {
      cancelled = true;
    };
  }, [activePropertyId, property?.id, project?.id]);

  const handleToggleWishlist = async () => {
    if (!activePropertyId || wishlistLoading) return;
    setWishlistLoading(true);
    const nextState = !wishlistSaved;
    setWishlistSaved(nextState);

    try {
      if (nextState) {
        await saveFavorite(activePropertyId);
      } else {
        await removeFavorite(activePropertyId);
      }
      // Dispatch storage or custom event so other components (like Wishlist drawer) update in real-time
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("favorites-updated"));
      }
    } catch (e) {
      console.warn("[PropertyBlock] could not toggle favorite", e);
      // Revert on failure
      setWishlistSaved(!nextState);
    } finally {
      setWishlistLoading(false);
    }
  };

  if (!project) return null;

  // 1. Data points extraction
  const propertyName =
    apiProperty?.name ??
    property?.name ??
    project.name ??
    "Akshita Golden Breeze Phase 2";

  const propertyLocation =
    [apiProperty?.locality, apiProperty?.city].filter(Boolean).join(", ") ||
    apiProperty?.location_name ||
    property?.location ||
    project.location ||
    "Tellapur, West Hyderabad";

  // Plot size range
  const apiAreaRange = apiProperty?.area_range;
  const plotSizeRange = apiAreaRange
    ? [apiAreaRange.min, apiAreaRange.max]
        .filter((v): v is number => v !== null && Number.isFinite(v))
        .map((v) => `${v} sq yd`)
        .join(" – ")
    : property?.popupSample?.plotSizes ?? property?.sqYards ?? "133 – 449 sq yd";

  // Starting price
  const startingPrice =
    (apiProperty?.minimum_price != null
      ? formatPrice(Number(apiProperty.minimum_price))
      : apiProperty?.price
        ? formatPrice(apiProperty.price)
        : null) ??
    (property?.price ? formatInr(property.price) : "₹12 L");

  // Approvals
  const approvalStatus =
    apiProperty?.approval_details?.toUpperCase() ??
    property?.approval ??
    "HMDA Approved";

  const isRera =
    apiProperty?.rera_registered ?? property?.reraRegistered ?? true;

  // Inventory numbers
  const totalPlotsCount =
    apiProperty?.total_plots ??
    apiProperty?.total_inventory ??
    (project.plots.length || 128);

  const availablePlotsCount =
    apiProperty?.available_plots_count ??
    apiProperty?.available_inventory ??
    (project.plots.filter((p) => p.status === "available").length || 128);

  const viewingCount =
    property?.viewingCount ?? 142; // Number of people viewing this week

  // Gallery images
  const galleryImages: string[] = [];
  if (apiProperty?.cover_url) galleryImages.push(apiProperty.cover_url);
  if (property?.gallery && property.gallery.length > 0) {
    property.gallery.forEach((g) => {
      if (g.src && !galleryImages.includes(g.src)) galleryImages.push(g.src);
    });
  }
  if (galleryImages.length === 0) {
    galleryImages.push(
      "/hero-image.png",
      "/assets/property/hero-property.jpg",
      "/assets/property/extra-image-8.png",
    );
  }

  // Next / Prev Gallery
  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  };

  // Available Plots list
  const plotsList: Plot[] = project.plots.length > 0
    ? project.plots
    : [
        {
          id: "plot-101",
          title: "Plot 101",
          area: "167 sq yd",
          facing: "East Facing",
          location: propertyLocation,
          price: "₹15 Lakhs",
          status: "available",
          lng: 78.32,
          lat: 17.41,
          polygon: [],
          image: "/hero-image.png",
        },
        {
          id: "plot-102",
          title: "Plot 102",
          area: "200 sq yd",
          facing: "North Facing",
          location: propertyLocation,
          price: "₹18 Lakhs",
          status: "available",
          lng: 78.32,
          lat: 17.41,
          polygon: [],
          image: "/hero-image.png",
        },
        {
          id: "plot-103",
          title: "Plot 103",
          area: "267 sq yd",
          facing: "West Facing",
          location: propertyLocation,
          price: "₹24 Lakhs",
          status: "available",
          lng: 78.32,
          lat: 17.41,
          polygon: [],
          image: "/hero-image.png",
        },
        {
          id: "plot-104",
          title: "Plot 104",
          area: "333 sq yd",
          facing: "East Facing",
          location: propertyLocation,
          price: "₹30 Lakhs",
          status: "available",
          lng: 78.32,
          lat: 17.41,
          polygon: [],
          image: "/hero-image.png",
        },
      ];

  const displayedPlots = showAllPlots ? plotsList : plotsList.slice(0, 4);

  // Handlers for quick actions
  const handleShare = async () => {
    if (shareLoading) return;
    setShareLoading(true);

    const plotId = activePropertyId || project.id;
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    try {
      const shares = await createPropertyShares({
        entityIds: [plotId],
        message: `Please review ${propertyName}`,
      });
      const generatedUrls = shares.map((share) =>
        buildShareUrl(share.tracking_token!, origin),
      );
      setShareUrls(generatedUrls.length > 0 ? generatedUrls : [`${origin}/properties/${plotId}`]);
    } catch {
      setShareUrls([`${origin}/properties/${plotId}`]);
    } finally {
      setShareLoading(false);
      setSharePreviewOpen(true);
    }
  };

  const handleConfirmShare = () => {
    const plotUrl = shareUrls[0] || `${window.location.origin}/properties/${activePropertyId || project.id}`;
    const text = [
      `🏡 *${propertyName}*`,
      `📍 ${propertyLocation} · starting at ${startingPrice}`,
      plotUrl,
      "",
      "Review layout, pricing & financing details on ILA Homes.",
    ].join("\n");

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSharePreviewOpen(false);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hello, I am interested in ${propertyName} in ${propertyLocation} (starting at ${startingPrice}). Please share more details.`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const selectedShortlistPlot: ShortlistPlot = {
    id: activePropertyId || project.id,
    name: propertyName,
    location: propertyLocation,
    meta: `Starting at ${startingPrice} · ${plotSizeRange}`,
    highlight: apiProperty?.description || property?.description || "Property details available from ILA Homes.",
    coverUrl: galleryImages[0] || null,
    image: familyCommunityImg,
  };

  const propertyPageId = activePropertyId || apiProperty?.id || property?.id || project?.id;
  const propertyPageHref = `/properties/${propertyPageId}`;

  // Render the expanded content
  const renderExpandedBody = (onClose: () => void) => (
    <div className="flex flex-col space-y-4 text-[#24231f]">
      {/* 1. PROPERTY IMAGE GALLERY */}
      <div className="relative h-56 w-full shrink-0 overflow-hidden rounded-2xl bg-[#e3ded4] shadow-inner select-none sm:h-64">
        <Image
          src={galleryImages[currentImageIndex] || "/hero-image.png"}
          alt={`${propertyName} cover image`}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover transition-transform duration-500 ease-out"
        />

        {/* Gradient Scrim for readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

        {/* Available status badge (Top Left) */}
        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1f8a68]/30 bg-[#1f8a68] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-md backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Available
          </span>
        </div>

        {/* Close Button (Top Right) */}
        {onClose ? (
          <button
            type="button"
            aria-label="Close property details"
            title="Close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/75 active:scale-95 shadow-md"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        ) : null}

        {/* Navigation Arrows */}
        {galleryImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevImage}
              aria-label="Previous image"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-[#24231f] shadow-md backdrop-blur-sm transition hover:bg-white active:scale-95"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              aria-label="Next image"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-[#24231f] shadow-md backdrop-blur-sm transition hover:bg-white active:scale-95"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Pagination Dots */}
        {galleryImages.length > 1 && (
          <div className="absolute bottom-2.5 inset-x-0 z-10 flex items-center justify-center gap-1.5">
            {galleryImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentImageIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentImageIndex === idx
                    ? "w-5 bg-[#c6a46c]"
                    : "w-1.5 bg-white/60 hover:bg-white"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 2. PROPERTY INFORMATION / INTRO DETAILS */}
      <div className="rounded-2xl border border-[#ded9cf] bg-white p-4 shadow-[0_4px_16px_rgba(20,20,20,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold tracking-tight text-[#141414] sm:text-2xl">
              {propertyName}
            </h2>

            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#5c5549]">
              <PinIcon className="h-3.5 w-3.5 shrink-0 text-[#c6a46c]" />
              <span className="truncate">{propertyLocation}</span>
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#7a7265]">
              Starting From
            </span>
            <span className="mt-0.5 block text-lg font-black text-[#876527] sm:text-xl">
              {startingPrice}
            </span>

            {/* Wishlist Button directly below the Pricing */}
            <button
              type="button"
              onClick={handleToggleWishlist}
              disabled={wishlistLoading}
              aria-label={wishlistSaved ? "Remove from wishlist" : "Save to wishlist"}
              title={wishlistSaved ? "Saved to Wishlist" : "Add to Wishlist"}
              className={`mt-1.5 flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold transition-all duration-200 active:scale-95 ${
                wishlistSaved
                  ? "border-[#c6a46c] bg-[#faf4e4] text-[#876527] ring-1 ring-[#c6a46c] shadow-xs"
                  : "border-[#ded9cf] bg-[#faf8f4] text-[#5c5549] hover:border-[#c6a46c] hover:bg-[#faf4e4] hover:text-[#876527]"
              }`}
            >
              <HeartIcon className="h-3.5 w-3.5 text-[#c6a46c]" filled={wishlistSaved} />
              <span>{wishlistLoading ? "..." : wishlistSaved ? "Saved" : "Wishlist"}</span>
            </button>
          </div>
        </div>

        {/* Spec row: Plot size range, HMDA, RERA */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[#eee8dc] pt-3 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-[#faf7f0] px-3 py-1 text-[#24231f]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a7265]">Sizes:</span>
            <span className="font-extrabold text-[#141414]">{plotSizeRange}</span>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1f8a68]/30 bg-[#edf6f0] px-3 py-1 text-[11px] font-bold text-[#1b5e3f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1f8a68]" />
            {approvalStatus}
          </span>

          {isRera && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c6a46c]/40 bg-[#faf4e4] px-3 py-1 text-[11px] font-bold text-[#876527]">
              <span className="text-[10px]">✦</span>
              RERA Registered
            </span>
          )}
        </div>
      </div>

      {/* 3. YOUR FIT (Property suitability highlights) */}
      <div className="rounded-2xl border border-[#ded9cf] bg-white p-4 shadow-[0_4px_16px_rgba(20,20,20,0.06)]">
        <h3 className="text-xs font-extrabold tracking-[0.14em] uppercase text-[#876527]">
          Your Fit
        </h3>
        <p className="mt-0.5 text-xs font-medium text-[#6e685f]">
          Key lifestyle and location suitability match
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-[#e8e2d5] bg-[#faf8f4] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#c6a46c]/20 text-[#876527]">
              <SchoolIcon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-[#141414]">Near schools</span>
              <span className="block text-[11px] font-medium text-[#6e685f]">Reputed institutions nearby</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#e8e2d5] bg-[#faf8f4] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#c6a46c]/20 text-[#876527]">
              <TreesIcon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-[#141414]">Quiet surroundings</span>
              <span className="block text-[11px] font-medium text-[#6e685f]">Serene green community</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#e8e2d5] bg-[#faf8f4] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#c6a46c]/20 text-[#876527]">
              <RoadIcon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-[#141414]">Good road access</span>
              <span className="block text-[11px] font-medium text-[#6e685f]">Wide BT roads with connectivity</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. AVAILABLE PLOTS (Selectable plot cards) */}
      <div className="rounded-2xl border border-[#ded9cf] bg-white p-4 shadow-[0_4px_16px_rgba(20,20,20,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-extrabold tracking-[0.14em] uppercase text-[#876527]">
              Available Plots
            </h3>
            <span className="text-xs font-medium text-[#6e685f]">Select a plot for instant details</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAllPlots((prev) => !prev)}
            className="text-xs font-bold text-[#876527] underline decoration-[#c6a46c] underline-offset-4 transition hover:text-[#141414]"
          >
            {showAllPlots ? "Show fewer" : "View all plots"}
          </button>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {displayedPlots.map((plot) => {
            const isSelected = selectedPlotId === plot.id;
            return (
              <button
                key={plot.id}
                type="button"
                onClick={() => {
                  setSelectedPlotId(plot.id);
                  onSelectPlot?.(plot);
                }}
                className={`relative flex flex-col rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-[#c6a46c] bg-[#faf4e4] shadow-sm ring-2 ring-[#c6a46c]"
                    : "border-[#ded9cf] bg-[#faf8f4] hover:border-[#c6a46c]/70 hover:bg-white"
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2.5 right-2.5 text-[#876527]">
                    <CheckCircleIcon className="h-4 w-4" />
                  </span>
                )}
                <span className="text-xs font-extrabold text-[#141414]">{plot.title}</span>
                <span className="mt-1 text-[11px] font-semibold text-[#5c5549]">{plot.area}</span>
                <span className="mt-0.5 text-[10px] font-bold text-[#876527] uppercase tracking-wider">{plot.facing}</span>
                <span className="mt-2 text-xs font-black text-[#1b5e3f]">{plot.price}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. AVAILABILITY AND ACTIVITY */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-[#1f8a68]/25 bg-[#edf6f0] p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1f8a68] text-white">
            <EyeIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[#1b5e3f]">
            <strong className="font-extrabold">{viewingCount} people</strong> viewed this property this week
          </span>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <span className="h-2 w-2 rounded-full bg-[#1f8a68]" />
          <span className="font-extrabold text-[#1b5e3f]">
            {availablePlotsCount} of {totalPlotsCount} plots available
          </span>
        </div>
      </div>

      {/* "See what others are viewing" Button positioned above the quick actions */}
      <button
        type="button"
        onClick={() => setPulseModalOpen(true)}
        className="group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border border-[#c6a46c]/40 bg-gradient-to-r from-[#faf4e4] via-[#fdfbf6] to-[#f5ecd8] p-3 shadow-[0_4px_16px_rgba(198,164,108,0.14)] transition-all duration-300 hover:border-[#c6a46c] hover:shadow-[0_6px_22px_rgba(198,164,108,0.24)] active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#c6a46c] to-[#997332] text-white shadow-xs">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-xl bg-[#c6a46c] opacity-40"></span>
            <EyeIcon className="h-4 w-4 relative" />
          </span>
          <div className="text-left">
            <span className="block text-xs font-black tracking-tight text-[#141414] group-hover:text-[#876527] transition-colors">
              See What Others Are Viewing
            </span>
            <span className="block text-[10.5px] font-semibold text-[#7a7265]">
              Live interest, trending layouts &amp; active buyers
            </span>
          </div>
        </div>

        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#876527] border border-[#c6a46c]/30 shadow-xs transition group-hover:bg-[#c6a46c] group-hover:text-white">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </button>

      {/* 6. QUICK ACTIONS (Wishlist, Compare, WhatsApp, EMI, Call) */}
      <div className="grid grid-cols-5 gap-1.5 rounded-2xl border border-[#ded9cf] bg-white p-2.5 shadow-[0_4px_16px_rgba(20,20,20,0.06)]">
        {/* Wishlist */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          disabled={wishlistLoading}
          aria-label={wishlistSaved ? "Remove from wishlist" : "Save to wishlist"}
          className={`flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center transition active:scale-95 ${
            wishlistSaved ? "bg-[#faf4e4] text-[#876527]" : "text-[#4a453e] hover:bg-[#faf7f0]"
          }`}
        >
          <HeartIcon className="h-4.5 w-4.5" filled={wishlistSaved} />
          <span className="mt-1 text-[11px] font-bold">
            {wishlistLoading ? "..." : wishlistSaved ? "Saved" : "Wishlist"}
          </span>
        </button>

        {/* Compare */}
        <button
          type="button"
          onClick={() => {
            setCompareSaved(true);
            onCloseMobile();
            onCloseDesktop();
            onOpenCompare?.(activePropertyId);
          }}
          className={`flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center transition active:scale-95 ${
            compareSaved ? "bg-[#faf4e4] text-[#876527]" : "text-[#4a453e] hover:bg-[#faf7f0]"
          }`}
        >
          <CompareIcon className="h-4.5 w-4.5 text-[#876527]" />
          <span className="mt-1 text-[11px] font-bold">Compare</span>
        </button>

        {/* Share via WhatsApp */}
        <button
          type="button"
          onClick={handleShare}
          disabled={shareLoading}
          aria-label="Share property via WhatsApp"
          className="flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center text-[#1b5e3f] transition hover:bg-[#edf6f0] active:scale-95 disabled:opacity-60"
        >
          <WhatsappIcon className="h-4.5 w-4.5" />
          <span className="mt-1 text-[11px] font-bold">
            {shareLoading ? "..." : "Share"}
          </span>
        </button>

        {/* EMI */}
        <button
          type="button"
          onClick={() => {
            const rawPrice =
              (apiProperty?.minimum_price != null ? Number(apiProperty.minimum_price) : null) ??
              apiProperty?.price ??
              property?.price ??
              5000000;
            if (onOpenEmi) {
              onOpenEmi({
                id: activePropertyId || project.id,
                name: propertyName,
                price: rawPrice,
                location: propertyLocation,
              });
            }
          }}
          className="flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center text-[#4a453e] transition hover:bg-[#faf7f0] active:scale-95"
        >
          <CalculatorIcon className="h-4.5 w-4.5 text-[#876527]" />
          <span className="mt-1 text-[11px] font-bold">EMI</span>
        </button>

        {/* Call */}
        <a
          href="tel:+919876543210"
          aria-label="Call ILA Homes"
          className="flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center text-[#4a453e] transition hover:bg-[#faf7f0] active:scale-95"
        >
          <PhoneIcon className="h-4.5 w-4.5 text-[#876527]" />
          <span className="mt-1 text-[11px] font-bold">Call</span>
        </a>
      </div>

      {/* 7. PRIMARY ACTIONS (Book a site visit, View Property) */}
      <div className="flex items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => setSiteVisitModalOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4b57e] via-[#c6a46c] to-[#b38e52] py-3.5 text-xs font-black tracking-wider uppercase text-[#141414] shadow-md transition active:scale-[0.99] hover:brightness-105 cursor-pointer"
        >
          <span>Book a Site Visit</span>
        </button>

        <Link
          href={propertyPageHref}
          className="flex items-center justify-center gap-2 rounded-xl border border-black/15 bg-white px-5 py-3.5 text-xs font-black text-[#141414] shadow-sm transition hover:bg-[#faf7f0] active:scale-95 whitespace-nowrap"
        >
          <span>View Property</span>
        </Link>
      </div>
    </div>
  );

  // Render minimized bottom strip for mobile (cleanly displaying property name, location, price, and size)
  const renderMinimizedBody = (onToggle: () => void) => (
    <div
      onClick={onToggle}
      className="flex w-full cursor-pointer flex-col justify-center select-none py-1"
    >
      {/* Property Name */}
      <h3 className="truncate text-base font-extrabold tracking-tight text-[#141414]">
        {propertyName}
      </h3>

      {/* Location */}
      <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#5c5549]">
        <PinIcon className="h-3.5 w-3.5 shrink-0 text-[#c6a46c]" />
        <span className="truncate">{propertyLocation}</span>
      </p>

      {/* Price & Size on high-visibility pill / row */}
      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-lg bg-[#c6a46c]/15 px-2.5 py-1 text-xs font-black text-[#876527]">
          From {startingPrice}
        </span>
        <span className="rounded-lg bg-black/[0.05] border border-black/10 px-2.5 py-1 text-xs font-bold text-[#2a2824]">
          {plotSizeRange}
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* 8. UI & INTERACTION: DESKTOP FLOATING CARD (Warm Ivory Theme) */}
      {desktopOpen && !mapFullscreen ? (
        <aside
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 z-30 hidden md:flex w-[380px] max-h-[85vh] flex-col"
          aria-label="Selected property summary"
        >
          <div className="pointer-events-auto relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#ded9cf] bg-[#f9f7f2] shadow-[0_16px_40px_rgba(36,35,31,0.18)] transition-all duration-300 animate-in fade-in zoom-in-95 slide-in-from-left-4">
            <div className="flex shrink-0 items-center justify-between border-b border-[#ded9cf] bg-white px-4 py-3">
              <span className="text-[11px] font-bold tracking-[0.18em] text-[#8a6d34] uppercase">
                Property Summary
              </span>
              <button
                type="button"
                aria-label="Close property card"
                onClick={onCloseDesktop}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f0ece3] text-[#5c5348] transition hover:bg-[#e4ded2] active:scale-95"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="ila-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {renderExpandedBody(onCloseDesktop)}
            </div>
          </div>
        </aside>
      ) : null}

      {/* 8. UI & INTERACTION: MOBILE BOTTOM-SHEET POPUP (Warm Ivory Theme #f9f7f2) */}
      {portalReady && !selectedPlot && !mapFullscreen
        ? createPortal(
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`pointer-events-auto fixed inset-x-0 bottom-0 z-[200] flex flex-col overflow-hidden rounded-t-[1.75rem] border-x border-t border-[#ded9cf] bg-[#f9f7f2] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-12px_36px_rgba(36,35,31,0.22)] transition-[height,max-height] duration-300 animate-in fade-in slide-in-from-bottom-6 duration-300 md:hidden ${
                mobileExpanded ? "h-[88%] max-h-[88%]" : "h-auto max-h-44"
              }`}
            >
              {/* Top Controls Row */}
              <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
              >
                <button
                  type="button"
                  aria-label="Close property details"
                  onClick={onCloseMobile}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#24231f] border border-[#ded9cf] shadow-sm transition active:scale-95"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>

                {/* Handle Bar */}
                <button
                  type="button"
                  aria-label={mobileExpanded ? "Minimize" : "Maximize"}
                  onClick={onToggleMobileExpand}
                  className="flex h-6 w-24 items-center justify-center rounded-full"
                >
                  <span className="h-1 w-10 rounded-full bg-[#c9c3b6]" />
                </button>

                {/* Maximize / Minimize Action Button */}
                <button
                  type="button"
                  aria-label={mobileExpanded ? "Minimize" : "Maximize"}
                  onClick={onToggleMobileExpand}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c6a46c] text-[#171717] shadow-sm transition active:scale-95"
                >
                  <ExpandIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div
                ref={scrollContainerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`flex min-h-0 flex-1 flex-col px-4 pb-2 ${
                  mobileExpanded ? "overflow-y-auto overscroll-contain pb-3" : "overflow-hidden"
                }`}
              >
                {mobileExpanded ? renderExpandedBody(onCloseMobile) : renderMinimizedBody(onToggleMobileExpand)}
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* 9. Shortlist Preview Modal for WhatsApp Sharing */}
      <ShortlistPreviewModal
        open={sharePreviewOpen}
        onClose={() => setSharePreviewOpen(false)}
        selectedPlots={[selectedShortlistPlot]}
        urls={shareUrls}
        onConfirmShare={handleConfirmShare}
        sharing={shareLoading}
      />

      {/* 10. Plots With Pulse ("See What Others Are Viewing") Modal Popup */}
      {pulseModalOpen && portalReady
        ? createPortal(
            <div
              className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm ila-modal-backdrop animate-in fade-in duration-200"
              onClick={() => setPulseModalOpen(false)}
            >
              <div
                className="relative flex w-full sm:max-w-5xl max-h-[92vh] flex-col rounded-t-3xl sm:rounded-2xl border-t border-x-0 sm:border border-white/15 bg-[#17191d] text-[#f2f0ea] shadow-2xl overflow-hidden ila-modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 bg-[#1a1c21]">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c6a46c]/20 text-[#c6a46c]">
                      <EyeIcon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        See What Others Are Viewing
                      </h3>
                      <p className="text-xs text-[#9a9388]">
                        Trending properties, live buyer pulse &amp; market activity
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close trending properties"
                    title="Close"
                    onClick={() => setPulseModalOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c6a46c]/50 bg-[#c6a46c]/20 text-[#c6a46c] shadow-md transition hover:bg-[#c6a46c] hover:text-[#17191d] hover:border-[#c6a46c] active:scale-95"
                  >
                    <CloseIcon className="h-4.5 w-4.5 stroke-[2.5]" />
                  </button>
                </div>

                {/* Modal Body: PlotsWithPulse component */}
                <div className="flex-1 overflow-y-auto">
                  <PlotsWithPulse />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* 11. "Next step" Site Visit Booking Modal Popup */}
      {siteVisitModalOpen && portalReady
        ? createPortal(
            <div
              className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm ila-modal-backdrop animate-in fade-in duration-200"
              onClick={() => setSiteVisitModalOpen(false)}
            >
              <div
                className="relative flex w-full sm:max-w-4xl max-h-[92vh] flex-col rounded-t-3xl sm:rounded-2xl border-t border-x-0 sm:border border-white/15 bg-[#17191d] text-[#f2f0ea] shadow-2xl overflow-hidden ila-modal-content"
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
                        Book a Site Visit
                      </h3>
                      <p className="text-xs text-[#9a9388]">
                        Next step &middot; {propertyName}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close site visit booking"
                    title="Close"
                    onClick={() => setSiteVisitModalOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c6a46c]/50 bg-[#c6a46c]/20 text-[#c6a46c] shadow-md transition hover:bg-[#c6a46c] hover:text-[#17191d] hover:border-[#c6a46c] active:scale-95"
                  >
                    <CloseIcon className="h-4.5 w-4.5 stroke-[2.5]" />
                  </button>
                </div>

                {/* Modal Body: HomeReadyToVisit ("Next step") component */}
                <div className="flex-1 overflow-y-auto">
                  <HomeReadyToVisit
                    propertyName={propertyName}
                    propertyId={activePropertyId}
                    onSuccess={() => setSiteVisitModalOpen(false)}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
