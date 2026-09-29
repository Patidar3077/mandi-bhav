---
name: Earthy Agri-Trust
colors:
  surface: '#fff8f5'
  surface-dim: '#e8d7ca'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1e7'
  surface-container: '#fcebdd'
  surface-container-high: '#f7e5d8'
  surface-container-highest: '#f1dfd2'
  on-surface: '#221a12'
  on-surface-variant: '#414941'
  inverse-surface: '#382f26'
  inverse-on-surface: '#ffeee0'
  outline: '#717970'
  outline-variant: '#c1c9be'
  surface-tint: '#3a6844'
  primary: '#164525'
  on-primary: '#ffffff'
  primary-container: '#2f5d3a'
  on-primary-container: '#a1d4a8'
  inverse-primary: '#a0d3a7'
  secondary: '#7e5533'
  on-secondary: '#ffffff'
  secondary-container: '#fdc79c'
  on-secondary-container: '#79512f'
  tertiary: '#0e4616'
  on-tertiary: '#ffffff'
  tertiary-container: '#295e2b'
  on-tertiary-container: '#9bd696'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bbefc1'
  primary-fixed-dim: '#a0d3a7'
  on-primary-fixed: '#00210b'
  on-primary-fixed-variant: '#22502e'
  secondary-fixed: '#ffdcc2'
  secondary-fixed-dim: '#f1bc92'
  on-secondary-fixed: '#2e1500'
  on-secondary-fixed-variant: '#633e1e'
  tertiary-fixed: '#b6f2af'
  tertiary-fixed-dim: '#9ad595'
  on-tertiary-fixed: '#002204'
  on-tertiary-fixed-variant: '#1b5120'
  background: '#fff8f5'
  on-background: '#221a12'
  surface-variant: '#f1dfd2'
typography:
  headline-xl:
    fontFamily: Noto Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
  headline-xl-mobile:
    fontFamily: Noto Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg:
    fontFamily: Noto Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg-mobile:
    fontFamily: Noto Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
  headline-md:
    fontFamily: Noto Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Noto Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Noto Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  price-display-lg:
    fontFamily: Noto Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
  price-display-md:
    fontFamily: Noto Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
  price-display-sm:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  label-lg:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-bilingual:
    fontFamily: Noto Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is tailored for agricultural producers, traders, and mandi participants across Maharashtra and the Mumbai metropolitan area. The aesthetic blends tactile warmth with digital clarity, rooting its visual language in the agrarian cycle: tilled soil, foliage, sun-cured wheat, and terracotta clay.

The core audience ranges from smallholder farmers operating under bright outdoor sun to commission agents balancing high-frequency wholesale records. Interfaces must minimize visual friction and cognitive load. The design philosophy pairs generous tactile feedback with calm, organic stability—avoiding sterile tech minimalism or loud industrial styling. Elements carry soft, rounded geometries, high-contrast numerical metrics, and unmistakable semantic states to engender trust, transparency, and ease of use in both Marathi (Devanagari) and English contexts.

## Colors

The palette is derived directly from the agrarian landscape, balancing readability in extreme sunlight with an organic, dependable feel:

- **Primary (`#2F5D3A` - Deep Leaf Green):** Core brand actions, primary buttons, high-priority navigation, and established state indicators.
- **Secondary (`#7A5230` - Soil Brown):** Categorical indicators, contextual framing, secondary actions, and logistical references.
- **Tertiary / Price Positive (`#6BA368` - Fresh Green):** Upward price momentum, positive market shifts, active status toggles, and completed trades. Paired with background tint `#EAF3EC`.
- **Alert / Price Negative (`#C0533A` - Terracotta Red):** Downward rate shifts, deficit indicators, pending disputes, and critical alerts. Paired with soft background tint `#FDF2EE`.
- **Neutral Dark (`#3B3128` - Dark Brown-Grey):** Primary typography and prominent data points, delivering crisp contrast without the harshness of pure black.
- **Muted Neutral (`#6E6155`):** Secondary metadata, bilingual support labels, timestamps, and measurement units (quintal / kg).
- **Surface Canvas (`#F4EBDD` - Wheat Beige):** Global page background, delivering natural warmth and reduced glare outdoors.
- **Surface Cards & Sheets (`#FFFBF4` - Warm Off-White):** High-level component containers, list item surfaces, and modal sheets.
- **Borders & Dividers (`#E2D7C3`):** Subtle structural boundaries that delineate cards and tables without creating visual clutter.
- **Soil Tint (`#F1EAE2`):** Neutral chip backgrounds, interactive hover states, and inactive inputs.

## Typography

Typography prioritizes high legibility, clear bilingual rendering (English and Marathi/Devanagari scripts), and high-contrast numerical tracking:

- **Font Family:** Noto Sans serves as the universal baseline for its comprehensive Devanagari coverage, neutral geometric stability, open apertures, and balanced x-height across both Latin and Indic scripts.
- **Price Displays:** Commodity prices, mandi rates, and auction bids utilize dedicated `price-display` roles with heavier weights (`700` and `800`) and tabular figures to ensure numbers align neatly in market tables.
- **Bilingual Stacking:** Primary labels appear in English or Marathi based on user language preferences, with secondary transliterated or translated sub-labels using `label-bilingual` in `#6E6155` to aid dual-language comprehension across regional supply chains.

## Layout & Spacing

The layout is built around mobile-first utility, accommodating single-hand interaction in outdoor, fast-paced mandi environments:

- **Grid Strategy:** A fluid 4-column layout on mobile devices (<768px) with `1rem` margins and `1rem` gutters. On tablets (768px–1024px), it expands to 8 columns with `1.5rem` margins. For desktop/kiosk displays (>1024px), it establishes a structured 12-column grid constrained to a maximum width of 1280px with centered alignment.
- **Touch Ergonomics:** All interactive triggers maintain a strict minimum hit target of `48px` vertically and horizontally to prevent mis-taps.
- **Spacing Rhythm:** Vertical rhythms rely heavily on `space-sm` (8px) for related item clusters, `space-md` (16px) for interior card padding, and `space-lg` (24px) to separate independent functional cards.

## Elevation & Depth

Visual hierarchy uses warm, diffuse ambient drop shadows tinted with soil pigments, avoiding artificial gray or stark pitch-black shadows:

- **Level 0 (Flat Ground):** Background `#F4EBDD` canvas. No elevation or border.
- **Level 1 (Card & Content Blocks):** Resting state for rate sheets, commodity listings, and data cards. Constructed using background `#FFFBF4`, a subtle structural border `1px solid #E2D7C3`, and a soft soil-tinted shadow: `box-shadow: 0 2px 6px -1px rgba(59, 49, 40, 0.06), 0 1px 3px -1px rgba(59, 49, 40, 0.04)`.
- **Level 2 (Interactive Floating Elements & Dropdowns):** Floating filters, quick-action buttons, active toggles, and search bars. `box-shadow: 0 6px 14px -2px rgba(59, 49, 40, 0.10), 0 3px 6px -2px rgba(59, 49, 40, 0.06)`.
- **Level 3 (Modals & Bottom Action Drawers):** Critical rate calculators, weighment confirmations, and commodity filtering sheets: `box-shadow: 0 16px 28px -4px rgba(59, 49, 40, 0.18), 0 6px 12px -3px rgba(59, 49, 40, 0.08)`.

## Shapes

The shape system communicates safety, earthiness, and approachability. 

- Standard containers and structural cards utilize a `16px` (`rounded-lg`) corner radius to create smooth, non-aggressive silhouettes.
- Interactive elements such as buttons, standard input fields, and market summary boxes sit at `8px` (`rounded`).
- Micro-elements, trend tags, filter chips, and price-movement indicators use full pill profiles (`rounded-full` / `9999px`) to distinguish actionable statuses from rigid layout containers.

## Components

### Buttons
- **Primary:** Filled in `#2F5D3A` with `#FFFBF4` text. Height is minimum 48px, horizontal padding `1.25rem`, radius `8px`. Active states use a deep pressed state (`#22452A`).
- **Secondary:** Surface `#FFFBF4` with border `1.5px solid #7A5230` and text `#7A5230`. Provides a reliable option for secondary workflow routes.
- **Tertiary / Subdued:** Transparent background with `#2F5D3A` text, underlined or bracketed by directional arrow icons. Minimum touch target of 48px retained via transparent padding.

### Chips & Filter Pills
- Commodity quick-filters (e.g., Kanda/Onion, Soyabean, Cotton) use full-pill shapes (`rounded-full`) with a height of `38px` to `44px`.
- **Inactive:** `#F1EAE2` background, `#3B3128` text, and `#E2D7C3` border.
- **Active:** `#2F5D3A` background, `#FFFBF4` bold text, zero border.

### Price Trend Badges (Up / Down)
- **Positive Trend (Price Gain):** Background `#EAF3EC`, text `#2F5D3A`, featuring a bold green directional up arrow (`▲` or `↑`). Text styled with `label-md` or `label-lg`.
- **Negative Trend (Price Drop):** Background `#FDF2EE`, text `#C0533A`, featuring a bold terracotta directional down arrow (`▼` or `↓`).
- Display formats strictly clarify rate metrics: `+ ₹120/क्विं` (+ ₹120/qtl) or `- ₹4/कि.ग्रा` (- ₹4/kg).

### Commodity Cards
- Enclosed containers with surface `#FFFBF4`, 16px corner radius, and `1px solid #E2D7C3` border.
- Features a two-row or two-column split: left side highlights the crop variety and bilingual title (e.g., Nashik Red Onion / नाशिक लाल कांदा); right side presents the high-contrast bold price (`price-display-md`) paired with the trend pill immediately below.

### Form Inputs & Search
- Generous vertical height of `52px` to accommodate stylus or thumb entry.
- Surface `#FFFBF4` with a resting border of `1.5px solid #E2D7C3`.
- Focused state transitions to `2px solid #2F5D3A` with a subtle `#2F5D3A15` ring halo. 
- Placeholder text in `#6E6155` featuring bilingual instructional cues.

### Checkboxes & Radio Controls
- Minimum dimensions of `24px x 24px` within a minimum tap area of `48px`.
- Unchecked: `#FFFBF4` surface with `2px solid #6E6155`.
- Checked: `#2F5D3A` fill with `#FFFBF4` checkmark icon or inner dot.

### Mandi Arrival & Stock Lists
- Separated with full-width dividers (`#E2D7C3`) within a unified `#FFFBF4` card.
- Left edge highlights vehicle arrival or weighment status using vertical status indicators (4px width) colored according to mandi arrival state (Green: Unloaded, Brown: In Yard, Terracotta: Delayed).