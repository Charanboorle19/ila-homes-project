/**
 * Closed vocabulary of allowed event types.
 *
 * The backend validates against its own allow-list and returns
 * EVENT_TYPE_NOT_ALLOWED for anything not here. Keep names exactly as written.
 * Adding a name requires backend agreement first.
 */
export const EVENT_TYPES = [
  // Property events
  "PROPERTY_VIEW",
  "PROPERTY_SEARCH",
  "PROPERTY_FILTER",
  "PROPERTY_COMPARE",
  "PROPERTY_FAVORITE",
  "PROPERTY_SHARE",

  // Map and discovery
  "MAP_MARKER_CLICK",
  "MAP_ZOOM_REGION",

  // Persona and matching
  "PERSONA_SELECT",
  "PREFERENCE_TAG_SELECT",
  "MATCH_RESULT_VIEW",

  // Compare, shortlist and calculator
  "COMPARE_ADD",
  "COMPARE_REMOVE",
  "SHORTLIST_ADD",
  "SHORTLIST_REMOVE",
  "WHATSAPP_SHARE_CLICK",
  "EMI_CALCULATOR_USE",
  "EMI_PROPERTY_SELECT",

  // Conversion
  "ENQUIRY_CLICK",
  "ENQUIRY_SUBMIT",
  "SITE_VISIT_REQUEST",
  "TALK_TO_ILA_CLICK",
  "PHONE_CALL_CLICK",
  "WHATSAPP_CHAT_CLICK",
  "BROWSE_PROPERTIES_CLICK",

  // 3D guide
  "GUIDE_TOUR_COMPLETE",

  // Engagement and session
  "SESSION_START",
  "RETURN_VISIT",
  "PROPERTY_REVISIT",
  "TIME_ON_PROPERTY",
  "LIVE_ACTIVITY_CARD_CLICK",

  // Section-level tracking
  "SECTION_ENTER",
  "SECTION_EXIT",
  "SECTION_CLICK",
  "SESSION_SECTION_SUMMARY",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const ALLOWED = new Set<string>(EVENT_TYPES);

/**
 * Sections identified by data-section. Kept in one place so the dwell tracker
 * and the emitters cannot drift.
 */
export const SECTION_NAMES = [
  "hero_map",
  "who_we_are",
  "growth_corridors",
  "buyer_persona",
  "land_roadmap",
  "compare_plots",
  "shortlist_whatsapp",
  "emi_calculator",
  "live_activity",
  "trust_strip",
  "faq",
  "final_cta",
  "footer",
] as const;

export type SectionName = (typeof SECTION_NAMES)[number];

/** COMPARE requires metadata.property_ids with 2-5 ids (backend-enforced). */
export const COMPARE_MIN_IDS = 2;
export const COMPARE_MAX_IDS = 5;

/** A section seen for >= this long counts as viewed, not skimmed. */
export const VIEWED_THRESHOLD_SECONDS = 2;

export function isEventType(value: string): value is EventType {
  return ALLOWED.has(value);
}

/**
 * Event types the public /api/events/batch endpoint actually accepts.
 *
 * Verified one-by-one against the live backend. Six names above are recognised
 * but rejected on the batch endpoint:
 *   - ENQUIRY_SUBMIT, SITE_VISIT_REQUEST: not permitted from the public API
 *     (must be recorded server-side when the lead / visit is created).
 *   - SECTION_ENTER, SECTION_EXIT, SECTION_CLICK: not accepted on the public
 *     endpoint at all. Section engagement is captured via
 *     SESSION_SECTION_SUMMARY instead.
 *   - COMPARE_ADD: requires the same 2-5 id shape as PROPERTY_COMPARE, and is
 *     better expressed through PROPERTY_COMPARE.
 *
 * Anything not in this set is dropped client-side with a console warning so a
 * single bad event can never fail a whole batch.
 */
export const BATCH_SENDABLE_EVENTS = new Set<string>([
  "PROPERTY_VIEW",
  "PROPERTY_SEARCH",
  "PROPERTY_FILTER",
  "PROPERTY_COMPARE",
  "PROPERTY_FAVORITE",
  "PROPERTY_SHARE",
  "MAP_MARKER_CLICK",
  "MAP_ZOOM_REGION",
  "PERSONA_SELECT",
  "PREFERENCE_TAG_SELECT",
  "MATCH_RESULT_VIEW",
  "COMPARE_REMOVE",
  "SHORTLIST_ADD",
  "SHORTLIST_REMOVE",
  "WHATSAPP_SHARE_CLICK",
  "EMI_CALCULATOR_USE",
  "EMI_PROPERTY_SELECT",
  "ENQUIRY_CLICK",
  "TALK_TO_ILA_CLICK",
  "PHONE_CALL_CLICK",
  "WHATSAPP_CHAT_CLICK",
  "BROWSE_PROPERTIES_CLICK",
  "GUIDE_TOUR_COMPLETE",
  "SESSION_START",
  "RETURN_VISIT",
  "PROPERTY_REVISIT",
  "TIME_ON_PROPERTY",
  "LIVE_ACTIVITY_CARD_CLICK",
  "SESSION_SECTION_SUMMARY",
]);

export function isBatchSendable(value: string): boolean {
  return BATCH_SENDABLE_EVENTS.has(value);
}

export function isSectionName(value: string): value is SectionName {
  return (SECTION_NAMES as readonly string[]).includes(value);
}