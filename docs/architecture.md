# Balcony Configurator — Definitive Technical Architecture

> **Positioning.** This document specifies the rebuild of a production glazing/balcony quoting tool used daily by sales reps (on tablets, in customers' living rooms) and installers (verifying frozen specs on site). The existing strict-TypeScript domain layer (`src/types`, `src/data`, `src/lib`, `src/store`) is treated as a **correct, pure kernel** whose *model* — `BalconyConfig` as an immutable atom, validity derived not stored, catalog exhaustiveness, net-then-VAT-once arithmetic — is preserved. Two deliberate, scoped contract changes are made to it (a VAT signature change to `calculatePrice`, and the addition of derived `validation` to the store), both specified in full below. The rebuild wraps the kernel in a thin, accessible React shell, adds the one capability the domain genuinely lacks — a **declarative configuration-validity / compatibility engine kept separate from both the UI and the pricing engine** — and grows operator-workflow features (live quote sidebar, save/resume drafts, undo/redo, PDF/email output, offline capability) as independently shippable layers behind clean seams. It is a Schüco/Reynaers-grade quote instrument, not a 3D demo.

---

## 0. Executive Summary & Guiding Principles

The pricing *arithmetic* is already solved: `calculatePrice` is a pure, deterministic, EPSILON-safe formula that the Zustand store recomputes synchronously inside every mutating action. The **real** gap — the thing that separates a toy from a manufacturer-grade configurator — is **configuration validity**: today the store's per-step validators only check enum-membership and dimension bounds; they never check whether two individually-valid selections are valid *together* (frameless glazing on a cold profile, triple glass past a slim-aluminium span, a mosquito net on a frameless system). Closing that gap is the architectural centre of gravity.

**Eight load-bearing decisions** (each justified in its section):

| # | Decision | One-line rationale |
|---|----------|--------------------|
| 1 | **React 18 + TypeScript 5.9 (strict, unchanged tsconfig) + Vite 8** | Boring, proven, already implied by `package.json`; the only consequential new deps are `react`/`react-dom`. |
| 2 | **Zustand as the kernel store; defer RTK Query to the async/server tier only** | The store's `deriveState`-in-actions pattern would actively fight RTK's selector model — migrating buys nothing. |
| 3 | **Feature-based module structure** with `src/{types,data,lib,store}` as a shared, UI-free kernel | Each wizard step owns its panel, controls, and tests; engines never import React. |
| 4 | **`BalconyConfig` is the immutable atom, unchanged**; validity is *derived*, never stored on config | The config is a pure value object; the catalog gains physical-envelope metadata; a `Quote` aggregate wraps the config for the operator workflow. |
| 5 | **Formula-based pricing (same cost model) + a separate, rule-based, data-driven compatibility engine** | Pricing is arithmetic; compatibility is a sparse, product-line-specific relation best expressed as editable data. **Note: `calculatePrice` takes one scoped breaking change — its signature gains a `vat` argument (§5).** |
| 6 | **Tablet-first 3-pane operator console**: wizard rail / preview / always-visible live quote sidebar | Mirrors the proven legacy bottom-bar mental model; the price reacts visibly as the customer watches. |
| 7 | **Local-first persistence** (IndexedDB draft autosave) behind a `QuoteRepository` interface, HTTP adapter later | Reps quote offline in basements; the backend is a drop-in swap with zero component churn. |
| 8 | **WCAG 2.2 AA as architecture, not polish** | Keyboard-first wizard, focus management, live price region, `jest-axe` in CI, recoverable errors. |

**Invariants that must never break:** EUR-only display (`CurrencyCode` stays the `'EUR'` literal); dimensions in **cm** (the `Cm` suffix is load-bearing — convert to metres only at the engine boundary); prices stored **net**, VAT applied **once** at the end; **`calculatePrice` remains pure** (no I/O, no side effects, safe to call in render/derived state) — its *signature* changes (gains `vat`) but its purity does not; the **single authoritative VAT source is the market regime** (§4, §5), not a baked constant; catalog `Record<Enum, Spec>` exhaustiveness is the compile-time guard — extend enum and catalog together; the UI **consumes** `currentPrice`/`steps`/`validation` and **never recomputes** them.

**Two scoped kernel-contract changes (called out honestly, not hidden behind "verbatim"):**

1. **`calculatePrice(config)` → `calculatePrice(config, vat: VatRegime)`** — de-bakes the stale hard-coded VAT rate. This is a *breaking signature change* with a known, bounded blast radius (the store's `deriveState`, the M0 golden fixtures, and the server recompute), all sequenced in §5 and §9.
2. **`ConfiguratorState` gains a derived `validation: ValidationReport` and a `market: MarketContext` input** — the store now derives three things (`currentPrice`, `steps`, `validation`) and threads a market into `deriveState`. The full updated state shape is in §2.

Everything else in the kernel — the cost model, line ordering, inclusion policy, EPSILON rounding, `BalconyConfig` shape, catalog structure — is preserved exactly.

---

## 1. Tech Stack Decision

**Decision: React 18 + TypeScript 5.9 (strict, existing `tsconfig` unchanged) + Vite 8.** This matches the preferred stack and the dependencies already in `package.json` (`zustand ^5`, `three ^0.184`, `gsap ^3`, `swiper ^12`, `@phosphor-icons/web ^2`, `vite ^8`, `typescript ^5.9`, `prettier`, `eslint`). `react`/`react-dom` are genuinely absent today and are the only consequential new runtime additions.

### What we ADD (and why each earns its place)

All new dependencies are **version-pinned** in `package.json` (exact ranges below), not floating, so the engine bundle and the client build are reproducible. The new `devDependencies` (Vite React plugin, Vitest, Testing Library, axe, Playwright) sit alongside the existing minimal dev set; none replaces an existing tool.

| Dependency | Pin | Tier | Justification |
|---|---|---|---|
| `react`, `react-dom` | `^18.3` | Phase 1 | The only consequential new runtime deps. React 18 (not 19) — client-only SPA embedded in an Express-served page; no RSC need, and Zustand v5 is RSC-agnostic. |
| `@types/react`, `@types/react-dom` | `^18.3` | Phase 1 (dev) | Strict-mode types. |
| `@vitejs/plugin-react` | `^4` | Phase 1 (dev) | JSX/Fast-Refresh for the new Vite SPA config. |
| `zundo` | `^2.3` | Phase 1 | Undo/redo, partialized to `config` only (§2). ~700 B. |
| `idb-keyval` | `^6.2` | Phase 1 | Async IndexedDB draft persistence — survives reload, non-blocking. |
| `zod` | `^3.23` | Phase 1 | **Boundary only** — validates restored drafts and (later) API payloads. `noUncheckedIndexedAccess` protects compile-time shape, not runtime data from storage/network. Never used for in-app validation (the store owns that). |
| `@react-pdf/renderer` | `^4` | Phase 2 | Client-side quote PDF — works offline, deterministic, mirrors the pure-engine philosophy. |
| `vite-plugin-pwa` | `^0.20` | Phase 3 (dev) | Offline service worker (rep in a no-signal basement). |
| `@tanstack/react-query` | `^5` | Phase 3 | Async **server cache** only (saved-quotes list, catalog fetch, sync) — *not* config. |
| `vitest`, `@testing-library/react`, `jest-axe`, `@playwright/test` | current majors | Phase 1 (dev) | Engine golden-master tests, component unit tests, automated a11y, keyboard-only E2E. No test runner exists today, so these are net-new. |

### Deliberate NON-choices (stated explicitly — the strongest signal of scope discipline)

- **No Redux Toolkit for the kernel.** See §2. `@tanstack/react-query` (chosen over RTK Query to avoid pulling in the whole Redux runtime for a job-site tablet) is admitted only in the async tier, behind a repository interface, in Phase 3.
- **No component library (MUI/Chakra/Ant).** A 7-step configurator needs ~15 bespoke controls (RAL swatches, dimension steppers, spec cards). A design system would fight the existing `theme.css`/`components-v2.css` tokens and add bundle weight for little reuse. We ship hand-rolled, accessibility-hardened primitives.
- **No CSS-in-JS.** Plain CSS Modules (`*.module.css`) reuse the existing CSS custom properties; no runtime style engine.
- **No heavyweight router in Phase 1.** Wizard navigation already lives in the store via `ConfigStepId`/`STEP_ORDER`. A thin `useStepUrlSync` hook mirrors `currentStep` + a serialized config into the URL hash (zod-validated on open) for copy-link colleague handoff. Add `react-router-dom` only if the host app needs distinct `/quote/:id` routes.
- **No `react-hook-form` for the wizard body.** `updateConfig` is already the single mutation entry point with synchronous validity. RHF is reserved for the final free-text **customer-details** form (name/email/address) only.
- **Drop `swiper` from the critical path.** A wizard is not a carousel; a CSS scroll-snap row covers any future gallery without ~40 KB.
- **Three.js is lazy-loaded and code-split**, behind an always-available 2D SVG preview — it must never block first paint.

### Build topology

Two Vite configs coexist during migration: the existing `vite.three.config.js` (esbuild IIFE three bundle for the legacy path) stays until cutover; a new `vite.config.ts` builds the React SPA (`index.html` mounting `#root`). A **third, headless build — `build:engine` (§7)** — emits the pure engine as CommonJS for the server. Express (`server/server.js`) remains the host/API; the Vite dev server proxies `/api` to it; the production build emits to `public/app/` so existing static serving keeps working. `tsconfig` stays strict — we add `"jsx": "react-jsx"` and include the new `ui/` tree, and **do not relax** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, or `verbatimModuleSyntax`. All type imports use `import type`; absence is modeled as **omitted keys**, never `undefined`-valued props.

---

## 2. State Management Approach

**Decision: Zustand for the configurator kernel — extend `src/store/configuratorStore.ts`; reject migrating the kernel to Redux Toolkit. Reserve react-query for the async server/session tier only, behind a repository seam.**

### Why Zustand wins the kernel (anchored in *this* store, not generic preference)

1. **The hard part is already solved the Zustand way.** Every mutating action recomputes `currentPrice` + `steps` synchronously via `deriveState` and spreads them into `set()`. Consumers read derived state straight from the store — **no selectors, no `useEffect`, no memoization, no render tearing**. To reproduce this in RTK you would need `extraReducers` + reselect/`createSelector`, re-introducing exactly the selector layer this design deliberately eliminated.
2. **No async, no normalized entity graph, no cache inside one quote.** The truth is a single immutable `BalconyConfig` + two pure functions. RTK's headline features (`createAsyncThunk`, `createEntityAdapter`, RTK Query) target server-cache-heavy apps — overkill here.
3. **Purity belongs in derived state, not middleware.** `calculatePrice` and `evaluate` are pure, so they live in `deriveState`.
4. **Imperative consumers.** The Three.js visualizer is not a React tree; `useConfiguratorStore.subscribe(selector, cb)` and `getState()` wire it to config changes in one line.
5. **Bundle + ceremony.** Zustand is ~1 KB and the store is authored. RTK + react-redux is ~13 KB plus `Provider`/`configureStore`/typed hooks — wrong tax for a job-site tablet tool.

### The honest two-tier verdict

The Redux-vs-Zustand question is *"which problem,"* not *"which library."*

- **Tier 1 — the synchronous, pure-derived configurator document → Zustand** (the existing kernel).
- **Tier 2 — async server/session state → react-query** (Phase 3): saved-quotes list, catalog fetch from a CMS/backend, rep auth/session, sync. Cache invalidation, request dedup, optimistic updates, offline retry — the server-state problem Zustand makes you hand-roll.

**The seam rule (lint-enforced):** the async tier **never owns `config`**. It receives `config` as a payload at save time via a single `useConfiguratorStore(s => s.config)` read. If `config` ever leaks into the async store, you get dual sources of truth — the top maintenance hazard, so an ESLint `boundaries` rule forbids it.

### The updated store contract (the must-fix: `validation` and `market` now have a typed home)

`deriveState` now derives **three** things, all synchronously, and takes the **market** as an input so VAT flows through it. The `ConfiguratorState` shape is updated to hold the derived `validation` and the `market`:

```ts
// store/configuratorStore.ts — UPDATED state shape (types only)
export interface ConfiguratorState {
  readonly config: BalconyConfig;
  readonly currentStep: ConfigStepId;
  readonly completedSteps: readonly ConfigStepId[];
  readonly steps: readonly ConfigStep[];
  readonly currentPrice: PriceBreakdown;
  readonly validation: ValidationReport;   // NEW — derived by the compatibility engine (§5)
  readonly market: MarketContext;          // NEW — the active VAT regime + locale (the single VAT source)
}

// deriveState gains `market`; calculatePrice is now called WITH the regime:
const deriveState = (
  config: BalconyConfig,
  completedSteps: readonly ConfigStepId[],
  market: MarketContext,
): Pick<ConfiguratorState, 'steps' | 'currentPrice' | 'validation'> => ({
  steps: buildSteps(config, completedSteps),
  currentPrice: calculatePrice(config, market.vat),       // (config, vat) — §5
  validation: evaluate(config, CATALOG, market),          // compatibility engine — §5
});
```

**Bootstrap / module-load market (closes the "what market at line 213" gap).** The store is seeded at module load from a **default market constant** exported by `data/markets/fi.ts` — `DEFAULT_MARKET: MarketContext` — so derived state is fully populated synchronously before any React or persistence runs. There is never a moment where `currentPrice`/`validation` is absent or `undefined` under the strict, non-optional state shape:

```ts
import { DEFAULT_MARKET } from '../data/markets/fi';

export const useConfiguratorStore = create<ConfiguratorStore>()(/* middleware, below */ (set, get) => ({
  config: DEFAULT_CONFIG,
  currentStep: STEP_ORDER[0] ?? ConfigStepId.Dimensions,
  completedSteps: [],
  market: DEFAULT_MARKET,
  ...deriveState(DEFAULT_CONFIG, [], DEFAULT_MARKET),   // synchronous, complete at module load
  // ...actions thread get().market into every deriveState call
}));
```

A `setMarket(market)` action exists for the future multi-market tier; it re-runs `deriveState` so price/validation stay coherent. In Phase 1 the market is always `DEFAULT_MARKET`.

### Extending the kernel (additive middleware, composed around the store)

```ts
// store/configuratorStore.ts — composition order (types/shape only)
//   subscribeWithSelector( temporal( persist( storeImpl ) ) )
```

Under Zustand v5 + strict TS, this composition is a `create<ConfiguratorStore>()(...)` with a **curried** create call; each middleware's generic must be threaded so the action signatures survive. The three middlewares interact deliberately:

- **`zundo` temporal (undo/redo)** — `partialize` snapshots **`config` only** (never `currentPrice`/`steps`/`validation`/`market`, which would bloat history and risk desync). Dimension-slider drags are **debounced 300 ms** so dragging width produces **one** undo entry. On undo, derived state is **recomputed** via `deriveState(config, completedSteps, market)` — never restored from history.
- **`persist`** — custom IndexedDB storage adapter (idb-keyval), `partialize` persists `config` + `completedSteps` + draft metadata, **never derived state and never `market`** (the market is a runtime/config concern, not a saved-draft field). `version` + `migrate` repair drafts referencing a discontinued enum on rehydrate. **`onRehydrateStorage` re-runs `deriveState`** so `currentPrice`/`validation` are *recomputed from the rehydrated config against the current market* — they are never restored from disk. Because the store is seeded synchronously at module load (above) and persist hydrates asynchronously *into* an already-complete state, there is no window where a derived field is missing; rehydration only *replaces* `config`/`completedSteps` and then immediately re-derives.
- **`subscribeWithSelector`** — lets the Three.js preview and the GSAP price animation subscribe to narrow slices (`config.widthCm`, `currentPrice.total`) without re-rendering React.

### Store topology (clear ownership boundaries)

| Store | Lifetime | Owns |
|---|---|---|
| `useConfiguratorStore` | Durable (the quote) | `config`, `currentStep`, `completedSteps`, `market`, derived `steps`/`currentPrice`/`validation`, undo history |
| `useDraftsStore` | Durable (session) | Saved-draft list, active draft id, dirty flag, online/offline sync status, outbox queue |
| `useUiStore` | Ephemeral (chrome) | 3D camera (`'front'|'top'|'side'|'iso'`), panel collapse, toast queue, modal stack |

Chrome state never pollutes the quote or triggers a price recompute. Multi-draft concerns stay out of the single-config kernel.

---

## 3. Folder / Module Structure

**Decision: feature-based (workflow-based), not layer-based.** The existing `src/{types,data,lib,store}` is preserved as the **domain kernel**, imported by features; features never reach sideways into one another. An ESLint `boundaries` plugin enforces import direction: `features/*` may import `lib`/`data`/`types`/`store`/`domain`/`ui`/`app`; **`lib`/`data`/`types` may NOT import React or any `features/*`** — this keeps the engines pure and portable (and server-reusable, §7).

```
src/
  types/
    balcony.ts            # KERNEL model unchanged (BalconyConfig, PriceBreakdown, enums)
    constraints.ts        # NEW: Severity, ConstraintViolation, ValidationReport
    market.ts             # NEW: MarketContext, VatRegime (effective-dated)
    quote.ts              # NEW: Quote aggregate, CustomerDetails, QuoteStatus, QuoteMeta
  data/
    catalog.ts            # EXTENDED: Specs gain physical-envelope metadata (§4);
                          #   FINLAND_VAT_RATE REMOVED (its fate is decided in §4/§5)
    rules/                # MUST be included in build:engine (§7)
      compatibility.ts    # NEW: declarative incompatibility matrices (glazing×profile…)
      dimensional.ts      # NEW: per-profile max span / max glazed area (flagged)
      glass.ts            # NEW: glass weight budgets, thermal-mismatch hints
      index.ts            # NEW: ALL_RULES registry the engine interprets
    markets/              # MUST be included in build:engine (§7)
      fi.ts               # NEW: DEFAULT_MARKET + Finnish VAT regime (effective-dated)
  lib/
    pricingEngine.ts      # CHANGED signature: calculatePrice(config, vat) — pure, §5
    compatibilityEngine.ts# NEW pure peer: evaluate(config, catalog, market): ValidationReport
    money.ts              # NEW: Intl 'fi-FI' EUR formatting, net/gross helpers (UI-side only)
  store/
    configuratorStore.ts  # EXTENDED: +validation +market in state; +zundo +persist +subscribe
    draftsStore.ts        # NEW: multi-draft list, active id, sync/outbox
    uiStore.ts            # NEW: camera, panels, toasts, modal stack
  domain/                 # NEW: domain logic ABOUT the kernel, still UI-free
    quoteFactory.ts       # createQuote(...) / freezeQuote(...) — CONSTRUCTS the Quote
                          #   type defined in types/quote.ts (boundary named below)
    quoteSerialization.ts # zod schemas; draft<->storage, config<->URL hash, migrations
    quoteRepository.ts    # QuoteRepository interface (Local/Http impls live in features)
  app/
    main.tsx              # ReactDOM.createRoot(#root)
    App.tsx, AppShell.tsx # 3-pane operator console
    providers/            # ErrorBoundary, ToastProvider, A11yLiveRegion, ThemeProvider
    routing/useStepUrlSync.ts
  features/
    wizard/               # guided rail + step orchestration
      WizardRail.tsx, WizardStepHeader.tsx, WizardFooterNav.tsx
      useWizardNavigation.ts   # wraps store next/prev/goToStep + error gate
      steps/                   # one folder per ConfigStepId
        DimensionsStep/  StructureStep/  GlassStep/  RailingStep/
        AccessoriesStep/  InstallationStep/  SummaryStep/
    summary/              # the ALWAYS-VISIBLE live quote sidebar
      QuoteSidebar.tsx, PriceBreakdownList.tsx, PriceLineRow.tsx
      RunningTotal.tsx, VatToggle.tsx, ValidityBadge.tsx
    preview/
      PreviewStage.tsx        # chooses 2D vs 3D by device/perf
      Preview2D.tsx           # SVG façade elevation — ALWAYS available, offline-safe
      Preview3D.lazy.tsx      # code-split three.js, lazy + Suspense
      useBalconyVisualizerSync.ts  # store.subscribe -> imperative BalconyVisualizer
    validation/           # constraint UI: ViolationBanner, disabled-option affordances
    drafts/               # DraftsDrawer, DraftCard, SaveDraftButton, AutosaveIndicator
    quoteOutput/          # QuotePdfDocument, EmailQuoteDialog, ShareLinkDialog
    history/              # UndoRedoControls, UndoToast
    repository/           # LocalIndexedDbQuoteRepository, HttpQuoteRepository (Phase 3)
  ui/                     # a11y-hardened primitives (headless + styled)
    Button, ToggleCard, OptionGrid, Stepper, NumberStepperField, SwatchButton,
    SegmentedControl, Dialog (focus-trapped), Drawer, Toast, Tooltip,
    VisuallyHidden, LiveRegion, Skeleton
  hooks/                  # useMediaQuery, useFocusTrap, useRovingTabIndex,
                          # usePrefersReducedMotion, useHotkeys
  i18n/                   # fi (primary) / en / sv message catalogs
  styles/                 # tokens.css (reuse theme.css vars), reset, breakpoints
  test/
    pricing.golden.test.ts   # GOLDEN-MASTER (§9, §10) — parameterized by VAT regime
    compatibility.matrix.test.ts
    engine.parity.test.ts    # client bundle vs server build:engine artifact (§5, §7)
e2e/                      # Playwright keyboard-only full-wizard pass
```

**The `types/quote.ts` ↔ `domain/quoteFactory.ts` boundary (closes the drift risk).** There is exactly **one** `Quote` *type*, declared in `types/quote.ts`. `domain/quoteFactory.ts` holds **no second shape** — only constructors and transitions (`createQuote(config, customer, meta)`, `freezeQuote(draft): Quote`) that *return* that one type. The type is the data; the factory is the behaviour. ESLint forbids re-declaring `Quote` outside `types/`.

Test files co-locate (`*.test.tsx`) inside feature folders; `e2e/` lives at repo root. The legacy `public/js/*` and `public/configurator.html` remain untouched until cutover, then are deleted (§9). **Rule of thumb:** a feature owns its step panel, sub-controls, `*.module.css`, and tests; it imports *down* into `ui`/`hooks`/`domain`/kernel, never sideways.

---

## 4. Data Model

**Decision: `BalconyConfig` is the immutable, authoritative atom and is NOT changed. Validity is a DERIVED report, never stored on config. The extension happens in the CATALOG (which becomes a product-knowledge base) and in a new `Quote` aggregate that wraps the config for the operator workflow.**

### The kernel atom (unchanged — reproduced for reference)

`BalconyConfig` has 10 `readonly`, required fields: `widthCm`, `heightCm`, `depthCm` (cm), `profileSystem`, `glazingType`, `glassType`, `colorFinish`, `railing` (note: the field is `railing`, **not** `railingType`), `accessories: readonly AccessoryType[]` (no duplicates — store contract), `installationType`. The UI **never mutates config in place** — it only calls `updateConfig(patch)`. One mutation entry point, full stop.

**Modeling traps the UI must honor (verified in the type comments):**
- **`depthCm` is NON-pricing** — visualization/validation only. The summary sidebar never attributes a line to it (prevents rep confusion).
- **Glazed area = `widthCm × heightCm`** (FAÇADE area, not floor area) — a recurring misquoting source. `DimensionsStep` labels it *"Glazed façade area"* with a live `glazedAreaSqm` readout pulled straight from `currentPrice.glazedAreaSqm`.
- Catalog drives all option metadata: render grids from `Object.values(PROFILE_SYSTEMS)` etc. Swatches use `ColorFinishSpec.hex`; glass cards surface `uValue`; profile cards surface `thermallyBroken`. Because catalog is `Record<Enum, Spec>` exhaustive, a new enum member + catalog entry makes the option appear in the UI automatically and type-safely.

### The single authoritative VAT source (must-fix: kill the dual `0.24` / `0.255`)

Today VAT lives in **two** places that the rebuild collapses into **one**:
- `data/catalog.ts` exports `FINLAND_VAT_RATE = 0.24` (a hard constant, **already stale** — statutory Finnish rate rose to 25.5 % in Sept 2024).
- `PriceBreakdown.vatRate` is a *returned* field of the engine.

**Resolution — there is exactly one source of truth: `MarketContext.vat.rate`, declared in `data/markets/fi.ts`.**
- `FINLAND_VAT_RATE` is **deleted from `catalog.ts`**. The catalog no longer knows about VAT at all — VAT is a market concern, not a product-spec concern.
- The Finnish regime carries the **correct, effective-dated 25.5 %** rate.
- `PriceBreakdown.vatRate` is **not** a second source — it is a *recorded output*: the engine copies the passed `vat.rate` into the returned breakdown so a frozen quote remembers the rate that applied (see §5 for exactly how the engine populates it). `vatRate` is therefore *derived-from* the regime, never authoritative.

```ts
// data/markets/fi.ts — the ONE place a VAT number lives
export const FI_VAT_2024: VatRegime = {
  rate: 0.255,                 // statutory Finnish ALV since 2024-09-01
  label: 'ALV 25,5 %',
  effectiveFrom: '2024-09-01',
};
export const DEFAULT_MARKET: MarketContext = {
  locale: 'fi-FI',
  currency: 'EUR',
  vat: FI_VAT_2024,
};
```

### Catalog → product-knowledge base (the concrete net-new domain work)

The catalog carries `priceMultiplier`/`thermallyBroken`/`uValue`/`hex` but **no physical envelopes** (verified absent: `maxPaneWidthCm`, `weightKgPerSqm`, compatibility matrices). The compatibility engine reads these as **data**, so we extend the specs with `readonly` additive fields:

```ts
// data/catalog.ts — additive readonly fields (types only)
interface ProfileSystemSpec {
  // ...existing: id, name, description, priceMultiplier, pricePerSqmEur, thermallyBroken
  readonly maxPaneWidthCm: number;          // NEW per-profile pane-width limit
  readonly maxGlazedAreaSqm: number;        // NEW structural envelope
  readonly maxGlassWeightKgPerSqm: number;  // NEW weight budget for triple glazing
  readonly compatibleGlazing: readonly GlazingType[]; // NEW allow-list
}
interface GlassTypeSpec {
  // ...existing: id, name, description, surchargePerSqmEur, uValue
  readonly weightKgPerSqm: number;          // NEW — feeds the weight-budget rule
}
```

> **Sourcing caveat:** these thresholds are real engineering data only the manufacturer can supply. Ship the **thermal-mismatch rule live** (it needs *zero* new data — `thermallyBroken` + `uValue` already exist); keep **dimensional/weight rules behind a feature flag** until structural engineers sign off. If the manufacturer cannot supply thresholds, the flagged rules ship with **conservative placeholder envelopes** owned by a named product owner, and remain dark until validated — they never silently block valid quotes. Wrong rules are worse than none.

### Catalog versioning (closes the persistence-trust provenance gap)

`Quote.meta.catalogVersion` is real only if something stamps it. **`catalogVersion` is a build-time constant** exported from `catalog.ts` (`export const CATALOG_VERSION = '2026.06.0'`), bumped by a `version:catalog` script that hashes the catalog + rules modules and writes the stamp. Saved drafts store the version they were priced under; on load, if `CATALOG_VERSION` differs, the "prices updated since saved" notice (§7) fires. No historical catalog snapshots are kept in Phase 1 — drafts re-price against the *current* catalog (correct for a draft); only **sent** quotes freeze their breakdown (§7), so no snapshot store is needed.

### New types

```ts
// types/constraints.ts
type Severity = 'error' | 'warning' | 'info';

/** The enum-valued config fields the grey-out affordance applies to. Numeric
 *  (widthCm/heightCm/depthCm) and array (accessories) fields are deliberately
 *  EXCLUDED — "a disabled option value" is ill-defined for them. */
type ConstrainableField =
  | 'profileSystem' | 'glazingType' | 'glassType'
  | 'colorFinish' | 'railing' | 'installationType';

interface ConstraintViolation {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly messageKey: string;                       // i18n key, not baked English
  readonly offendingFields: readonly (keyof BalconyConfig)[];
  readonly suggestedFix?: Partial<BalconyConfig>;    // omit key when absent (exactOptionalPropertyTypes)
}
interface ValidationReport {
  readonly isBuildable: boolean;                     // no error-severity violations
  readonly violations: readonly ConstraintViolation[];
  // STRICT-TS-honest: a PARTIAL record over only the enum-valued fields, keyed by
  // the field's own enum value type — never the whole BalconyConfig keyset.
  readonly disabledOptions: Partial<{
    profileSystem: readonly ProfileSystem[];
    glazingType: readonly GlazingType[];
    glassType: readonly GlassType[];
    colorFinish: readonly ColorFinish[];
    railing: readonly RailingType[];
    installationType: readonly InstallationType[];
  }>;
}
```

`disabledOptions` is **`Partial<{…}>` over the six enum fields only**, with enum-typed values — not `Record<keyof BalconyConfig, readonly string[]>`. This is honest under `noUncheckedIndexedAccess` (reads are `T[] | undefined`, narrowed before use) and `exactOptionalPropertyTypes` (absent fields are *omitted*, never `undefined`-valued). Numeric and array fields, where "disabled option value" has no meaning, are structurally excluded.

```ts
// types/market.ts — VAT is a regime, not a constant
interface VatRegime {
  readonly rate: number;          // fraction, e.g. 0.255
  readonly label: string;         // "ALV 25,5 %"
  readonly effectiveFrom: string; // ISO date — effective-dating closes VAT-drift
}
interface MarketContext {
  readonly locale: string;        // 'fi-FI'
  readonly currency: CurrencyCode;// stays the 'EUR' literal until a 2nd market exists
  readonly vat: VatRegime;        // the single authoritative VAT source
}

// types/quote.ts — the operator-facing aggregate that wraps the kernel atom
type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'archived';
interface CustomerDetails {
  readonly name: string;
  readonly email?: string;        // omit when absent
  readonly phone?: string;
  readonly address?: string;
}
interface QuoteMeta {
  readonly quoteNumber: string;            // server-allocated sequence, e.g. "Q-2026-000123" (legal req.)
  readonly validUntil: string;             // ISO — quote validity period (legal req.)
  readonly status: QuoteStatus;
  readonly createdAt: string; readonly updatedAt: string;
  readonly repId: string;                  // attribution / audit
  readonly catalogVersion: string;         // re-price safely on load
  readonly acknowledgedOverrides: readonly string[]; // ruleIds of waived WARNINGS (installer audit)
  readonly schemaVersion: number;
  // NOTE: VAT rate is NOT duplicated here — it lives inside `price.vatRate`
  // (the frozen breakdown), the single recorded value. See below.
}
interface Quote {
  readonly id: string;            // uuid, also the draft key
  readonly config: BalconyConfig; // kernel snapshot
  readonly price: PriceBreakdown; // FROZEN at send time; price.vatRate is THE pinned rate
  readonly customer: CustomerDetails;
  readonly meta: QuoteMeta;
}
```

**VAT recorded once, not twice (consistency fix).** Earlier drafts pinned `vatRate` on both `Quote.meta` and inside `Quote.price`. That risks the two disagreeing on load. **`QuoteMeta` no longer carries `vatRate`** — the pinned rate is `price.vatRate` (a field the breakdown already has). One recorded value, no drift.

**Money rules in the UI:** money is always **net** in storage; the engine applies VAT once. `PriceBreakdown` carries both `subtotal` (net) and `total` (gross), so the **`VatToggle` flips the DISPLAY** between them with **zero recompute**. Line `id`s are stable (`'base'`, `'profile'`, `'glazing'`, `'glass'`, `'color-finish'`, `'railing'`, `'accessory-{id}'`, `'installation'`) and the UI honors the inclusion policy **verbatim**: always-shown structural lines (Base/Glass/Railing/Installation) render even at €0; conditional lines (Profile/Glazing/ColorFinish/Accessories) appear/disappear with an animated row transition so the customer *sees* the cost effect of each choice.

### Multi-opening quotes

A real wrap-around balcony is several façades priced together. `BalconyConfig` models a **single opening**; the `Quote` aggregate is designed to hold `readonly openings: readonly BalconyConfig[]` in Phase 2. Because `calculatePrice` bakes VAT into each opening's `total`, the combined math **discards per-opening VAT/total** and re-aggregates: `combinedSubtotal = round2(Σ calculatePrice(opening, vat).subtotal)`, then VAT applied **once** to that combined net subtotal via the same regime. Phase 1 ships a single opening (`openings.length === 1`) so the model is forward-compatible without front-loading UI complexity.

---

## 5. Pricing Engine Design

**Decision: RULE-BASED for VALIDITY, FORMULA-BASED for PRICE — two separate pure modules, both fully decoupled from the UI, composed in the store but never entangled with each other.**

### Pricing: same cost model, one scoped breaking signature change

The cost model is genuinely arithmetic (base × area; + profile multiplier; + glazing multiplier on base+profile; + glass/colour per-m²; + railing per-m; + accessories by pricing mode; + installation base+per-m²; → subtotal → VAT once → gross). A rules engine for pricing would be ceremony over multiplication. The line ordering, inclusion policy, and EPSILON cent-rounding are **unchanged**.

**The one scoped breaking change — de-bake VAT.** The engine currently hard-imports `FINLAND_VAT_RATE = 0.24`; the catalog itself notes the statutory rate rose to **25.5 %**. The shipped rate is therefore **already wrong** — a launch blocker for a contractual tool. This is **not** a "verbatim/unchanged" function: its **signature changes** and every caller is updated.

```ts
// lib/pricingEngine.ts — NEW signature (still pure: no I/O, no side effects)
export function calculatePrice(config: BalconyConfig, vat: VatRegime): PriceBreakdown
```

Inside the engine, the only change is the totals block: VAT now comes from the passed regime, and the regime's rate is **recorded into the returned breakdown** so a frozen quote remembers it:

```ts
const subtotal  = round2(lineItems.reduce((s, i) => s + i.amount, 0));
const vatAmount = round2(subtotal * vat.rate);   // was: subtotal * FINLAND_VAT_RATE
const total     = round2(subtotal + vatAmount);
return { lineItems, subtotal, vatRate: vat.rate, vatAmount, total, currency: CURRENCY, glazedAreaSqm };
//                          ^^^^^^^^^^^^^^^ this is how PriceBreakdown.vatRate is populated:
//                          a RECORDED OUTPUT copied from the regime, not a second source.
```

**Blast radius (sequenced honestly, not hand-waved as "surgical"):** this signature change ripples to exactly four places, all scheduled together at **M2** (§9): (a) the store's `deriveState` now calls `calculatePrice(config, market.vat)` and threads `market` (§2); (b) the M0 golden-master fixtures are **re-baselined / parameterized by VAT** (§9) so the 0.24 → 0.255 correction does not silently break the safety net; (c) the server-side recompute consumes the **same compiled engine** (§7); (d) any reader of `PriceBreakdown.vatRate` is unaffected because the field still exists with the same meaning. `FINLAND_VAT_RATE` is deleted (§4).

We adopt the parameterization **now**; we **defer** the full multi-market/multi-currency tier (widening `CurrencyCode`, per-market product subsets) as YAGNI — `CurrencyCode` stays the `'EUR'` literal.

### Compatibility: a rule-based, data-driven pure peer (the central new contribution)

`lib/compatibilityEngine.ts` exports `evaluate(config, catalog, market): ValidationReport` — pure, deterministic, mirroring the pricing engine's purity, so it is equally safe to call in derived state and **reusable server-side** for "validate-before-quote."

**Rules are DATA, not imperative `if`-chains** — product/sales-ops can edit constraints without touching engine code; the engine is the interpreter. **The interpreter contract is single-access (consistency fix): every rule's `test` receives the config, the catalog, and the market, and reads catalog data exclusively through the passed `catalog` argument.** The module-level `getProfileSystem`/`getGlassType` helpers are convenience accessors *over that same `catalog`* and are **not** closed over independently — so the engine has one access path, the `catalog` param is never dead, and a server bundle that passes a different catalog snapshot still works:

```ts
// data/rules/* — declarative, table-testable
type CompatibilityMatrix = Readonly<Record<GlazingType, readonly ProfileSystem[]>>;
interface Rule {
  readonly id: string;
  readonly severity: Severity;
  readonly messageKey: string;
  readonly fields: readonly (keyof BalconyConfig)[];
  /** true = violated. Reads catalog data ONLY through `cat`. */
  readonly test: (c: BalconyConfig, cat: Catalog, m: MarketContext) => boolean;
  readonly fix?: Partial<BalconyConfig>;
}
```

**Seed rules** (every catalog read goes through `cat`):
1. **Thermal mismatch** (DATA-FREE, ships live) — `!cat.profile(c.profileSystem).thermallyBroken && cat.glass(c.glassType).uValue < 1.5` → *warning* ("premium glass wasted on a cold frame"), `fix: { profileSystem: AluminumThermal }`.
2. **Glazing/profile compatibility** — `!cat.profile(c.profileSystem).compatibleGlazing.includes(c.glazingType)` → *error* (e.g. frameless on cold aluminium).
3. **Span / structure** (flagged) — `c.widthCm > cat.profile(c.profileSystem).maxPaneWidthCm` → *error*, `fix: { profileSystem: SteelReinforced }`.
4. **Glass weight budget** (flagged) — `cat.glass(c.glassType).weightKgPerSqm > cat.profile(c.profileSystem).maxGlassWeightKgPerSqm` → *error*.
5. **Accessory fit** — e.g. frameless + mosquito-net → *error*.

**`disabledOptions` computed proactively (the Schüco-grade affordance):** for each of the six enum fields, the engine evaluates which candidate values *would* violate a rule given the rest of the config, and returns them in the `Partial<{…}>` map (§4). The UI greys out those `OptionCard`s and **explains why in the accessible name** ("Frameless — unavailable with cold aluminium profile") instead of letting a rep build an impossible quote then erroring.

**Correct recomputation strategy (replaces the broken perf short-circuit).** `disabledOptions`/validation is **recomputed on every `updateConfig`, including numeric-dimension changes** — because dimensional and weight rules (seed rules 3 & 4) depend directly on `widthCm` and dimension-derived area, skipping them on dimension change would suppress exactly those violations. Performance comes from the work being pure and O(fields × candidates × rules) with tiny constants (6 fields, ≤6 candidates, single-digit rules), not from skipping it. Only the **3D visualizer sync** is debounced on slider drags — never the price/validation passes.

**Severity tiers with audited override:**
- **ERRORS** hard-block `nextStep`/quote-send (wired through `useWizardNavigation` guards) and gate the primary CTA.
- **WARNINGS** surface inline but allow an **acknowledged override**, recorded on `Quote.meta.acknowledgedOverrides`, so installers see exactly what the rep waived.
- `suggestedFix: Partial<BalconyConfig>` makes an **"Apply fix"** button literally `updateConfig(violation.suggestedFix)` — one-click resolution, zero bespoke handler code.

### Separation diagram (in prose)

```
Catalog data (Record<Enum,Spec> + rules/* + markets/*)  ── read-only ──┐
                                                                       ▼
        ┌──────────────────────────┐    ┌──────────────────────────────┐
        │  pricingEngine.ts        │    │  compatibilityEngine.ts      │
        │  calculatePrice(c, vat)  │    │  evaluate(c, catalog, market)│
        │  PURE · formula          │    │  PURE · rule-based           │
        └────────────┬─────────────┘    └──────────────┬───────────────┘
                     │ (neither imports the other; neither imports React)
                     ▼                                  ▼
        ┌────────────────────────────────────────────────────────────┐
        │  configuratorStore.ts · deriveState(config, completed, mkt)│
        │  → { currentPrice, validation, steps }  (synchronous)      │
        └───────────────────────────────┬────────────────────────────┘
                                         │ read narrow slices
                                         ▼
        ┌────────────────────────────────────────────────────────────┐
        │  React UI (features/*) — DUMB controls: read slice,        │
        │  call ONE action (updateConfig / next / prev / goTo / reset)│
        └───────────────────────────────┬────────────────────────────┘
                                         │ store.subscribe (outside React)
                                         ▼
                          Three.js visualizer (imperative)
```

`UI → store → {pricing engine, compatibility engine} → catalog`. The engines never know React exists; React never recomputes what the store derives; pricing never reads constraints and vice versa.

### Determinism contract for server re-validation (made a HARD rule)

Because the server recomputes the contractual price (§7), the determinism contract is only real if **both environments execute the SAME compiled engine artifact** — never a re-implementation. **Hard rule: the server `require`s the `build:engine` output (§7); it MUST NOT re-derive pricing in JS.** Given that, identical `round2(value + Number.EPSILON)` cent-rounding and identical line-summation order are *guaranteed because it is literally the same code*. The `engine.parity.test.ts` fixture runs a representative config matrix through the engine in Node (the artifact) and in the browser bundle and asserts **identical arithmetic fields** of `PriceBreakdown` (`subtotal`, `vatRate`, `vatAmount`, `total`, per-line `amount`).

**Scope of the determinism claim (corrected):** the guarantee covers the **arithmetic engine only**. It explicitly **excludes** `Intl`/ICU-dependent *formatting* in `money.ts` — `Intl.NumberFormat('fi-FI', …)` output can differ between the Node ICU build and a browser's ICU, so formatting runs **client-side only** and the server PDF formats from the recomputed numeric breakdown using a pinned formatter. We never assert "byte-identical formatted strings" across environments — only identical *numbers*.

---

## 6. Component Hierarchy

**Decision: a tablet-first 3-pane operator console** — guided wizard rail (left), visual preview (center), an **always-visible live quote sidebar** (right) — re-expressing the proven legacy `.app-bottom-bar` mental model for the linear 7-step TS model. Every interactive control is **dumb**: it reads one narrow store slice and calls exactly one action; no component holds quote state in `useState` (local state is allowed only for transient UI like mid-typing input strings or popover open flags).

```
<App>
└─ <AppShell> ........................ role landmarks scaffold
   ├─ <TopBar> ....................... (header)
   │    ├─ <DraftSwitcher/> .......... active quote name + drafts drawer trigger
   │    ├─ <AutosaveIndicator/> ...... "Saved 2s ago" / "Offline — saved locally"
   │    ├─ <UndoRedoControls/> ....... ⌘Z/⌘⇧Z, disabled-state from zundo temporal store
   │    └─ <ShareMenu/> .............. PDF / Email / Copy link
   ├─ <WorkspaceGrid> ............... CSS grid: [rail | preview | sidebar]
   │  ├─ <WizardRail> ............... <nav aria-label="Configuration steps">
   │  │   └─ <StepTab> ×7 ........... from store.steps; isComplete ✓ / isValid /
   │  │                              aria-current="step"; goToStep on click (free nav);
   │  │                              error dot if a constraint ERROR touches this step
   │  ├─ <StepPanelRegion> ......... <main>; focus moves here on step change
   │  │   ├─ <WizardStepHeader/> .... tabindex=-1, "Step 3 of 7 — Glass & finish"
   │  │   ├─ <StepRouter/> .......... renders the active step body by currentStep:
   │  │   │   ├─ <DimensionsStep> ... 3× <NumberStepperField> (DIMENSION_LIMITS),
   │  │   │   │                       live "Glazed façade area", big touch +/- steppers
   │  │   │   ├─ <StructureStep> .... <OptionGrid> ProfileSystem (thermallyBroken badge,
   │  │   │   │                       €/m²) + GlazingType cards; disabled+explained via
   │  │   │   │                       validation.disabledOptions; <ViolationBanner>
   │  │   │   ├─ <GlassStep> ........ GlassType cards (uValue, surcharge) +
   │  │   │   │                       ColorFinish <SwatchButton> grid (hex from catalog)
   │  │   │   ├─ <RailingStep> ...... RailingType cards (€/m)
   │  │   │   ├─ <AccessoriesStep> .. multi-select ToggleCards via toggleAccessory action
   │  │   │   │                       (dedupe invariant lives in the action, not callers)
   │  │   │   ├─ <InstallationStep> . InstallationType cards (base + per-m² breakdown)
   │  │   │   └─ <SummaryStep> ...... full review + <CustomerDetailsForm> (RHF) + CTAs
   │  │   └─ <WizardFooterNav/> ..... Back (prevStep) / Next (nextStep); Next disabled
   │  │                              unless current.isValid && validation.isBuildable;
   │  │                              aria-describedby → the blocking ViolationBanner
   │  ├─ <PreviewStage> ............ <section aria-label="Balcony preview">
   │  │   ├─ <Preview2D/> .......... SVG front elevation — ALWAYS rendered, instant,
   │  │   │                          offline-safe; reflects width/height/glazing/railing
   │  │   └─ <Preview3D.lazy/> ..... three.js, Suspense; toggle; never blocks first paint;
   │  │                             useBalconyVisualizerSync bridges store.subscribe →
   │  │                             BalconyVisualizer.requestUpdate()
   │  └─ <QuoteSidebar> ............ <aside aria-label="Price quote"> — ALWAYS VISIBLE
   │      ├─ <ValidityBadge/> ...... ✓ Ready to quote / ⚠ warnings / ✕ errors
   │      ├─ <PriceBreakdownList/> . maps currentPrice.lineItems → <PriceLineRow>
   │      │                          grouped by PriceCategory; €0 structural lines greyed;
   │      │                          animated row enter/leave (the SALES feature)
   │      ├─ <VatToggle/> .......... net (subtotal) ↔ gross (total) DISPLAY only, no recompute
   │      └─ <RunningTotal/> ....... GSAP count-up on total change; net + VAT + gross
   └─ <Overlays>
       ├─ <DraftsDrawer/> <EmailQuoteDialog/> <ShareLinkDialog/> <PdfPreviewDialog/>
       ├─ <UndoToast/> <ToastViewport/> <ResetConfirmDialog/>
       └─ <A11yLiveRegion/> ........ one polite + one assertive region, app-wide
```

**Accessory mutation contract (closes the dedup-invariant gap).** The store gains a dedicated **`toggleAccessory(id: AccessoryType)`** action that owns the no-duplicate invariant (`set` ↔ array round-trip), so `AccessoriesStep` and the "Apply fix" path never compute the deduped array themselves. `updateConfig` (which merges a patch wholesale) is **not** used for single-accessory toggles; the step validator's `Set`-size check remains the backstop. This keeps the kernel's "accessories has no duplicates" guarantee true regardless of call site.

The `QuoteSidebar` and the active step panel subscribe to the **same store**, so a selection updates the sidebar **in the same React commit** — no syncing, no prop drilling. On mobile the sidebar collapses into a persistent bottom price bar with a swipe-up breakdown sheet — the legacy bottom-bar pattern reps already know.

---

## 7. API / Persistence Strategy

**Decision: local-state-first and offline-capable, backed by a single `QuoteRepository` interface so a real backend is a drop-in swap with zero component churn. The store is the in-browser source of truth; persistence is a thin adapter, never a second copy of the data.**

### The repository seam

```ts
// domain/quoteRepository.ts
interface QuoteRepository {
  list(): Promise<QuoteSummary[]>;
  load(id: string): Promise<Quote>;
  save(q: Quote): Promise<void>;
  remove(id: string): Promise<void>;
}
```

| Phase | Implementation | Notes |
|---|---|---|
| 1 | `LocalIndexedDbQuoteRepository` (idb-keyval) | Autosave-resume; survives reload; non-blocking. |
| 3 | `HttpQuoteRepository` → fetch/react-query | Same interface; swap via one provider line; components unchanged. |

All payloads cross the boundary through `quoteSerialization.ts` **zod** schemas (the only place zod runs in-app), with `schemaVersion` + migrations so an old draft or server row rehydrates safely under the strict tsconfig.

### Price-trust over time

- **Persist `config` + `catalogVersion` + market id — NEVER the derived `PriceBreakdown` as source of truth** for editable drafts. On load, re-derive price by feeding the loaded config through the **single sanctioned path** (`updateConfig` / `deriveState`), so a stale price can never reach a customer. If `CATALOG_VERSION` (§4) moved since the draft was saved, show a **"prices updated since saved"** notice.
- **FREEZE the `PriceBreakdown` snapshot on SENT/accepted quotes.** The installer must see the contract exactly as quoted; `Quote.price` (including its `price.vatRate`) is immutable once `status` is `'sent'`/`'accepted'`. **This immutability is enforced at the DB layer, not just by `readonly` types** (§ below) — TypeScript `readonly` is a compile-time courtesy, not a runtime guarantee.

### Offline-first

`vite-plugin-pwa` caches the app shell + catalog. Because the pricing and compatibility engines are pure and the catalog is cached, a rep in a no-signal basement can **build, validate, price, save a draft, and generate a PDF entirely client-side** (`@react-pdf/renderer`). Offline edits queue in `draftsStore`'s **outbox** with a dirty flag; on reconnect they flush. **Copy-link sharing** serializes config into a compact, zod-validated **URL hash** for instant colleague handoff with zero backend.

**Sync conflict policy (named, not silently LWW).** Phase 1 is single-rep, single-device → last-write-wins is correct. The moment `HttpQuoteRepository` + multi-device lands (M5), LWW silently loses edits, so **every `Quote` carries `meta.updatedAt`** and the M5 sync uses **optimistic-concurrency**: the server rejects a save whose `updatedAt` is older than the stored row (HTTP 409), and the client surfaces a "this quote changed elsewhere" merge prompt. Designed in now, enforced at M5.

### Server-side trust boundary (the single most important correctness idea)

For a real quote tool, **the backend never trusts the client's price.** On save/order it recomputes from the submitted config using the **same compiled `calculatePrice`** — the client total is display-only; the server total is contractual; the server PDF renders off the recomputed breakdown.

**The integration gap — and how we close it.** The kernel is strict ESM (`verbatimModuleSyntax`, `import type`) but `server/server.js` is **CommonJS** (`require`), and there is **no `/api/quotes` endpoint** (only `/api/orders`, `/api/materials`, `/api/request-call`). "Isomorphic `calculatePrice`" is therefore **not a free one-liner**. Concretely:

1. **`build:engine` — a dedicated CJS bundle of `src/lib` + `src/data` (INCLUDING `data/rules/*` AND `data/markets/*`), emitted to `server/engine/` and `require`d by the server.** This is a hard requirement, not an aside: without the rules and markets, the server's `evaluate()` would diverge from the client and the server's VAT (from the market regime) would be wrong. A naive `tsc` with the existing tsconfig (`noEmit: true`, `module: ESNext`) cannot emit CJS, so `build:engine` is a **separate esbuild/tsc config** (`format: 'cjs'`, type-stripping that honors `verbatimModuleSyntax`/`isolatedModules`). The engines' zero React/IO dependencies make this a clean, dependency-free bundle. **The server consumes this artifact only — it never re-implements the engine** (the determinism hard rule, §5).
2. **Add the quote endpoints and SQLite table** (`POST /api/quotes`, `GET /api/quotes/:id`) — net-new server work, behind the auth model below, with `helmet` already present.
3. **Quote submission flow:** rep completes `SummaryStep` → client sends `{ config, customer, repId }` (**NOT** the price) → server recomputes price via the bundled engine + re-runs `evaluate()` (rejects an unbuildable config) → allocates a **`quoteNumber`** (below), sets **`validUntil`**, persists to SQLite, generates the legal PDF, and emails the customer via the existing `nodemailer` flow.

**The `/api/orders` reuse is a TRANSFORM, not a drop-in (corrected).** The existing `orders.js` uses a legacy schema (`clientName`, `balconySize` as a single number, `materials[]`, **client-supplied `totalPrice`** with zero recompute). The new quote is **not** mapped onto it. Instead: the measurement-request CTA keeps using `/api/orders` unchanged; the new **`POST /api/quotes`** is a *separate* endpoint with its own SQLite table and **server recompute**, and a small `quoteToOrderPayload(quote)` adapter is written **only** for the legacy measurement-request hand-off. We do not pour a server-recomputed quote through a client-trusting legacy route.

### Quote-number sequence & frozen-price enforcement (open product decisions, named not hidden)

- **`quoteNumber` allocation is transactional.** Format `Q-{year}-{6-digit zero-padded}` resetting yearly. Under SQLite, allocation runs inside a single serialized write transaction against a `quote_sequence` counter row (`UPDATE … RETURNING`), so concurrent reps never collide. The exact reset/format policy is flagged as an **open product decision**; the concurrency mechanism is fixed.
- **Frozen-price immutability is DB-enforced.** Once a row's `status` is `'sent'`/`'accepted'`, a SQLite trigger (or an application-level write guard on the quotes table) **rejects any UPDATE to the price columns**. No admin endpoint can mutate a sent quote's price. `readonly` in TS is necessary but not sufficient.

### Authorization, rep identity & audit (sized as a milestone, not a footnote)

The existing `adminGuard` is a **shared admin token**, not a rep-identity model. A per-rep auth model — token issuance, `repId` attribution, rep-sees-own vs admin-sees-all — is a **real backend project**, scoped as its own milestone (M5), and is a **prerequisite before `HttpQuoteRepository` ships**. Until then, Phase-1/2 quotes live locally with a locally-set `repId`; no PII leaves the device over an unauthenticated channel.

### PII / GDPR (named risk with a concrete mitigation seam)

`CustomerDetails` (name/email/phone/address) is persisted to IndexedDB on a potentially **shared sales tablet** and emailed via `nodemailer`, for a Finnish **B2C** sale — a real compliance surface. Mitigations, seamed in from Phase 1:
- **Retention seam:** drafts older than a configurable window (default 90 days) are auto-purged from IndexedDB by a startup sweep; **right-to-erasure** is a `repository.remove(id)` call wired to a "delete customer data" action.
- **Consent:** the `CustomerDetailsForm` carries an explicit consent checkbox before any PII is stored or emailed; consent state is recorded on the quote.
- **Device hygiene:** PII fields are stored under a separate IndexedDB key from `config` so a "clear customer data" action can wipe PII while keeping the (non-personal) configuration draft; a shared-tablet "end session" control flushes the PII store. Full encryption-at-rest is deferred to the M5 auth milestone (where a rep session key exists), but the *seam* (separate PII store + purge + erasure) ships in Phase 1.

### Quote-document legal content

The PDF/email quote is a legal artifact for a Finnish B2C sale and must carry: a **quote number**, an itemized **VAT line** at the pinned `price.vatRate`, the seller's **business ID (Y-tunnus)** and contact, a **valid-until** date, terms, and an acceptance/signature affordance. The PDF is **tagged/accessible** (§8) with a plain-text email fallback.

### Observability (production instrument, not a toy)

A daily field tool needs failure telemetry. A thin `reportError(scope, error)` seam logs **offline-save failures, sync 409s, PDF-generation failures, and engine-bundle load errors** — to the console + an in-app toast in Phase 1, and to a real sink (e.g. a `/api/telemetry` endpoint) when the backend tier lands. No silent failures on a tool that produces contracts.

---

## 8. Accessibility & Responsive Layout

**Decision: WCAG 2.2 AA as architecture, not a closing checklist.** This is a daily professional tool used by keyboard operators at desks and installers on tablets in bright sun; a11y correctness is a productivity requirement. `jest-axe` runs in CI on every component; a Playwright keyboard-only pass drives the full wizard happy path.

### Keyboard & semantics

- **Wizard rail** is a real `<nav>`; each `<StepTab>` exposes `aria-current="step"` on the active one and surfaces `isValid`/`isComplete` via text + icon (never colour alone). Free navigation matches the store's `goToStep`.
- **Step panels** are `<fieldset>`/`<legend>` groups; on step change, focus moves programmatically to the `<WizardStepHeader>` (`tabindex=-1`) and the polite live region announces *"Step 3 of 7, Glass & finish."*
- **Option grids** (profile, glazing, glass, RAL, railing, installation) are `role="radiogroup"` with **roving tabindex** and `aria-checked` — picking an option is one arrow-key press, not a tab-hunt. **Accessories** are an `aria-multiselectable` group of checkbox toggles. A **constraint-disabled** card is `aria-disabled` with the reason in its accessible name ("Frameless — unavailable with cold aluminium") — never silently removed, so the rep learns the product rules.
- **`WizardFooterNav` Next** is a real `<button disabled>` when `!isValid || !isBuildable`, with `aria-describedby` pointing at the blocking `ViolationBanner` so screen-reader users hear *why* it's blocked.
- **Dialogs/Drawers** reuse the project's existing focus-trap + Esc-close; focus returns to the trigger on close.

### Live feedback & input

- A **single debounced polite live region** announces the running total after each config change (*"Total now 4 820 euros including VAT"*) — the price effect of every choice is perceivable non-visually, which matters because the 3D canvas conveys nothing to AT. Constraint **errors** announce **assertively**.
- **`NumberStepperField`** pairs a typed input with big +/- steppers, both bound to `DIMENSION_LIMITS`, with `inputmode="numeric"`, visible min/max, `aria-valuemin/max/now`, and a unit suffix in the accessible name ("Width, centimetres").
- **Recoverable errors, never dead-ends:** an out-of-range dimension shows the limit and a one-tap **"set to max (800 cm)"** fix; a rehydrated draft referencing a retired catalog option shows a non-blocking **"this option was retired — pick a replacement"** prompt instead of crashing under strict types.

### Colour, contrast, motion

- RAL swatches carry RAL code + name text and a checked ring/checkmark — never colour-only. Validity uses icon + text. All text ≥ 4.5:1 against the existing token palette; focus-visible rings (already in `theme.css`) on every interactive element.
- `prefers-reduced-motion` degrades the GSAP price count-up and line-item row transitions to **instant**.
- The PDF is tagged/accessible; the email has a plain-text fallback.

### Responsive plan (tablet-first — the rep's primary device)

| Breakpoint | Layout |
|---|---|
| **Tablet 768–1180 px (PRIMARY, landscape iPad in-home)** | Full 3-pane grid `[280px rail \| 1fr preview \| 360px sidebar]`; targets ≥ 48×48 px; sticky footer Back/Next; **no hover-only affordances** (tap-first). |
| **Desktop ≥ 1180 px (office requoting)** | Wider rail with step labels + descriptions; sidebar can pin the breakdown expanded; keyboard shortcuts surfaced. |
| **Mobile < 768 px (installer spot-check)** | Single column; rail becomes a horizontal scrollable `<Stepper>`; preview collapses to a tappable thumbnail; **QuoteSidebar becomes a persistent bottom price bar** with a swipe-up breakdown sheet. |

Layout uses **logical CSS properties** + a fluid `clamp()` type scale so it survives **200 % zoom / OS text scaling without horizontal scroll** (WCAG 1.4.10 reflow), and RTL markets get correct layout for free once i18n lands. Orientation changes are non-destructive (state lives in the store). The 3D canvas is strictly lazy/code-split behind the always-available 2D SVG elevation, so it never blocks first paint or starves a mid-range tablet GPU.

---

## 9. Build Sequence / Milestones

Each milestone is independently shippable; the kernel model is reused throughout. The legacy `public/js/*` stays live until **M4 cutover**, then is deleted.

- **M0 — Safety net (½ week).** Add `pricing.golden.test.ts` (golden-master snapshot pinning current `calculatePrice` outputs across a representative config matrix) **before any rebuild work**. **Because M2 changes the VAT signature and rate, the golden fixtures are authored from day one as parameterized by `VatRegime` and assert primarily on the stable NET fields (`subtotal`, per-line `amount`)**; gross/VAT assertions are computed from the regime, so the M2 correction *re-derives* the expected grosses instead of silently invalidating the suite. Add `engine.parity.test.ts` (client bundle vs `build:engine` artifact). Stand up the Vite React config + ESLint `boundaries` plugin.
- **M1 — Walking skeleton (1–2 weeks).** `AppShell` 3-pane grid; wire all 7 step panels to `updateConfig`/`toggleAccessory`/`nextStep`/`prevStep`/`goToStep`; render the live `QuoteSidebar` from `currentPrice`. Catalog-as-UI-source for every option grid. **Outcome:** a fully usable quote wizard on top of the existing store.
- **M2 — Validity engine + VAT correction (1–2 weeks).** `compatibilityEngine.ts` + `data/rules/*` with the **thermal-mismatch rule live** (data-free) and dimensional/weight rules **behind a flag**. `disabledOptions` grey-out, `ViolationBanner`, "Apply fix", acknowledged-override audit. **De-bake VAT: change `calculatePrice(config)` → `calculatePrice(config, vat)`; delete `FINLAND_VAT_RATE`; introduce `data/markets/fi.ts` with the statutory 25.5 % regime; thread `market` through `deriveState` and add `validation`/`market` to `ConfiguratorState`; re-baseline the golden grosses against the new regime.** This is the milestone that absorbs the full signature-change blast radius (§5).
- **M3 — Operator workflow (2 weeks).** Local IndexedDB autosave + `DraftsDrawer`; `zundo` undo/redo; `persist` with re-derive-on-rehydrate; `VatToggle`; copy-link URL-hash sharing; client-side PDF; **PII store separation + retention sweep + erasure action**; a11y hardening + `jest-axe` in CI + Playwright keyboard pass; 2D SVG preview, lazy 3D.
- **M4 — Cutover (1 week, price-trust scope only).** `build:engine` CJS bundle of `src/lib` + `src/data` **including `rules/*` and `markets/*`**; add `POST /api/quotes` + `GET /api/quotes/:id` + SQLite quotes table + `quote_sequence` counter + frozen-price DB guard; server-side recompute (consuming the artifact) + legal PDF; `quoteToOrderPayload` adapter for the measurement-request hand-off **only**. Switch the `/configurator` route to the React build; **feature-parity checklist + one-redeploy rollback window**. *(Rep auth is NOT in this milestone — see M5.)*
- **M5 — Backend tier (fast-follow).** **Rep identity/auth model** (token issuance, `repId` attribution, rep-vs-admin permissions) — the prerequisite for `HttpQuoteRepository`; then `HttpQuoteRepository`; optimistic-concurrency sync (409 + merge prompt) + offline outbox; PWA; telemetry sink. Multi-opening quotes; CMS-driven catalog with zod boundary validation.

---

## 10. Key Risks & Mitigations

1. **Over-trusting the legacy UI as a spec.** The shipped vanilla app is a *different* product model. → Legacy is reference for layout/visualizer wiring **only**; the TS domain is the contract.
2. **Compatibility thresholds are invented domain knowledge.** Wrong span/weight rules block valid quotes or pass invalid ones. → Ship the data-free thermal rule live; keep dimensional/weight rules **behind a flag** with conservative placeholders and a named product owner until structural engineers sign off; version the rule set.
3. **ESM/CJS engine integration.** The "isomorphic price" boundary is not free. → `build:engine` (separate CJS config emitting `lib` + `data` **incl. rules + markets**) is a first-class M4 task; the server consumes the artifact only (§5/§7 hard rule).
4. **VAT correctness/drift — now structurally impossible.** The old 0.24 was stale. → `FINLAND_VAT_RATE` is **deleted**; the **only** VAT number lives in `data/markets/fi.ts` (25.5 %, effective-dated); `PriceBreakdown.vatRate` is a recorded output, `Quote.price.vatRate` is the single pinned value. No two rates can disagree.
5. **Signature-change blast radius.** `calculatePrice(config, vat)` ripples to the store, golden fixtures, and server. → Fully sequenced at M2; golden fixtures parameterized by VAT (M0) so the correction never disables the safety net.
6. **Client/server cent divergence.** → Both run the **same compiled engine artifact**; `engine.parity.test.ts` asserts identical arithmetic; formatting (`Intl`/ICU) is client-only and never asserted byte-identical.
7. **Two-tier state seam leak.** `config` leaking into the async tier → dual truth. → ESLint `boundaries` forbids it; the async tier receives config only as a save-time payload.
8. **Undo/redo desync.** → `zundo` partialized to `config` only; debounced slider drags; re-derive on undo.
9. **Async rehydration leaving derived state absent.** Persist hydrates asynchronously while `currentPrice`/`validation` are non-optional. → Store is seeded synchronously at module load from `DEFAULT_MARKET`; `onRehydrateStorage` *re-derives* (never restores) derived fields; there is no window where a derived field is missing.
10. **Price-recompute-per-keystroke jank.** `deriveState` runs pricing **and** compatibility on every tick. → Both passes are pure and O(small); **validation/`disabledOptions` is recomputed on dimension changes too** (seed rules 3 & 4 depend on `widthCm` — skipping it would suppress real violations); only the **visualizer** sync is debounced.
11. **Three.js budget.** → Always-available 2D SVG safety net; 3D strictly lazy/code-split.
12. **Strictness friction.** `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. → `ui/` primitives encapsulate the guards once; `disabledOptions` is `Partial<{…}>` over enum fields (no over-promised `Record<keyof BalconyConfig>`); absence modeled as omitted keys.
13. **PII / GDPR on shared tablets.** CustomerDetails in IndexedDB + emailed, Finnish B2C. → Separate PII store, consent gate, retention sweep, erasure action from Phase 1; encryption-at-rest at M5 with rep sessions.
14. **quoteNumber concurrency & price tampering.** → Transactional `quote_sequence` allocation; DB-level frozen-price guard on sent/accepted quotes (not just `readonly`).
15. **Accessory dedup invariant.** New multi-select UI + "Apply fix" could break the no-duplicate guarantee. → A dedicated `toggleAccessory` action owns the invariant; `updateConfig` is never used for single-accessory toggles.
16. **Sync conflict loss at multi-device.** LWW silently loses edits once `HttpQuoteRepository` lands. → `meta.updatedAt` + optimistic-concurrency (409 + merge prompt) designed now, enforced at M5.
17. **Scope sprawl.** → Every workflow feature is an independently-shippable fast-follow behind the `QuoteRepository`/engine seams; M1 ships a complete quoting tool first.
18. **Migration regression on a live tool.** → M4 feature-parity checklist, the `quoteToOrderPayload` transform (not a drop-in), and a one-redeploy rollback window.
