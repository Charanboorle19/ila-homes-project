# Property Enquiry Form feature

## Scope and terminology

There is no standalone enquiry form component. The form is the `<form className="pd-form">` block inside the `PropertyFinalCta` client component:

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyFinalCta.tsx`

It renders in the "Next step / Ready to explore {property.name}?" section at the end of the Property Details page. This document describes that form only. The separate WhatsApp and mailto enquiry links elsewhere on the page, and the tracked share feature, are documented in `property-details.md`, `property-enquiry.md`, and §37a/§37b of `property-details.md` respectively.

## 1. Feature purpose

The form collects a visitor's name, phone number, and an optional description for a specific property, so the sales team can call back with availability and a site-visit slot. It replaced the section's previous enquiry links with a structured, validated capture surface.

It is a client component. It owns its own field state, validation, and reset behavior, and receives the property as a `PropertyRecord` prop.

## 2. Where it appears

The form is rendered by `PropertyFinalCta`, which is composed by `PropertyPageView`. Because both property routes render the same `PropertyPageView`, the form appears identically on:

| Route | Resolves via |
|---|---|
| `/properties/{propertyId}` | static catalogue, or `ApiPropertyView` for an API UUID |
| `/property/{trackingToken}/view` | `GET /api/shares/{tracking_token}`, then `ApiPropertyView` |

There is no separate form route, no form-specific page, and no second implementation of this form. It is a single block of markup inside `PropertyFinalCta`.

## 3. Section structure

The enclosing section is `<section className="pd-section pd-final" aria-labelledby="pd-final-title">`. In order:

1. `<p class="pd-kicker">Next step</p>`
2. `<h2 id="pd-final-title">Ready to explore {property.name}?</h2>`
3. `<p class="pd-section__lead">` — "Leave your details and our team will call you back with availability. You can also pick a preferred slot and book a site visit directly."
4. **The enquiry form** (this document)
5. `.pd-final__toggles` — `Save to wishlist` and `Share property` chips
6. `.pd-final__share-note` — the share status line
7. `.pd-final__quote` — the testimonial blockquote, when `property.testimonial` exists

## 4. Form fields

Four fields, in this order. Fields 3 and 4 are full width; field 4 is only rendered when booking is available:

| # | Field | `name` | Control | Required | Validation |
|---|---|---|---|---|---|
| 1 | Name | `name` | `<input type="text">` | Yes | Non-empty after `trim()` |
| 2 | Phone number | `phone` | `<input type="tel">` | Yes | 10–15 digits |
| 3 | Description | `description` | `<textarea rows={3}>` | **No** | None |
| 4 | Preferred visit date & time | `scheduledAt` | `<input type="datetime-local">` | Only for booking | Must parse and be in the future |

### Name

`autoComplete="name"`. Rendered inside `.pd-form__row` alongside the phone field. Label text is exactly `Name`.

### Phone number

- `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`
- `placeholder="+91 98765 43210"`
- Validated by `isValidPhone`, which strips every non-digit character with `replace(/\D/g, "")` and accepts a length of 10 to 15 inclusive. Spaces, dashes, brackets, spaces and a leading `+country` code are therefore tolerated, so `+91 98765 43210` passes.
- Label text is exactly `Phone number`.

### Description

- A 3-row `textarea` with `resize: vertical`, spanning the full form width via `.pd-form__field--wide`.
- **Placed last on purpose**, so the two required fields are answered before the optional one.
- Marked optional two ways: an inline `<span class="pd-form__hint">Optional</span>` inside the label row, and a hint paragraph below the control with `id={`${descriptionId}-hint`}`, referenced by `aria-describedby`. The hint reads "Anything you add helps us shortlist the right plots."
- `placeholder="Tell us what you are looking for — plot size, facing, budget, timeline."`
- Never validated. An empty value is submitted as `null`, not as an empty string. For a site-visit booking it is also sent as `notes`.

### Preferred visit date & time

- A `datetime-local` input, rendered only when booking is available — see §7.
- Label text is exactly `Preferred visit date & time`, with **no** inline `Optional` marker, unlike the description.
- Its hint paragraph reads: "Pick a slot to book a visit, or leave it empty and we will call you back. Your local time, confirmed by phone." This states both outcomes rather than claiming the field is optional, because an empty value is fine for the callback but is rejected by the booking button.
- It is a normal `.pd-form__field--wide` inside `.pd-form`, positioned after the description and immediately before `.pd-form__submit`, so it reads as a field of the same form rather than as an optional extra panel.

## 5. Validation

The `<form>` sets `noValidate`, so the browser's own bubbles are suppressed and every message comes from the component. This keeps wording consistent with the rest of the page and avoids locale-dependent browser text.

`validate()` returns an `EnquiryErrors` object (`Partial<Record<keyof EnquiryFields, string>>`):

| Field | Condition | Message |
|---|---|---|
| `name` | `!fields.name.trim()` | `Please enter your name.` |
| `phone` | `!fields.phone.trim()` | `Please enter your phone number.` |
| `phone` | fails `isValidPhone` | `Please enter a valid phone number.` |
| `description` | never | — |

Validation runs on submit only, not while typing.

### Error clearing

`update(key)` clears that field's error as soon as the field is edited:

```ts
setErrors((current) =>
  current[key] ? { ...current, [key]: undefined } : current,
);
```

A visitor who fixes a field does not have to resubmit to learn that it is now valid.

## 6. Submit behavior

`submitEnquiry` calls `event.preventDefault()`, runs `validate()`, and writes the result to `errors`.

- **If any error exists:** `status` returns to `idle`, `statusMessage` is cleared, and the handler returns. No request is made.
- **If valid:** `status` becomes `submitting` and `createPublicLead` is called.

### Endpoint

```text
POST /api/leads
Content-Type: application/json
X-Visitor-Code: {visitor_code}
```

Served by `createPublicLead` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\leadsService.ts`, through `apiFetch`. The visitor code comes from the `visitor_code` cookie via `whenVisitorReady()`/`getVisitorCode()`, the same pattern as favourites and tracked shares. The backend applies `source = PUBLIC_FORM` and `status = NEW`; the client never sends `assigned_to`, because a public submission may not choose an assignee.

### Field mapping

The UI labels do not match the wire names:

| Form field | Wire field | Notes |
|---|---|---|
| Name | `name` | Required, 1–255 chars, trimmed |
| Phone number | `mobile` | Required, 5–20 chars, trimmed. The UI says "Phone number"; the API calls it `mobile` |
| Description | `message` | Optional. Empty becomes `null`, never `""` |
| — | `email` | Always `null`. There is no email field in the form |
| — | `property_id` | `property.id` **only when `isPropertyUuid(property.id)`**, otherwise `null` |
| — | `unit_id` | Always `null`; there is no unit selection in this form |
| — | `metadata` | `{ form_name: "property_enquiry", page_url, property_name }` |

`property_id` is deliberately not sent for local catalogue records: their ids are slugs, and the endpoint answers `404 PROPERTY_NOT_FOUND` for an id that is not an active property.

### Success

`apiFetch` throws on any non-2xx response, and the endpoint answers `201 Created`, so reaching the success branch means the backend accepted the lead. `status` becomes `sent`, the message is "Thank you. Our team will contact you shortly about availability and a site visit.", and the form resets to `EMPTY`.

### Failure

`status` becomes `error` and **the draft is preserved**, so a visitor whose request failed does not retype it. The message is:

- `RATE_LIMIT_EXCEEDED` → "Too many requests just now. Please try again in a few minutes."
- any other `Error` → its `message`, which for `ApiError` is the backend's `error.message`
- non-`Error` throw → "We could not send your enquiry. Please try again."

The rate-limit case is special-cased because the backend's own message is written for the API consumer, not for a visitor. Other backend messages, such as `VALIDATION_ERROR` and `INVALID_MOBILE`, are shown as-is.

Only `--status == "sent"` is styled as good news, so a failure cannot be mistaken for a receipt. An aborted request returns without setting any status.

### Duplicate submission

The submit button is `disabled` and `aria-busy` while `status === "submitting"`, so a slow response or a double tap cannot create two leads. Its label cycles `Request a callback` → `Sending…` → `Enquiry sent`.

### Credentials

The endpoint guide also recommends `credentials: "include"` so the `visitor_code` cookie reaches the API. `apiFetch` does not expose a `credentials` option and sends none, so this client relies on the explicit `X-Visitor-Code` header only — the same as every other visitor-scoped call in the application (`favoritesService`, `shareService`, sessions, analytics). If cookie-based identification turns out to be required by `/api/leads`, `apiFetch` must gain a `credentials` option; see §13.

## 7. Site-visit booking

Alongside the callback, the form offers a direct booking. It posts to `POST /api/site-visits` through `bookPublicSiteVisit` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\siteVisitsService.ts`.

```text
POST /api/site-visits
Content-Type: application/json
X-Visitor-Code: {visitor_code}   // optional, sent when one exists
```

```ts
{
  property_id: property.id,          // required, must be an active UUID
  unit_id: null,
  scheduled_at: chosen.toISOString(), // ISO 8601, must be in the future
  visitor: { name, mobile, email: null },
  notes: fields.description || null, // the optional description doubles as notes
}
```

### Availability

`property_id` is **required** by this endpoint and cannot be omitted, unlike the lead's optional `property_id`. The whole booking row — the datetime control and the button — is therefore rendered only when `isPropertyUuid(property.id)`. Local catalogue properties, whose ids are slugs, show the callback path only.

### Slot control

A `datetime-local` input named `scheduledAt`, shown only when booking is available.

- `min` is set by `earliestVisitLocal()`, which subtracts the local timezone offset before slicing to `YYYY-MM-DDTHH:mm`. Without that subtraction the browser would be handed a UTC string, read it back as local time, and allow a slot that had already passed.
- The hint reads "Pick a slot to book a visit, or leave it empty and we will call you back. Your local time, confirmed by phone." It deliberately avoids an `Optional` marker: an empty value is acceptable for the callback but rejected by the booking button, so a plain "Optional" label would contradict the button below it.
- The value is converted with `toISOString()` before sending, as the endpoint requires an ISO 8601 datetime.
- `min` is only a convenience. `submitSiteVisit` re-checks that the parsed date is valid **and** later than `Date.now()`, because the backend rejects a past slot regardless.

### Validation and states

`submitSiteVisit` runs `validate()` first, then requires the slot.

**Name and phone are not reported through `visitError`.** The only messages `visitError` can carry are about the slot itself. When name or phone is invalid, `submitSiteVisit` calls `setErrors(found)` and then focuses the first offending input via `document.getElementById(nameId | phoneId)`, and returns.

The focus is load-bearing, not decoration. The booking button sits at the very bottom of a long page, so a field-level error scrolled far above it is easy to miss — and a handler that returns without any visible result is indistinguishable from a dead button. Focusing the input scrolls it into view and makes the red border obvious, without reintroducing a combined message under the date picker. An earlier version of this path also cleared `visitError` on the way out; that was removed, because it discarded an unfixed slot error and made the failure even less visible.

Failures set `visitError`, which is rendered under the control and wired with `aria-invalid` and `aria-describedby`:

| Condition | Where the message appears |
|---|---|
| Name or phone invalid | On the name / phone inputs, via `errors`, plus focus moves to the first bad one. Not `visitError`, which is left untouched |
| No slot chosen, or unparseable | `visitError`: `Please choose a preferred date and time.` |
| Slot not in the future | `visitError`: `Please choose a time in the future.` |

On success, `visitStatus` becomes `sent` and the message names the property and the confirmed slot, formatted with `toLocaleString` from the endpoint's returned `scheduled_at`. Failure uses the backend's `error.message`, or "We could not book the site visit. Please try again." The button is `disabled` with `aria-busy` while in flight and cycles `Schedule site visit` → `Booking…` → `Visit requested`.

### Booking and the callback are alternatives, not steps

`POST /api/site-visits` creates or reuses the visitor profile, **reuses their existing lead for that property instead of creating a duplicate**, and creates a lead with `source = PUBLIC_FORM` and `status = SITE_VISIT` only when none exists. A visitor who books a visit therefore never ends up with two leads. The two buttons are therefore rendered as separate paths with their own independent status and message state, and the form explains this: "You can also pick a preferred slot and book a site visit directly."

`X-Visitor-Code` is optional for this endpoint — when omitted the API identifies or creates the visitor from the submitted name and mobile — so `bookPublicSiteVisit` sends it only when one already exists rather than awaiting visitor readiness as a precondition.

### Error codes

`SITE_VISIT_ERROR_CODES` records `VALIDATION_ERROR`, `PROPERTY_NOT_FOUND` and `TENANT_ID_MISSING`. Only the property-UUID gate and the future-date check are handled client-side; every other backend message is surfaced verbatim, and `apiFetch` converts the response into `ApiError` carrying `status`, `code` and `message`.

## 7a. Accessibility

- Each control has a real `<label htmlFor>`; ids come from `useId` (`nameId`, `phoneId`, `descriptionId`), so they cannot collide if the component ever renders more than once.
- Invalid fields set `aria-invalid={Boolean(errors.x)}` and point at their error text with `aria-describedby={errors.x ? `${id}-error` : undefined}`. The error `<p>` carries the matching `id`.
- The success/error note uses `role="status"` so it is announced without stealing focus.
- The submit button exposes `aria-busy` while the request is in flight.
- The textarea's hint is permanently associated through `aria-describedby={`${descriptionId}-hint`}`.
- Focus is visible: `:focus` on an input switches the border to `--pd-gold` and adds a 3px translucent gold ring. `outline: none` is set only alongside that replacement ring.
- Invalid fields get a red border, with a red-tinted focus ring instead of the gold one.
- The submit control is a real `<button type="submit">`, so Enter submits from any field.

## 7b. Reset behavior

Three effects:

1. **On mount / `property.id` change:** read `ila-wishlist-{property.id}` from `localStorage` into `wishlist`. Wrapped in `try/catch` because storage throws in private mode and blocked-cookie contexts.
2. **On `property.id` change:** clear `fields` to `EMPTY`, clear `errors`, and reset `status`/`statusMessage`/`visitStatus`/`visitMessage`/`visitError`. A draft typed against one property must never be carried into another, and its error messages and submission outcomes are stale once the property changes.
3. **On a successful submit only:** `fields` is cleared. A failed submit deliberately keeps the draft, including the chosen slot.

`errors` is deliberately **not** cleared by the first effect, so switching property does not reveal errors for an untouched form.

## 7c. Responsive behavior

`.pd-form__row` is a single-column grid by default and becomes two equal columns at `min-width: 760px`, matching the breakpoint already used by the rest of the stylesheet. The description and the visit-slot control always span the full width regardless of breakpoint.

`.pd-form__submit` is a wrapping flex row, so on a narrow screen the `Schedule site visit` button drops beneath `Request a callback` instead of being crushed beside it.

## 7d. Styling

All classes live in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css`.

| Class | Role |
|---|---|
| `.pd-form` | Panel: `margin-top`, padding, `1px solid var(--pd-line)` border, `0.9rem` radius, `rgba(244, 241, 234, 0.5)` surface, two-layer shadow |
| `.pd-form__row` | Two-column grid for the required fields, from `760px` |
| `.pd-form__field` | Flex column: label, control, error |
| `.pd-form__field--wide` | Full-width field, used by the description and the visit-slot control |
| `.pd-form__label` | Uppercase `0.74rem` label, `0.12em` tracking |
| `.pd-form__hint` | Secondary text for the `Optional` marker, the description hint and the visit-slot hint |
| `.pd-form__input` | Shared control styling for `input` and `textarea` |
| `.pd-form__textarea` | `min-height: 5.5rem`, `resize: vertical` |
| `.pd-form__error` | `#a3352b`, `0.78rem` |
| `.pd-form__submit` | Wrapping button row, holding `Request a callback` and `Schedule site visit` |
| `.pd-form__status` | Submission outcome box; `--sent` is green-tinted, `--error` is red-tinted |

There is no `.pd-form__visit` class. The booking control is not a separate block: the slot picker is an ordinary `.pd-form__field--wide` inside `.pd-form` and the button is the second child of `.pd-form__submit`. A dedicated wrapper, and the hairline `border-top` that separated it from the callback button, were both removed when the slot moved into the form body — the visitor reads one form with two submission buttons, not one form plus an optional extra panel.

The form uses only the tokens already defined on `.property-page` (`--pd-ink`, `--pd-muted`, `--pd-soft`, `--pd-surface`, `--pd-line`, `--pd-gold`) and the same two-layer shadow (`0 1px 2px rgba(23,23,23,0.04), 0 10px 28px rgba(23,23,23,0.05)`) used by the other lifted surfaces in the stylesheet. The buttons reuse the existing `.pd-btn`, `.pd-btn--primary` and `.pd-btn--ghost` classes; no new button styling was introduced.

## 8. Related controls in the same section

These sit outside the `<form>` but inside the same section:

- **`Save to wishlist`** — a `pd-chip` toggle writing `ila-wishlist-{id}` as `"1"`/`"0"` in `localStorage`. Carries `data-track="PROPERTY_FAVORITE"`.
- **`Share property`** — a `pd-chip` button using the Web Share API, falling back to `navigator.clipboard.writeText(window.location.href)`. It never opens a chat app; there is no `whatsappUrl` fallback in that path. `AbortError` from a dismissed share sheet is treated as a deliberate "no" and returns without a note. Carries `data-track="PROPERTY_SHARE"`.

Both enquiry paths are inside the `<form>` and share its fields:

```
[ Name ]                        [ Phone ]
[ Description                                    (optional) ]
[ Preferred visit date & time                     (canBookVisit) ]
[ Request a callback ]  [ Schedule site visit ]   (canBookVisit)
```

The booking button is the second child of the existing `.pd-form__submit` row, so the two read as alternatives. The slot picker sits directly above that row as a normal `.pd-form__field--wide` — not in its own panel — because it reuses the name and phone entered above it and is meaningless without them.

## 9. Controls removed from this section

The section previously rendered three enquiry controls that no longer exist:

| Removed | Notes |
|---|---|
| `WhatsApp enquiry` | Primary `whatsappUrl` link |
| `Email site visit` | `siteVisitMailto` mailto link; the `siteVisitMailto` import was removed with it |
| `I'm interested` | Chip writing `ila-interested-{id}` |

A fourth was removed later: the `WhatsApp site visit` ghost link inside `.pd-form__submit`. It was replaced by the `Schedule site visit` button, which calls `POST /api/site-visits` (§7). `whatsappUrl` and `waVisitText` were consequently dropped from this component; `PropertyHero` and `StickyBottomCta` still use them.

Because the interested chip is gone, `PropertyFinalCta` no longer reads or writes `ila-interested-{id}`, and `storageKey` was narrowed from `"wishlist" | "interested"` to `"wishlist"` only. Values already in a visitor's `localStorage` under the old key are left untouched and simply ignored.

`.pd-final__actions` was also removed from the stylesheet, because the only markup that used it — the old CTA button group — is gone.

## 9a. State

| State | Type | Purpose |
|---|---|---|
| `wishlist` | boolean | Wishlist chip state, persisted to `localStorage` |
| `shareNote` | string | Outcome of the `Share property` chip |
| `fields` | `EnquiryFields` | `name`, `phone`, `description`, `scheduledAt` |
| `errors` | `EnquiryErrors` | Per-field validation errors |
| `status` | `"idle" \| "submitting" \| "sent" \| "error"` | Callback/lead submission |
| `statusMessage` | string | Callback outcome text |
| `visitStatus` | `"idle" \| "submitting" \| "sent" \| "error"` | Site-visit submission, independent of `status` |
| `visitMessage` | string | Booking outcome text |
| `visitError` | `string \| null` | Pre-flight booking problem: missing name/phone, missing or past slot |

`canBookVisit` (derived from `isPropertyUuid`) and `minVisitAt` (derived from `earliestVisitLocal()`) are computed per render, not held in state.

## 10. Analytics

The form emits no analytics event. `ENQUIRY_SUBMIT` and `SITE_VISIT_REQUEST` exist in the event vocabulary but are both explicitly blocked by the tracker as not permitted from the public API, so both submissions are recorded server-side by `POST /api/leads` and `POST /api/site-visits` instead.

Neither the `Request a callback` button nor the `Schedule site visit` button carries `data-track` attributes; the previous `ENQUIRY_CLICK` attribute went with the removed WhatsApp link. The `Save to wishlist` and `Share property` chips carry `PROPERTY_FAVORITE` and `PROPERTY_SHARE` with `button_location: "property_final_cta"`.

## 11. Exact file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyFinalCta.tsx` — the component, `EnquiryFields`, `EnquiryErrors`, `EMPTY`, `earliestVisitLocal`, `isValidPhone`, `update`, `validate`, `submitEnquiry`, `submitSiteVisit`, `toggle`, and `share`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\leadsService.ts` — `createPublicLead`, `CreatePublicLeadRequest`, `Lead`, and `LEAD_ERROR_CODES`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\siteVisitsService.ts` — `bookPublicSiteVisit`, `BookPublicSiteVisitRequest`, `SiteVisit`, and `SITE_VISIT_ERROR_CODES`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\apiClient.ts` — `apiFetch` and `ApiError`, used for both requests and for reading the backend's `error.code`/`error.message`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — `isPropertyUuid`, which gates the booking row and decides whether a lead's `property_id` may be sent.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — every `.pd-form*` rule plus the `760px` breakpoint that makes `.pd-form__row` two columns.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — composes the section into the page.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` — the `PropertyRecord` prop type.

## 12. Related documentation

- `docs/features/property-details.md` — the whole Property Details page, including §37 for the enquiry/WhatsApp CTAs and §37a/§37b for the tracked share link and the `/property/{trackingToken}/view` route.
- `docs/features/property-enquiry.md` — the enquiry and WhatsApp behaviour of the hero, final CTA, and sticky CTA. This document supersedes its description of the final CTA's enquiry links.
- `docs/architecture/api.md` — API architecture, including the `POST /api/leads` and `POST /api/site-visits` entries and the constraints recorded there.

## 13. Known issues

- `apiFetch` sends no `credentials`, so the `visitor_code` cookie is not sent to `/api/leads`; identification relies entirely on the `X-Visitor-Code` header. Every other visitor-scoped call in the application works this way, but if this endpoint specifically requires the cookie, `apiFetch` must gain a `credentials` option.
- There is no client-side honeypot, CAPTCHA, or debounce beyond disabling the buttons. The backend rate limit (`RATE_LIMIT_EXCEEDED`) is the only spam defence on the lead path; `/api/site-visits` lists no rate-limit code at all.
- The two paths can both be used in one visit. Each has independent state, so a visitor could book a slot and also request a callback. Nothing prevents that.
- The booking control is hidden entirely for local catalogue properties, so those visitors can only request a callback.
- `earliestVisitLocal()` is computed on every render rather than memoised. It is cheap, and it means `min` moves as time passes, which is the intended behaviour.
- Phone validation accepts 10–15 digits of any country and does not enforce a numbering plan, while the endpoint accepts 5–20 characters. Frontend and backend rules differ; the backend is authoritative and can reject what the form accepted.
- Backend messages are shown verbatim except for the rate-limit case. `VALIDATION_ERROR` and `INVALID_MOBILE` copy is written for API consumers and may read poorly to a visitor.
- There is no retry. A transient network failure requires the visitor to press submit again.
- A successful submission resets the form with no confirmation of what was sent; the visitor is not shown which property the lead was attached to, and `property_id` is silently omitted for local catalogue records.
- The form is not persisted between visits; a draft is lost on reload.
- No automated test coverage is confirmed; UNKNOWN — needs verification.

## 14. Important constraints

- Keep the field order: name, phone, then the optional description. The description is intentionally last so the two required answers come first.
- Keep `description` optional. It must never gain a validation rule without a deliberate decision.
- Keep `noValidate` and the custom `validate()` so error wording stays consistent with the page.
- Do not add `required` attributes to the inputs. They would reintroduce browser-native validation bubbles alongside the custom messages.
- Preserve `useId` for field ids rather than hardcoding them, so the markup stays safe if the form is ever rendered more than once.
- Preserve the reset-on-`property.id`-change effect. Carrying a draft across properties leaks one visitor's details into another's context.
- Keep the form inside `PropertyFinalCta` rather than extracting a new component, so it stays in the shared Property Detail UI and appears on both property routes.
- Do not emit `ENQUIRY_SUBMIT` or `SITE_VISIT_REQUEST`; the tracker rejects both. The submissions are recorded by `POST /api/leads` and `POST /api/site-visits`.
- Keep the callback and the booking as **independent alternatives**. `POST /api/site-visits` already creates or reuses the visitor's lead for the property, so chaining the two would create two interactions for one visitor.
- Route both submissions through `apiFetch` in `leadsService` / `siteVisitsService` so tenant and common headers stay consistent with every other request.
- Never send `assigned_to` to either endpoint. Public submissions may not choose an assignee.
- Send optional values as `null`, never as empty strings, and never send an empty UUID.
- Only send `property_id` when `isPropertyUuid(property.id)`. For the lead it becomes `null`; the booking row is not rendered at all, because `property_id` is required there.
- Convert `scheduled_at` with `toISOString()` from the `datetime-local` value, and keep the local-timezone correction in `earliestVisitLocal()`. Omitting either sends a slot that is hours off or already in the past.
- Only show a success message after the request resolves. `apiFetch` throws on non-2xx, so both success branches are unreachable unless the backend answered `201`.
- Preserve the disabled-while-submitting guards so one press cannot create two leads or two bookings.
- Preserve the drafts on failure; resetting would force a visitor to retype after a rejected request.
- Never log the visitor code, submission payload, or tokens.