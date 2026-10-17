"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  fetchFavorites,
  removeFavorite,
  type FavoriteItem,
} from "@/services/favoritesService";
import {
  fetchProperties,
  type PropertyListItem,
} from "@/services/propertiesService";
import { formatInr } from "@/lib/propertyUtils";
import { getPropertyById } from "@/data/properties";
import ShortlistPreviewModal from "@/components/ShortlistPreviewModal";
import type { ShortlistPlot } from "@/components/ShortlistShare";
import { createPropertyShares, buildShareUrl } from "@/services/shareService";
import familyCommunityImg from "@/app/assets/Family Dreams Over a New Community.png";

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function HeartIcon({ className = "", filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        d="M 50 85 L 20 54.5 A 20 20 0 0 1 48 24.8 L 50 27.2 L 52 24.8 A 20 20 0 0 1 80 54.5 Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function ArrowRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
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

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export type WishlistProps = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  className?: string;
};

/**
 * High-performance Wishlist slide-out popup:
 * - Slides from right to left, positioned at 50% height (h-[50vh] / max-h-[500px]) on the right side
 * - Hardware-accelerated transforms (transform-gpu, will-change-transform) with no heavy filter repaints
 * - Crisp warm ivory theme with instant responsiveness
 */
export default function Wishlist({
  isOpen,
  onOpen,
  onClose,
  className = "",
}: WishlistProps) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [propertyCatalog, setPropertyCatalog] = useState<Record<string, PropertyListItem>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      const [favItems, propsResult] = await Promise.all([
        fetchFavorites(),
        fetchProperties({ status: "ALL", page: 1, perPage: 100 }).catch(() => ({ items: [] })),
      ]);
      const catalogMap: Record<string, PropertyListItem> = {};
      for (const p of propsResult.items) {
        catalogMap[p.id] = p;
      }
      setPropertyCatalog(catalogMap);
      setFavorites(favItems || []);
    } catch (e) {
      console.warn("[Wishlist] could not load favorites", e);
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  // Fetch count on initial mount & listen to real-time updates from PropertyBlock / PropertiesList
  useEffect(() => {
    void loadFavorites();
    const handleUpdate = () => void loadFavorites();
    window.addEventListener("favorites-updated", handleUpdate);
    return () => {
      window.removeEventListener("favorites-updated", handleUpdate);
    };
  }, [loadFavorites]);

  // Refresh whenever opened
  useEffect(() => {
    if (isOpen) {
      void loadFavorites();
    }
  }, [isOpen, loadFavorites]);

  // Bulk Share Selection state
  const [isSelectingForShare, setIsSelectingForShare] = useState(false);
  const [selectedShareIds, setSelectedShareIds] = useState<string[]>([]);

  // Bulk Share Modal state
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);
  const [shareUrls, setShareUrls] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);

  // When clicking "Share", toggle into selection mode or prepare share
  const handleStartShareSelection = () => {
    if (!favorites.length) return;
    setIsSelectingForShare(true);
    // Pre-select all items by default for convenience
    setSelectedShareIds(favorites.map((f) => f.property_id));
  };

  const handleCancelShareSelection = () => {
    setIsSelectingForShare(false);
    setSelectedShareIds([]);
  };

  const toggleSelectShareId = (propertyId: string) => {
    setSelectedShareIds((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId],
    );
  };

  const handleBulkShare = async () => {
    const idsToShare = isSelectingForShare ? selectedShareIds : favorites.map((fav) => fav.property_id);
    if (!idsToShare.length || shareLoading) return;
    setShareLoading(true);

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    try {
      const shares = await createPropertyShares({
        entityIds: idsToShare,
        message: "Please review my shortlisted properties",
      });
      const generatedUrls = shares.map((share) =>
        buildShareUrl(share.tracking_token!, origin),
      );
      setShareUrls(
        generatedUrls.length > 0
          ? generatedUrls
          : idsToShare.map((id) => `${origin}/properties/${id}`),
      );
    } catch {
      setShareUrls(idsToShare.map((id) => `${origin}/properties/${id}`));
    } finally {
      setShareLoading(false);
      setSharePreviewOpen(true);
      setIsSelectingForShare(false);
    }
  };

  const handleConfirmShare = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const chosenFavorites = favorites.filter((fav) =>
      selectedShareIds.length > 0 ? selectedShareIds.includes(fav.property_id) : true,
    );

    const sections = chosenFavorites.map((fav, idx) => {
      const url = shareUrls[idx] || `${origin}/properties/${fav.property_id}`;
      const local = getPropertyById(fav.property_id);
      const loc = local?.location || "Prime Location, Hyderabad";
      const priceText = fav.price_from ? `from ${formatInr(fav.price_from)}` : "Price on request";
      return `*${fav.name}*\n📍 ${loc} · ${priceText}\n${url}`;
    });

    const text = [
      "🏡 *My Shortlisted Properties via ILA Homes*",
      "",
      sections.join("\n\n"),
      "",
      "Open the links to review layouts, pricing & financing details.",
    ].join("\n");

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSharePreviewOpen(false);
  };

  const chosenFavorites = favorites.filter((fav) =>
    selectedShareIds.length > 0 ? selectedShareIds.includes(fav.property_id) : true,
  );

  const shortlistPlots: ShortlistPlot[] = chosenFavorites.map((fav) => {
    const local = getPropertyById(fav.property_id);
    const cover = local?.gallery?.[0]?.src || "/hero-image.png";
    return {
      id: fav.property_id,
      name: fav.name,
      location: local?.location || "Prime Location, Hyderabad",
      meta: fav.price_from ? `From ${formatInr(fav.price_from)}` : "Price on request",
      highlight: local?.popupSample?.description || "Verified development listed on ILA Homes.",
      coverUrl: cover,
      image: familyCommunityImg,
    };
  });

  const handleRemoveFavorite = async (e: React.MouseEvent, propertyId: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await removeFavorite(propertyId);
      setFavorites((prev) => prev.filter((item) => item.property_id !== propertyId));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("favorites-updated"));
      }
    } catch (e) {
      console.warn("[Wishlist] remove favorite failed", e);
    }
  };

  const getCoverImage = (item: FavoriteItem): string => {
    if (item.cover_url) return item.cover_url;
    if (item.image_url) return item.image_url;
    const catProp = propertyCatalog[item.property_id];
    if (catProp?.cover_url) return catProp.cover_url;
    const local = getPropertyById(item.property_id);
    return local?.gallery?.[0]?.src || "/hero-image.png";
  };

  const drawerContent = (
    <div
      className={`fixed inset-0 z-[400] transition-opacity duration-200 ${
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!isOpen}
    >
      {/* Light, lightweight backdrop (avoids laggy full-screen blur during slide) */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* 50% height right-to-left floating panel */}
      <aside
        className={`pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 flex h-[52vh] min-h-[380px] max-h-[540px] w-full max-w-[380px] sm:max-w-[400px] flex-col overflow-hidden rounded-l-2xl border-y border-l border-[#ded9cf] bg-[#fbf9f4] shadow-[-12px_0_36px_rgba(0,0,0,0.22)] transform-gpu will-change-transform transition-transform duration-250 ease-out sm:mr-0 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Wishlist drawer"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e6e0d4] bg-white px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#faf4e4] text-[#a07c3c]">
              <HeartIcon className="h-4.5 w-4.5" filled />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-[#1a1917]">
                  Your Wishlist
                </h2>
                {favorites.length > 0 && (
                  <span className="rounded-full bg-[#1f8a68]/15 px-1.5 py-0.2 text-[10px] font-bold text-[#1f5c45]">
                    {favorites.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#7a7469]">
                {favorites.length === 0
                  ? "No saved properties"
                  : `${favorites.length} saved ${favorites.length === 1 ? "property" : "properties"}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {favorites.length > 0 && !isSelectingForShare && (
              <button
                type="button"
                aria-label="Share wishlist on WhatsApp"
                title="Select properties to share"
                onClick={handleStartShareSelection}
                disabled={shareLoading}
                className="flex h-8 items-center gap-1.5 rounded-xl border border-[#25D366]/40 bg-[#128C7E]/10 px-3 text-xs font-bold text-[#128C7E] shadow-xs transition hover:bg-[#25D366] hover:text-white hover:border-[#25D366] active:scale-95 disabled:opacity-50"
              >
                <ShareIcon className="h-4 w-4" />
                <span>Share</span>
              </button>
            )}

            {isSelectingForShare && (
              <button
                type="button"
                aria-label="Cancel share selection"
                onClick={handleCancelShareSelection}
                className="flex h-8 items-center rounded-xl border border-black/15 bg-white px-3 text-xs font-semibold text-[#5c5348] transition hover:bg-[#f0ece3] active:scale-95"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              aria-label="Close wishlist drawer"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/30 bg-red-50 text-red-600 shadow-xs transition hover:bg-red-600 hover:text-white hover:border-red-600 active:scale-95"
            >
              <CloseIcon className="h-4 w-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Selection mode indicator banner */}
        {isSelectingForShare && (
          <div className="flex items-center justify-between border-b border-[#e6e0d4] bg-[#faf4e4] px-4 py-2 text-[11px]">
            <span className="font-semibold text-[#8a6d34]">
              {selectedShareIds.length} of {favorites.length} selected to share
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedShareIds.length === favorites.length) {
                  setSelectedShareIds([]);
                } else {
                  setSelectedShareIds(favorites.map((f) => f.property_id));
                }
              }}
              className="font-bold text-[#171717] underline underline-offset-2 transition hover:text-[#8a6d34]"
            >
              {selectedShareIds.length === favorites.length ? "Deselect all" : "Select all"}
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="ila-scroll flex-1 overflow-y-auto overscroll-contain p-3.5">
          {favoritesLoading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c6a46c] border-t-transparent" />
              <p className="mt-2 text-[11px] font-medium text-[#7a7469]">Loading wishlist…</p>
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f0ece3] text-[#a07c3c]">
                <HeartIcon className="h-5 w-5" />
              </div>
              <h3 className="mt-2.5 text-sm font-bold tracking-tight text-[#1a1917]">
                Your wishlist is empty
              </h3>
              <p className="mt-1 max-w-[240px] text-[11px] text-[#7a7469]">
                Save developments by tapping the heart icon to easily compare later.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-xl bg-[#24231f] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white shadow-sm transition hover:bg-[#3a3832] active:scale-95"
              >
                Explore Properties
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {favorites.map((fav) => {
                const cover = getCoverImage(fav);
                const local = getPropertyById(fav.property_id);
                const catProp = propertyCatalog[fav.property_id];
                const locationText =
                  [catProp?.locality, catProp?.city].filter(Boolean).join(", ") ||
                  catProp?.address ||
                  local?.location ||
                  "Prime Location, Hyderabad";
                const isSelected = selectedShareIds.includes(fav.property_id);

                return (
                  <div
                    key={fav.property_id}
                    onClick={() => {
                      if (isSelectingForShare) {
                        toggleSelectShareId(fav.property_id);
                      }
                    }}
                    className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-xs transition ${
                      isSelectingForShare
                        ? isSelected
                          ? "cursor-pointer border-[#c6a46c] ring-1.5 ring-[#c6a46c] bg-[#fdfbf7]"
                          : "cursor-pointer border-[#e5ddcd] opacity-65 hover:opacity-100"
                        : "border-[#e5ddcd] hover:border-[#c6a46c]"
                    }`}
                  >
                    <div className="flex items-center gap-3 p-2.5">
                      {/* Checkbox indicator when in share selection mode */}
                      {isSelectingForShare && (
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                            isSelected
                              ? "border-[#c6a46c] bg-[#c6a46c] text-[#171717]"
                              : "border-[#ded9cf] bg-white text-transparent"
                          }`}
                        >
                          <CheckIcon className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}

                      {/* Compact Thumbnail */}
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#e8e4dc]">
                        <Image
                          src={cover}
                          alt={fav.name}
                          fill
                          sizes="56px"
                          unoptimized={cover.startsWith("http")}
                          className="object-cover"
                        />
                        <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1 py-0.2 text-[7px] font-bold uppercase tracking-wider text-white">
                          {fav.property_type || "PLOTS"}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-xs font-bold tracking-tight text-[#171717] group-hover:text-[#8a6d34]">
                          {fav.name}
                        </h4>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#7a7469]">
                          <PinIcon className="h-2.5 w-2.5 shrink-0 text-[#c6a46c]" />
                          <span className="truncate">{locationText}</span>
                        </p>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-[9px] font-semibold uppercase text-[#8a8174]">
                            From
                          </span>
                          <span className="text-xs font-bold text-[#1f5c45]">
                            {fav.price_from ? formatInr(fav.price_from) : "Price on request"}
                          </span>
                        </div>
                      </div>

                      {/* Remove Button (hidden while selecting for share) */}
                      {!isSelectingForShare && (
                        <button
                          type="button"
                          aria-label={`Remove ${fav.name} from wishlist`}
                          onClick={(e) => handleRemoveFavorite(e, fav.property_id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#9a9388] transition hover:bg-rose-50 hover:text-rose-600 active:scale-95"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Bottom CTA bar */}
                    <div className="flex items-center justify-between border-t border-[#f0ece3] bg-[#faf7f0] px-3 py-1.5">
                      <span className="text-[9px] font-medium text-[#7a7469]">
                        Verified & RERA Approved
                      </span>
                      <Link
                        href={`/properties/${fav.property_id}`}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8a6d34] transition hover:text-[#171717]"
                      >
                        <span>View Details</span>
                        <ArrowRightIcon className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Compact Footer */}
        {favorites.length > 0 && (
          <div className="flex items-center gap-2 border-t border-[#e6e0d4] bg-white p-3">
            {isSelectingForShare ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelShareSelection}
                  className="flex h-10 w-24 items-center justify-center rounded-xl border border-black/15 bg-white text-[11px] font-bold uppercase tracking-wider text-[#5c5348] transition hover:bg-[#f2ede4] active:scale-[0.99]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkShare}
                  disabled={selectedShareIds.length === 0 || shareLoading}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d4b57e] via-[#c6a46c] to-[#b38e52] py-2.5 text-[11px] font-bold tracking-wider uppercase text-[#171717] shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-40"
                >
                  <ShareIcon className="h-3.5 w-3.5" />
                  <span>
                    {shareLoading
                      ? "Preparing…"
                      : `Share (${selectedShareIds.length})`}
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleStartShareSelection}
                  disabled={shareLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#128C7E]/10 py-2.5 text-xs font-bold tracking-wider uppercase text-[#128C7E] shadow-xs transition hover:bg-[#25D366] hover:text-white hover:border-[#25D366] active:scale-[0.99] disabled:opacity-50"
                >
                  <ShareIcon className="h-4 w-4" />
                  <span>Share ({favorites.length})</span>
                </button>

                <Link
                  href="#contact"
                  onClick={onClose}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d4b57e] via-[#c6a46c] to-[#b38e52] py-2.5 text-[11px] font-bold tracking-wider uppercase text-[#171717] shadow-sm transition active:scale-[0.99] hover:brightness-105"
                >
                  <span>Enquire</span>
                  <ArrowRightIcon className="h-3 w-3" />
                </Link>
              </>
            )}
          </div>
        )}
      </aside>

      {/* Bulk WhatsApp Shortlist Preview Modal */}
      <ShortlistPreviewModal
        open={sharePreviewOpen}
        onClose={() => setSharePreviewOpen(false)}
        selectedPlots={shortlistPlots}
        urls={shareUrls}
        onConfirmShare={handleConfirmShare}
        sharing={shareLoading}
      />
    </div>
  );

  return (
    <>
      {/* Floating Wishlist Trigger Button */}
      <button
        type="button"
        aria-label="Saved properties wishlist"
        onClick={onOpen}
        className={`pointer-events-auto group relative flex items-center justify-start gap-2 rounded-full border border-white/15 bg-[#171717]/90 p-2.5 text-[#f2f0ea] shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all hover:border-[#c6a46c] hover:bg-[#222222] active:scale-95 sm:h-10 sm:w-36 sm:px-3 sm:py-2 ${className}`}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center text-[#c6a46c] transition-transform group-hover:scale-110">
          <HeartIcon className="h-6 w-6" />
        </div>
        <span className="hidden text-xs font-semibold tracking-wide sm:inline">
          Wishlist
        </span>
        {favorites.length > 0 ? (
          <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#c6a46c] px-1 text-[10px] font-bold text-[#171717]">
            {favorites.length}
          </span>
        ) : null}
      </button>

      {/* Portal to document.body for unobstructed right-to-left slide */}
      {mounted && typeof document !== "undefined"
        ? createPortal(drawerContent, document.body)
        : null}
    </>
  );
}
