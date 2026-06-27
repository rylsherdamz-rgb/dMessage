# dMessage — Design System

> Crypto · Neobrutalist · Minimalist
>
> This is the canonical reference for the dMessage frontend visual language.
> All tokens live in [`src/app/globals.css`](./src/app/globals.css) and are
> exposed to Tailwind v4 via `@theme inline`.

---

## 1. Principles

1. **Brutalist honesty** — hard 2px borders, offset block shadows, sharp corners
   (`--radius: 0`). The interface looks like the machine it runs on.
2. **Minimalist restraint** — near-black surfaces, one dominant accent, generous
   negative space. Color is information, not decoration.
3. **Crypto/terminal texture** — monospace everywhere, grid + dot fields,
   scanlines, status dots, and a single 3D "Stellar Orb" anchoring the hero.
4. **Motion with intent** — content rises into view once; nothing loops
   distractingly. All motion collapses under `prefers-reduced-motion`.

---

## 2. Color

Surfaces are layered near-black in OKLCH so they stay neutral on wide-gamut
displays. Accents are sRGB hex for predictable glow math.

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `oklch(0% 0 0)` | Page background |
| `--bg-surface` | `oklch(13% …)` | Cards, panels |
| `--bg-elevated` | `oklch(18% …)` | Hover / raised |
| `--bg-inset` | `oklch(9% …)` | Wells, footers |
| `--text` | `oklch(98% 0 0)` | Primary text |
| `--text-muted` | `oklch(62% …)` | Body copy |
| `--text-faint` | `oklch(42% …)` | Labels, captions |
| `--border` | `oklch(28% …)` | Hairlines, grid |
| `--border-strong` | `oklch(40% …)` | Brutalist borders/shadows |

**Accents**

| Token | Hex | Meaning |
|-------|-----|---------|
| `--accent` | `#00ff88` | Primary — actions, focus, "live" |
| `--cyan` | `#22d3ee` | Secondary — identity/conversations |
| `--violet` | `#8b5cf6` | Tertiary — storage/messages |
| `--amber` | `#ffb020` | Warnings, chrome dots |
| `--danger` | `#ff3355` | Errors, destructive |

`*-rgb` variants (`--accent-rgb`, etc.) exist for `rgb(... / alpha)` glow shadows.

---

## 3. Typography

Single family: **Geist Mono** (`--font-mono` / `--font-sans` both map to it).
Monospace reinforces the terminal/crypto register and keeps tabular data aligned.

Scale: `--text-2xs` (0.625rem) → `--text-hero` (`clamp(2.75rem, 1rem + 7vw, 7rem)`).

Conventions:
- Headings: `font-black`, `tracking-tight`, tight leading (~0.95).
- Labels/eyebrows: `uppercase`, `tracking-[0.2em–0.3em]`, `text-faint`/`text-muted`.
- Emphasis: `.text-stroke-accent` (outlined accent text) or `.text-glow`.

---

## 4. Spacing, Radius & Shadow

- **Radius**: `--radius: 0` (sharp). `--radius-sm: 2px` reserved for rare pills.
- **Brutal shadow**: `6px 6px 0 0` offset, collapsing to `0` on `:active`
  (the press "pushes" the element into the page via `translate`).
- Section rhythm: `py-28` desktop, `max-w-6xl` content column, `px-6` gutters.

---

## 5. Primitives (utility classes)

| Class | Description |
|-------|-------------|
| `.brutal` | 2px strong border + offset shadow, interactive press animation |
| `.brutal-accent` | Same, with accent border/shadow |
| `.brutal-static` | Border + shadow, no hover motion |
| `.brutal-input` | Input border that lights up accent on focus |
| `.glow-accent` | Accent ring + soft outer glow |
| `.text-glow` | Accent text shadow |
| `.text-stroke` / `.text-stroke-accent` | Outlined (transparent-fill) text |
| `.divider` | Centered fading hairline rule |
| `.status-dot` | 8px dot with `currentColor` glow (set color via text-*) |
| `.skeleton` | Shimmering loading placeholder |

> Legacy aliases (`.neobrutalist*`) are kept so older markup still styles
> correctly; prefer the `.brutal*` names in new code.

---

## 6. Textures & Backgrounds

| Class | Description |
|-------|-------------|
| `.bg-grid` | 48px line grid, radially masked at the top |
| `.bg-dots` | 22px dot field (ambient layer) |
| `.bg-noise` | Subtle fractal-noise grain overlay (`::after`) |
| `.scanlines` | CRT scanline overlay (`::before`) |

Ambient layers (dots + two blurred radial accent/violet glows) live in
`layout.tsx`, fixed behind all content at `-z-10`.

---

## 7. Motion

Animations are exposed as Tailwind `animate-*` utilities:

| Utility | Keyframe | Use |
|---------|----------|-----|
| `animate-float` | gentle Y bob | 3D-adjacent elements |
| `animate-pulse-glow` | opacity + glow pulse | "live" status dots, logo |
| `animate-marquee` | translateX 0 → -50% | the ticker (duplicate items) |
| `animate-shimmer` | bg-position sweep | skeletons |
| `animate-blink` | step blink | cursors/carets |
| `animate-rise` | fade + rise | one-shot entrances |
| `animate-scan` | vertical sweep | scan lines |
| `animate-spin-slow` | 14s rotate | orbital accents |

Easing tokens: `--ease-out-expo` (decelerate), `--ease-snap` (overshoot).

Scroll entrances use the `Reveal` component
(`src/components/landing/Reveal.tsx`), a Framer Motion `whileInView` wrapper
(`once: true`) with staggered `delay`.

All motion is disabled under `@media (prefers-reduced-motion: reduce)`.

---

## 8. Page Composition

The landing page (`src/app/page.tsx`) stacks:

```
HeroScene   — 3D Stellar Orb + starfield, floating nav, scroll cue
Marquee     — accent ticker of protocol keywords
Features    — 6 brutal cards ("Why dMessage")
HowItWorks  — 4-step bordered grid ("wallet to whisper")
Contracts   — 3 contract cards w/ window-chrome ("on-chain")
CTA         — grid backdrop, live-testnet badge, connect/open-app
Footer      — link columns + divider + license
```

Sections expose `id` anchors (`#features`, `#how`, `#contracts`) consumed by the
hero nav and footer for smooth in-page scrolling (`scroll-behavior: smooth`).

---

## 9. Accessibility

- Decorative layers use `aria-hidden` and `pointer-events-none`.
- Accent green on black exceeds WCAG AA for large text; body copy uses
  `--text` / `--text-muted` against dark surfaces for contrast.
- Focus states are explicit (`.brutal-input:focus` accent ring).
- Reduced-motion fully neutralizes animation and smooth scroll.
