# TVI Design System

The brand system for **TVI (Тивиай / ТВИ)** — an international digital marketing
agency working with *«брендов, определяющих будущее»* (brands defining the future).
TVI does strategy, branding, SMM and go-to-market for ambitious companies, and runs
Asian-market operations (South Korea, Malaysia / South-East Asia) under the
sub-brand **Vostok-1**.

The look is **dark, premium and futuristic**: a near-black navy canvas, cool
periwinkle-lavender light tones, one electric-blue action color, glassmorphic
navigation, and big soft radial glow blobs that make the darkness feel alive.
The product is Russian-language first.

---

## Sources

This system was reverse-engineered from two artifacts the user provided. Keep these
references — don't assume the reader can open them.

- **Figma file:** "прототипы TVI (Copy).fig" — the full prototype (4 pages: Main /
  Services / C-level / Cases, Countries, English-Vostok-1, components). 141 component
  sets, mostly page-specific prototype instances.
- **Codebase:** `tvi-website/` — an **Astro** implementation of the production site
  (`tvi-website/site/`). This is the authoritative source: it has a clean, heavily
  documented token file (`site/src/styles/tokens.css`), well-factored section/UI
  components (`site/src/components/`), and page data (`site/src/data/`). The token
  values, component behaviour and copy in this design system come from there, 1:1.

Production preview referenced in handoffs: `tvi.semadrgn.me` (canonical domain
`tvi.agency`).

---

## Content fundamentals

How TVI writes:

- **Language:** Russian, first and foremost. The brand name appears as **«тви»**,
  **«Тивиай»** or the **ТВИ** monogram; lowercase **`tvi`** in running latin copy.
- **Voice — "мы" (we):** Copy is written from the agency's first-person plural and
  speaks *to* the client. *«Мы агентство Тивиай — проектируем, упаковываем и
  масштабируем цифровой опыт потребителя.»* Confident, declarative, never salesy-loud.
- **Tone:** Premium consultancy. Smart but plain — short sentences, concrete verbs
  (*проектируем, упаковываем, масштабируем*). Avoids hype words and exclamation marks.
- **Casing:** Headings are **sentence case** with deliberate line breaks
  (*«Маркетинг для брендов,⏎определяющих будущее»*). Card titles and long
  scroll-animated statements are set **UPPERCASE** via CSS (data stays readable-case).
- **Numerals:** Lining + proportional figures (Raleway defaults to oldstyle — the
  base reset forces lining). Stats read like *«87 %»*, *«более 20 продуктов»*.
- **Emoji:** **None.** Not part of the brand. Iconography is line-SVG only.
- **Examples:** CTA = *«Обсудить проект»* / *«Отправить заявку»*; nav = *Отрасли,
  Услуги, Страны, Агентство*; section heads = *Портфолио, Go-to-market кейсы,
  Полезно C-level*.

---

## Visual foundations

- **Background:** A single deep navy-black, `--color-bg-page #020514`, everywhere.
  Never pure black, never light. Sections do **not** alternate background color;
  rhythm comes from glow, spacing and content — not panels.
- **Color vibe:** Cool throughout. Light tones are periwinkle-lavender
  (`#d9dfff`, `#d8defe`), body text a muted slate-blue (`#7c83a6`). One action color:
  electric blue `#24389a`. Two country recolor themes — **ice blue** (Korea,
  `#1f45b4` / `#c5e8fe`) and **mint green** (South-East Asia, `#1f9970` / `#d9fff2`) —
  applied via `[data-theme="blue"|"green"]`.
- **Type:** **Raleway** does everything (400 body → 500 default UI → 600 emphasis →
  700 display). **Inter** only for fine technical numerals. Headings get a cool
  **top-down gradient fill** (white → lavender → slate); section heads drop the white
  stop. Display is Bold 50/50 desktop, fluid to ~27px mobile.
- **Backgrounds / decoration:** The signature is **large soft radial glow blobs**
  (blue, blurred 120–180px) behind hero and CTA — see `GlowField`. Plus a subtle
  **dust-particle drift** in the hero on the real site. Imagery is moody, cinematic,
  often dark/neon (portfolio cases). No flat illustration, no stock-clean photography.
- **Glassmorphism:** Nav bar, dropdowns and overlays are frosted glass — translucent
  radial-white fill + heavy `backdrop-filter: blur(42–80px)` + a 1px gradient ring
  drawn with mask-composite so it respects the radius. See `GlassPanel`.
- **Cards:** Dark vertical-gradient fill (`#0c0d0f → #161825`), `backdrop-blur 80.8px`,
  thin **1.2px `#202436`** border, **14px** radius, image rounded only at the top.
  Hover **brightens** fill + border (`#303552`) with no transform/scale.
- **Corners:** 8 (chips) · 14 (buttons, cards) · 20 (banners, dropdown panels) ·
  24 (glass nav) · 30 (nav pills) · 60 (full pills).
- **Borders & shadows:** Borders are thin and dark (1–1.2px `#202436`, forms `#7880ab`).
  Shadows are restrained: a blue floating-action shadow, and a soft **white glow**
  (`0 0 9px rgba(255,255,255,.15)`) that appears on CTA/submit hover. Headings carry a
  faint white top-glow text-shadow.
- **Motion:** Calm. Figma `SMART_ANIMATE` → CSS `cubic-bezier(.42,0,.58,1)` (EASE_IN_AND_OUT)
  and `ease-out`, **150–200ms**. Glow blobs and bg-korea ellipses pulse very slowly
  (4.8–8s loops). No bounce, no springy overshoot. All motion respects
  `prefers-reduced-motion`.
- **Hover states:** Links/pills → faint white wash + brightened label;
  buttons → fill lightens + white glow; cards → surface/border brighten. **Press:**
  color shift only, no shrink.
- **Layout:** Fixed glass header. Content container is a fluid `100vw − 100px`
  (50px gutter each side), capped at 1340px (2400px on 5K+). 30px inter-section rhythm
  on desktop, ~28px mobile. Long-form/legal text uses a narrow 760px measure.
- **Transparency & blur** are used liberally and intentionally — glass over glow,
  translucent dropdown gradients, knocked-out-to-white client logos.

---

## Iconography

- **Service / market icons:** A set of **50×50 line-icon tiles** (IT, DCC, Blockchain,
  Strategy, Branding, SMM, China, Korea, ASEAN) used in the nav dropdowns. Each tile is
  a rounded square (`rx 10`, fill `#1A1A1A`) with a **hairline ring** (`1px #d9d9d9 @ .5`)
  and a thin **line glyph** inside. Stroke-style, monochrome, never filled. Copied into
  `assets/icons/`.
- **Inline UI glyphs:** Small chevrons/arrows are drawn inline (1.2px stroke,
  lavender `--color-decoration-arrow #d9ddff`). The Telegram paper-plane is the one
  recurring brand glyph (see `TgButton`).
- **No icon font.** No emoji. No unicode-as-icon. Everything is real SVG.
- **Logos & marks:** TVI wordmark (the ТВИ monogram, with a hover shimmer on the real
  site), a snowflake star mark, and the Vostok-1 sub-brand mark. In `assets/logo/`.
- **Partner / client logos:** analytics partners (Statista, YoTrends, SCAN, keys.so,
  trendsee, Claude) shown as-is; client marks (realme, Duty Free, FULFIL, МИР) knocked
  out to white. In `assets/partners/` and `assets/clients/`.

If you need an icon that isn't in `assets/icons/`, match the line-tile treatment
(50×50, rx 10, `#1A1A1A` fill, hairline ring, thin stroke glyph) or substitute the
closest line icon from a CDN set (e.g. Lucide) and flag it.

---

## What's in here (index / manifest)

Root:
- **`styles.css`** — global entry point (the file consumers link). `@import` list only.
- **`tokens/`** — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`,
  `effects.css`, `base.css`. All CSS custom properties + the webfont import.
- **`readme.md`** — this guide. **`SKILL.md`** — Agent-Skills-compatible entry.

Components (React primitives, `window.TVIDesignSystem_d3bab8.*`):
- `components/core/` — **Button**, **NavLink**, **Badge**, **SectionHeading**
- `components/brand/` — **Logo**
- `components/surfaces/` — **Card**, **GlassPanel**, **GlowField**
- `components/forms/` — **Input**, **Select**
- `components/feedback/` — **TestimonialCard**, **TgButton**

Each directory has a `@dsCard`-tagged `*.card.html` (its Design System tab thumbnail),
plus `<Name>.d.ts` + `<Name>.prompt.md` per component.

Foundations (`guidelines/`) — specimen cards for the Design System tab: Colors (text,
surface, action, themes), Type (display, body), Spacing (scale, radii), Effects (glass,
glow, borders/shadows), Brand (logos, partners, icons).

UI kits (`ui_kits/`):
- **`website/`** — interactive recreation of the TVI marketing homepage (glass header
  + dropdowns, glow hero, Telegram banner, portfolio grid, client reviews, working CTA
  form, footer) and a Vostok-1 country (ice/mint themed) screen.

Assets (`assets/`) — `logo/`, `icons/`, `partners/`, `clients/`, `imagery/`.
