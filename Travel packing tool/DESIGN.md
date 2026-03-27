# Design System — Packwise

## Product Context
- **What this is:** AI-powered trip packing list generator — describe your trip in natural language, get a day-by-day outfit calendar and smart packing list.
- **Who it's for:** Individual travelers (business, leisure, mixed) who want to think less about packing. Users provide trip context via chat; the AI personalizes recommendations.
- **Space/industry:** Travel tech / personal productivity. Adjacent to PackPoint, TripIt, Packr.
- **Project type:** Hybrid — chat-first marketing landing page + dashboard/web app working view.

## Aesthetic Direction
- **Direction:** Warm Naturalism — parchment, forest, espresso. Packing as craft, not chore.
- **Decoration level:** Intentional — warm background and card structure do the work. No decorative blobs, no noise, no gradients as wallpaper.
- **Mood:** Calm and authoritative, like a well-organized travel journal. Users should feel like they're getting curated recommendations, not filling out a form.
- **Key risk that defines the brand:** Instrument Serif at large display sizes. Most packing apps are all-sans. This makes Packwise feel like a curated travel guide. The second risk: parchment background (#F9F6EF) instead of clinical white — tactile and distinctive.

## Typography
- **Display / Hero / Wordmark:** Instrument Serif — creates warmth, editorial authority, emotional resonance. Used for hero headlines, page titles, date labels in the calendar.
- **Body / UI / Labels / Buttons:** DM Sans — clean, readable, functional. Used for everything interactive: buttons, body text, pills, input fields, chat, metadata.
- **Data / Tables:** DM Sans with `font-variant-numeric: tabular-nums` — ensures alignment in packing item quantities, dates, counts.
- **Loading:** Google Fonts CDN — `https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap`
- **Scale:**
  - Hero: clamp(42px, 6vw, 64px) / Instrument Serif
  - H1: 36px / Instrument Serif
  - H2: 28px / Instrument Serif
  - H3: 22px / Instrument Serif
  - Body: 15px / DM Sans 400
  - UI / Button: 12–13px / DM Sans 500–600
  - Small / Label: 11px / DM Sans 400
  - Caption / Row label: 9–10px / DM Sans 600, uppercase, letter-spacing: 0.08em

## Color

All colors are warm-toned. No cold grays, no blue-white, no clinical surfaces.

- **Approach:** Balanced — forest green as the single accent, warm neutrals for everything else.

### Base Tokens
```css
--bg:        #F9F6EF;   /* Parchment — page background */
--surface:   #FFFDF8;   /* Ivory — cards, panels, elevated surfaces */
--text:      #2C2416;   /* Espresso — primary text */
--muted:     #8B7355;   /* Toffee — secondary text, nav links, metadata */
--faint:     #B8A48A;   /* Sand — disabled, tertiary, placeholder text */
--border:    #E8DFC8;   /* Warm beige — all borders and dividers */
--accent:    #4A6741;   /* Forest green — brand primary, interactive elements */
--accent-lt: #EBF0E8;   /* Pale sage — accent backgrounds, tinted surfaces */
--accent-dk: #3A5432;   /* Deep forest — chat card background, primary CTAs */
```

### Semantic Tokens
```css
--success:    #2D6A4F;  --success-lt: #D8F3DC;
--warning:    #92400E;  --warning-lt: #FEF3C7;
--error:      #991B1B;  --error-lt:   #FEE2E2;
--info:       #1E3A8A;  --info-lt:    #DBEAFE;
```

### Outfit Category Pills
```css
/* Formal */      background: #DBEAFE; color: #1E3A8A;
/* Business */    background: #FEF3C7; color: #92400E;
/* Casual */      background: #EDE8F5; color: #5C4D8A;
/* Transit */     background: #EDEBE7; color: #7A7062;
/* Activewear */  background: #FCE8D5; color: #7A3E1A;
```

### Dark Mode Strategy
Reduce saturation 10–20%, invert surface/background hierarchy, keep green accent visible.
```css
[data-theme="dark"] {
  --bg:        #1C1A15;
  --surface:   #242018;
  --text:      #EDE6D5;
  --muted:     #9C8E78;
  --faint:     #5C5242;
  --border:    #3A3528;
  --accent:    #6B9962;
  --accent-lt: #1E2A1B;
  --accent-dk: #4A6741;
}
```

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — the packing list is data-dense; surrounding chrome (masthead, section headers) breathes generously.
- **Scale:**
  ```
  2xs: 2px   xs: 4px    sm: 8px    md: 16px
  lg: 24px   xl: 32px   2xl: 48px  3xl: 64px
  ```
- **Primary workhorse values:** 8px (tight internal padding), 16px (standard component padding), 24px (section padding), 32px (section gap).

## Layout
- **Approach:** Hybrid — grid-disciplined for the working view, editorial for the landing page.
- **Working view:** Fixed masthead → horizontal split: calendar (flex: 1) + panel (fixed 310px, resizable 240–460px).
- **Panel internal layout:** Trip summary (fixed top, collapsible) → packing list (flex: 1, scrollable) → chat card (fixed bottom). Packing list ALWAYS gets the most space.
- **Landing page:** Single centered column, max-width 640px for the hero chat box. Full-width nav.
- **Mobile working view:** Read-only packing list (full-width, scrollable) + chat. No calendar grid on mobile. Touch targets minimum 44px.
- **Calendar grid:** `grid-template-columns: 72px repeat(N, 1fr)` where N is trip days (1–7). For trips over 7 days, horizontal scroll.
- **Border radius scale:**
  ```
  sm: 4px   md: 6px   lg: 10px   xl: 14px   full: 9999px
  ```

## Motion
- **Approach:** Intentional — three motion patterns only. Nothing decorative.
- **Easing:** enter `cubic-bezier(0.0, 0.0, 0.2, 1)` / exit `cubic-bezier(0.4, 0.0, 1, 1)` / move `cubic-bezier(0.4, 0.0, 0.2, 1)`
- **Duration:** micro 80ms / short 200ms / medium 320ms / long 500ms

### The Three Motion Patterns
1. **Skeleton shimmer** — loading state for AI-driven actions (regenerate, new outfit). Replace affected rows with a shimmering placeholder: `background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)` animated at 1.4s ease-in-out infinite.
2. **Typing indicator** — chat response in progress. Three dots, bounce animation, staggered 150ms each, up 6px.
3. **Entrance** — cards and new content enter via `opacity: 0 → 1, translateY(8px) → 0` at 200ms ease-out.

## Interaction Design Decisions
*(From /plan-design-review — 2026-03-26)*

- **Chat empty state:** 3 suggested follow-up chips pre-populated when user first arrives on working view (e.g., "More casual Thursday", "Add dinner Friday", "Gym Saturday"). Shows users what the AI can do.
- **Plan generation transition:** Full-screen animated screen between landing and working view, showing destination name, dates, and a progress bar. Replaces instant cut.
- **Destructive actions (Regenerate Plan / New Plan):** Confirmation dialog required. After confirmation, 10-second undo toast appears.
- **Gender/preference chip:** User provides this in the initial chat (explicit). The chip in the masthead must be editable and have a clear source — it should never appear unexplained.
- **Calendar max length:** 1–7 days render as columns. Beyond 7 days, horizontal scroll.
- **Panel priority on short screens:** Trip summary collapses to a thin bar. Chat anchored to bottom. Packing list gets all remaining space.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Initial design system created via /design-consultation | Formalized tokens implicit in packwise-working-v6.html and packwise-landing-v4.html |
| 2026-03-26 | Instrument Serif + DM Sans pairing confirmed | Intentional risk: editorial warmth vs. all-sans utility tools in category |
| 2026-03-26 | Parchment background (#F9F6EF) confirmed | Intentional risk: warm vs. clinical white; tactile and distinctive |
| 2026-03-26 | Forest green (#4A6741) as single accent | Connects to travel/outdoors; distinctive vs. default blue SaaS |
| 2026-03-26 | 9 interaction design decisions added | From /plan-design-review — see Interaction Design Decisions section |
