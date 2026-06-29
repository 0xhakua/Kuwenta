# BRAND.md — Krunchr Design System

This is the **authoritative visual guide for coding agents** working on Krunchr's UI. It is derived from `ui-mock.html` (the source-of-truth mockups) and translated to this project's actual stack: **Next.js 15 + Tailwind CSS 4 + shadcn/ui (base-ui primitives) + lucide-react**.

> **Golden rule:** Style with **semantic design tokens**, never raw hex or Tailwind palette colors (`slate-200`, `green-600`, …). The tokens live in `app/globals.css`. If you need a color that doesn't exist as a token, add it as a token — don't inline it.

---

## 1. Brand identity

- **Product name:** Krunchr
- **Descriptor / lockup subtitle:** "Compliance Engine"
- **Domain:** Philippine individual tax compliance (8% freelancers), with Stellar-anchored filing receipts.
- **Personality:** Trustworthy, precise, calm, modern-corporate. We turn an anxious task (BIR filing) into something that feels *handled*. Copy is plain and reassuring ("Your compliance engine is running smoothly", "Filing Complete & Secured").
- **Signature motifs:** the **teal action**, the **mint "Verified" / Stellar-secured** state, **bento-grid** dashboards, thin-bordered cards on a faint-blue canvas, and an always-visible **"Blockchain Status: Secured"** pill.

---

## 2. Where the system lives

| Concern | File | Notes |
|---|---|---|
| Color tokens, radius, elevation, brand utilities | `app/globals.css` | `:root` (light) + `.dark`. shadcn maps these to `--color-*`. |
| Fonts | `app/layout.tsx` | Public Sans (headings) + Inter (body) via `next/font`. |
| App shell (sidebar + topbar) | `app/(dashboard)/layout.tsx` | Branded nav lockup + Stellar status. |
| Primitives | `components/ui/*` | shadcn/base-ui. Restyle via tokens, not per-page overrides. |
| Icons | `lucide-react` | See §9 for the Material-Symbols → lucide map. |

**Never** hardcode the palette in a page. Change a token once; every page inherits it.

---

## 3. Color system

### 3.1 Brand roles (the palette)

| Role | Light value | Use |
|---|---|---|
| **Primary action (teal)** | `#0D9488` (hover `#0F766E`) | Primary CTAs: "Start New Filing", "Proceed to Filing", "Download Filing Package". |
| **Accent ink (deep teal)** | `#006A61` | Interactive text/icons, links, active-nav text, inline emphasis. |
| **Teal container** | bg `#86F2E4` / text `#006F66` | Active sidebar item, soft teal highlights. |
| **Success / Verified (mint)** | `#4EDEA3`, deep `#009668`, tint `rgba(78,222,163,.2)` | "Compliant", "Stellar Verified", "Verified" pills, progress rings. |
| **Info / active step (blue)** | `#3B82F6` | Current step node in the filing stepper, informational chips. |
| **Ink (foreground)** | `#0B1C30` | Primary text, totals, headings. |
| **Muted ink** | `#45464D` | Secondary text, captions, table labels. |
| **Error** | `#BA1A1A`, container `#FFDAD6` | Deadlines, validation errors, overdue, "Failed / Needs Review". |
| **App canvas** | `#F8F9FF` | Page background. |
| **Card surface** | `#FFFFFF` | Cards, panels, table bodies. |
| **Surface containers** | `#EFF4FF` → `#E5EEFF` → `#DCE9FF` → `#D3E4FE` | Low→high elevation tints: sidebar, hovers, chips, skeletons. |
| **Card border** | `#E2E8F0` | Default 1px card/divider border. |
| **Outline / input** | `#C6C6CD` / `#CBD5E1` | Form control borders, strong dividers. |

### 3.2 Semantic token mapping (what you actually type)

Use these shadcn tokens. They are wired to the palette above in `globals.css`.

| Token class | Means | Backed by |
|---|---|---|
| `bg-background` / `text-foreground` | Page canvas / primary ink | `#F8F9FF` / `#0B1C30` |
| `bg-card` `text-card-foreground` | Card surface | `#FFFFFF` / `#0B1C30` |
| `bg-primary` `text-primary-foreground` | **Teal CTA** | `#0D9488` / white |
| `text-primary` | Teal interactive text/link | `#006A61` |
| `bg-secondary` `text-secondary-foreground` | Quiet/neutral button & chip | `#EFF4FF` / ink |
| `bg-muted` `text-muted-foreground` | Subtle fills / secondary text | `#EFF4FF` / `#45464D` |
| `bg-accent` `text-accent-foreground` | Teal-tinted active/hover (nav) | `#86F2E4` / `#006F66` |
| `bg-destructive` `text-destructive` | Error/overdue | `#BA1A1A` |
| `border-border` | Default borders/dividers | `#E2E8F0` |
| `ring-ring` | Focus ring | teal |
| `bg-sidebar*` | App-shell nav surfaces | see §3.3 |

**Status colors** (filing roadmap, badges) — use these semantic intents, defined as utilities in `globals.css` (§3.3):

| Intent | Class | Look |
|---|---|---|
| Success / Filed / Verified | `.status-success` | mint text on mint tint |
| Warning / Pending / Due soon | `.status-warning` | amber text on amber tint |
| Danger / Overdue / Blocked | `.status-danger` | red text on red tint |
| Info / In-progress | `.status-info` | blue text on blue tint |

> Migrating legacy pages: replace ad-hoc `bg-green-100 text-green-800` → `.status-success`, `bg-amber-100 text-amber-800` → `.status-warning`, `bg-red-100 text-red-800` → `.status-danger`, `bg-blue-100 text-blue-800` → `.status-info`.

### 3.3 Dark mode

Dark mode flips the canvas to navy (`#0B1C30`) with `#131B2E` cards and a brightened teal (`#2DD4BF`). It is defined in `.dark` in `globals.css`. Don't author per-component dark overrides unless a token genuinely can't express it.

---

## 4. Typography

Two families, loaded in `app/layout.tsx`:

- **Public Sans** — headings / display. Exposed as `--font-heading`; use **`font-heading`**. Weights 600/700/800/900. `CardTitle` already uses it.
- **Inter** — body, labels, UI. Exposed as `--font-sans` (default `font-sans`). Weights 400–700.
- **Monospace** — Geist Mono (`font-mono`) for **Stellar hashes / TX IDs** only.

### Type scale (from the mock)

| Name | Class recipe | Size/LH/weight | Use |
|---|---|---|---|
| Display / headline-xl | `font-heading text-5xl font-bold tracking-tight` | 48/56/700 | Page hero totals ("Overview", "₱ 11,500.00"). |
| headline-lg | `font-heading text-[2rem] font-semibold tracking-tight` | 32/40/600 | Page titles. |
| headline-md | `font-heading text-2xl font-semibold` | 24/32/600 | Card titles, section headers. |
| body-lg | `text-lg` | 18/28/400 | Lead paragraphs. |
| body-md | `text-base` | 16/24/400 | Default body. |
| label-md | `text-sm font-medium` | 14/20/500 | Buttons, nav, table values. |
| label-sm | `text-xs font-semibold` | 12/16/600 | Captions, pills, metadata. Often `uppercase tracking-wider` for section eyebrows. |

Rules: headings → `font-heading`; never set heading weight below 600; section eyebrows use `text-xs font-semibold uppercase tracking-wider text-muted-foreground`.

---

## 5. Spacing, radius, elevation

- **Spacing base** 8px; **card padding** `p-6` (24px); **grid gutter** `gap-6` (24px); page margins `px-4 md:px-10`. Content max-width **1280px** (`max-w-[1280px] mx-auto`).
- **Radius:** base `--radius` = `0.5rem`. Buttons/inputs/nav `rounded-lg`; **cards `rounded-xl`** (0.75rem); pills/avatars `rounded-full`.
- **Elevation:** flat by default — cards are **1px border (`border-border`) + the ambient shadow**. Use the **`.shadow-ambient`** utility (`0 4px 6px -1px rgb(15 23 42 / .1), 0 2px 4px -2px rgb(15 23 42 / .05)`). Avoid heavy/large drop shadows. Glass surfaces use **`.glass-card`**.

---

## 6. Layout patterns

- **App shell:** fixed 64px topbar (wordmark left, Stellar-status pill + bell + profile right) and a fixed 256px (`w-64`) left sidebar on `md+`. Main content offset `md:ml-64`, top padding for the bar. Implemented in `app/(dashboard)/layout.tsx`.
- **Sidebar lockup:** an icon tile + **"Krunchr" / "Compliance Engine"**, then a full-width teal "Start New Filing" CTA, then nav. Active item = `bg-sidebar-accent text-sidebar-accent-foreground font-bold`; idle = `text-muted-foreground hover:bg-accent`.
- **Bento grid:** `grid grid-cols-1 md:grid-cols-3 gap-6`; feature cards span two columns (`md:col-span-2`). Use for dashboards/summaries.
- **Two-column work pages** (e.g. computation + sequence): `lg:grid-cols-12`, main `lg:col-span-8`, summary rail `lg:col-span-4 lg:sticky lg:top-24`.

---

## 7. Components & recipes

**Card** — `rounded-xl bg-card border border-border shadow-ambient p-6`. Header: `font-heading text-2xl`. Eyebrow label: section-eyebrow style. Prefer `components/ui/card`.

**Buttons** (`components/ui/button`):
- Primary CTA → default variant (teal). Icon-trailing actions add `<ArrowRight/>`.
- Neutral/secondary → `variant="outline"` or `secondary` (light).
- Tertiary inline → `variant="ghost"` / `link` (teal text).

**Status pill / badge** — small `rounded-full` chip, `text-xs font-semibold`, icon + label, using a `.status-*` intent (e.g. `CheckCircle2` + "Compliant"). Use `components/ui/badge`.

**"Stellar Verified" badge** — neutral chip (`bg-muted border-border`) with a teal `BadgeCheck`/`ShieldCheck` icon + "Stellar Verified". Signals on-chain anchoring on filed returns.

**Blockchain status pill** (topbar) — `rounded-full border border-border bg-muted px-3 py-1.5` with teal `Link2` icon + "Blockchain Status: Secured".

**Filing stepper** — vertical nodes joined by a 2px line. Active node: white fill, 2px **blue** (`#3B82F6`) ring, inner dot, `shadow-[0_0_0_4px_white]`. Done: mint. Pending: muted fill + `border-border`, muted text.

**Progress ring** (compliance %) — SVG circle, track `border`-grey, value stroke **mint** (`#4EDEA3`), big `font-heading` number in teal center.

**Upload dropzone** — `border-2 border-dashed border-border rounded-xl bg-card p-12` centered; on drag-over swap to teal border + faint teal bg (`.drag-active`). Icon in a `rounded-full bg-muted` circle.

**Tables** — header row `bg-muted/text-muted-foreground text-xs font-medium`; body on `bg-card`, `divide-y divide-border`, row hover `hover:bg-background`. Money right-aligned; processing rows show pulsing skeletons (`animate-pulse bg-muted`).

**Money & hashes** — amounts as `₱ 1,234.00` (peso glyph + thin space), tabular/right-aligned in tables, totals in `font-heading`. TX hashes in `font-mono text-sm break-all` inside a `bg-muted rounded-md` block, paired with a "Scan to verify" QR.

---

## 8. Motion

Subtle and fast. `transition-colors`/`transition-opacity` ~150ms on hovers. Active nav nudges `scale-95`. Spinners `animate-spin` (lucide `RefreshCw`/`Loader2`), skeletons `animate-pulse`. No bouncy or long (>300ms) animations.

---

## 9. Icons

Use **lucide-react** (the mock's Material Symbols are not installed). Keep icons at `size-4`/`size-5` inline, `size-6` in tiles. Common mappings:

| Mock (Material Symbol) | lucide-react |
|---|---|
| dashboard | `LayoutDashboard` |
| upload_file / cloud_upload | `FileUp` / `UploadCloud` |
| calculate | `Calculator` |
| account_tree | `Network` |
| verified_user / shield | `ShieldCheck` / `Shield` |
| verified | `BadgeCheck` |
| receipt_long | `ReceiptText` |
| event | `CalendarClock` |
| link | `Link2` |
| check_circle | `CheckCircle2` |
| document_scanner | `ScanLine` |
| description | `FileText` |
| sync | `RefreshCw` |
| arrow_forward | `ArrowRight` |
| notifications | `Bell` |
| history_edu | `ScrollText` |
| download | `Download` |
| lock | `Lock` |
| settings / help | `Settings` / `HelpCircle` |

---

## 10. Agent checklist (do / don't)

**Do**
- Use semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`).
- Headings in `font-heading`; section eyebrows uppercase + `text-xs`.
- Cards: `rounded-xl border border-border shadow-ambient p-6`.
- Primary CTAs in teal; success/verified in mint; errors in `destructive`.
- Status chips via `.status-success|warning|danger|info`.
- Bento grids and the 1280px container for dashboards.
- Reuse `components/ui/*`; restyle via tokens.

**Don't**
- Hardcode hex or Tailwind palette colors (`green-600`, `slate-200`) in pages.
- Add heavy shadows or large radii outside the scale.
- Introduce new fonts or icon libraries.
- Set heading weights below 600 or skip `font-heading` on headings.
- Author per-component dark-mode overrides when a token would do.

**Source of truth:** `ui-mock.html`. When in doubt, match it, then express the result as tokens here.
