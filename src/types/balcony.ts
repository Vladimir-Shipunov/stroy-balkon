/**
 * @file Core domain types for the balcony configurator.
 *
 * This module is the single source of truth for the shape of a balcony
 * configuration, the priced breakdown produced from it, and the wizard steps
 * the user walks through. Everything is strictly typed — no `any`, no implicit
 * widening — so the catalog, pricing engine and store can rely on exhaustive
 * checks at compile time.
 *
 * All monetary values are expressed in euros (EUR) as plain numbers. All
 * physical dimensions are expressed in **centimetres** and carry a `Cm` suffix
 * to make the unit unmistakable at every call site.
 */

/* -------------------------------------------------------------------------- */
/*  Enumerations                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Glazing construction style — how the glass panes are held and how they open.
 *
 * - `Frameless`      — vertical glass panels with no vertical mullions (premium).
 * - `SemiFrameless`  — slim top/bottom rails, no vertical frames between panes.
 * - `Framed`         — every pane sits in a full perimeter frame (most economical).
 * - `Sliding`        — panes slide horizontally on tracks.
 */
export enum GlazingType {
  Frameless = 'frameless',
  SemiFrameless = 'semi-frameless',
  Framed = 'framed',
  Sliding = 'sliding',
}

/**
 * Structural profile system — the load-bearing framing the glazing is built on.
 * Drives the area-based base price via a multiplier (see the pricing engine).
 *
 * - `AluminumCold`     — basic aluminium, no thermal break (unheated balconies).
 * - `AluminumThermal`  — thermally broken ("warm") aluminium for year-round use.
 * - `SlimAluminum`     — minimal-sightline aluminium, premium architectural look.
 * - `PVC`              — uPVC profiles, budget-friendly and low maintenance.
 * - `SteelReinforced`  — steel-reinforced profiles for tall or exposed openings.
 */
export enum ProfileSystem {
  AluminumCold = 'aluminum-cold',
  AluminumThermal = 'aluminum-thermal',
  SlimAluminum = 'slim-aluminum',
  PVC = 'pvc',
  SteelReinforced = 'steel-reinforced',
}

/**
 * Glass specification. Affects price (surcharge per m²) and thermal performance.
 *
 * - `Clear`   — standard clear float glass (baseline, no surcharge).
 * - `Tinted`  — solar-tinted glass to reduce glare and heat gain.
 * - `Frosted` — obscured/satin glass for privacy.
 * - `LowE`    — low-emissivity coated insulated glass.
 * - `Triple`  — triple-glazed insulated unit, best thermal performance.
 */
export enum GlassType {
  Clear = 'clear',
  Tinted = 'tinted',
  Frosted = 'frosted',
  LowE = 'low-e',
  Triple = 'triple',
}

/**
 * Frame/profile colour finish. Each value maps to a RAL (or anodised) code and
 * an upcharge per m² in the catalog. Standard white is included at no extra cost.
 */
export enum ColorFinish {
  WhiteRal9016 = 'white-ral9016',
  SilverRal9006 = 'silver-ral9006',
  AnthraciteRal7016 = 'anthracite-ral7016',
  BlackRal9005 = 'black-ral9005',
  BronzeRal8019 = 'bronze-ral8019',
  Custom = 'custom-ral',
}

/**
 * Railing / balustrade type fitted at the balcony edge. Priced per linear metre
 * of balcony width.
 */
export enum RailingType {
  Glass = 'glass',
  Steel = 'steel',
  Aluminum = 'aluminum',
  Wood = 'wood',
}

/**
 * Optional add-ons. Pricing mode (flat / per m² / per linear metre) is defined
 * per accessory in the catalog.
 */
export enum AccessoryType {
  MosquitoNet = 'mosquito-net',
  Blinds = 'blinds',
  Ventilation = 'ventilation',
  Drainage = 'drainage',
}

/**
 * Installation service tier.
 *
 * - `SelfAssembly`          — customer collects and installs; no labour cost.
 * - `StandardInstallation`  — professional fit of the new glazing.
 * - `PremiumInstallation`   — includes removal of the old structure, sealing
 *                             and interior finishing.
 */
export enum InstallationType {
  SelfAssembly = 'self-assembly',
  StandardInstallation = 'standard-installation',
  PremiumInstallation = 'premium-installation',
}

/* -------------------------------------------------------------------------- */
/*  Configuration                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A complete, valid-by-construction balcony configuration. Every field is
 * required so the pricing engine never has to guess a default.
 *
 * Dimensions are in centimetres. The glazed façade area used for pricing is
 * `widthCm × heightCm`; `depthCm` describes the floor depth and is used for
 * visualisation and validation rather than glazing area.
 */
export interface BalconyConfig {
  /** Façade width in centimetres (the opening to be glazed). */
  readonly widthCm: number;
  /** Glazing height in centimetres (floor to header). */
  readonly heightCm: number;
  /** Floor depth in centimetres (front to building wall). */
  readonly depthCm: number;
  /** Structural framing system. */
  readonly profileSystem: ProfileSystem;
  /** Glazing construction style. */
  readonly glazingType: GlazingType;
  /** Glass specification. */
  readonly glassType: GlassType;
  /** Frame colour finish. */
  readonly colorFinish: ColorFinish;
  /** Edge railing / balustrade type. */
  readonly railing: RailingType;
  /** Selected optional accessories (may be empty, never contains duplicates). */
  readonly accessories: readonly AccessoryType[];
  /** Installation service tier. */
  readonly installationType: InstallationType;
}

/* -------------------------------------------------------------------------- */
/*  Pricing                                                                   */
/* -------------------------------------------------------------------------- */

/** ISO 4217 currency code. The catalog is priced exclusively in euros. */
export type CurrencyCode = 'EUR';

/**
 * The cost component a {@link PriceLineItem} belongs to. Used by the UI to
 * group, label and colour-code the breakdown.
 */
export enum PriceCategory {
  Base = 'base',
  Profile = 'profile',
  Glazing = 'glazing',
  Glass = 'glass',
  ColorFinish = 'color-finish',
  Railing = 'railing',
  Accessory = 'accessory',
  Installation = 'installation',
}

/** The unit a line item's quantity is measured in. */
export enum PriceUnit {
  /** Square metres of glazed façade. */
  SquareMeter = 'm²',
  /** Linear metres (e.g. railing along the width). */
  LinearMeter = 'm',
  /** Discrete pieces. */
  Piece = 'pcs',
  /** A single flat charge with no meaningful quantity. */
  Flat = 'flat',
}

/**
 * One itemised entry in the price breakdown. `amount` always equals
 * `quantity × unitPrice`, rounded to whole cents.
 */
export interface PriceLineItem {
  /** Stable identifier, unique within a breakdown (e.g. `'glass'`). */
  readonly id: string;
  /** Human-readable label for display (e.g. `'Triple glazing'`). */
  readonly label: string;
  /** Cost component this entry belongs to. */
  readonly category: PriceCategory;
  /** Quantity in `unit` (e.g. number of m²). */
  readonly quantity: number;
  /** Unit of measurement for `quantity`. */
  readonly unit: PriceUnit;
  /** Price per unit in EUR. */
  readonly unitPrice: number;
  /** Line total in EUR (`quantity × unitPrice`, rounded to cents). */
  readonly amount: number;
}

/**
 * Fully itemised price breakdown produced by the pricing engine.
 *
 * `subtotal` is the sum of all `lineItems[].amount` (net of VAT). `total` is
 * `subtotal + vatAmount`. All figures are rounded to whole cents.
 */
export interface PriceBreakdown {
  /** Every priced component, in display order. */
  readonly lineItems: readonly PriceLineItem[];
  /** Net total before VAT, in EUR. */
  readonly subtotal: number;
  /** VAT rate as a fraction (e.g. `0.24` for 24%). */
  readonly vatRate: number;
  /** VAT amount in EUR (`subtotal × vatRate`, rounded to cents). */
  readonly vatAmount: number;
  /** Gross total including VAT, in EUR. */
  readonly total: number;
  /** Currency of all monetary fields. */
  readonly currency: CurrencyCode;
  /** Glazed façade area in m² the breakdown was computed from. */
  readonly glazedAreaSqm: number;
}

/* -------------------------------------------------------------------------- */
/*  Wizard steps                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Identifier for a step in the configurator wizard. The ordering of the enum
 * does not define navigation order — see `STEP_ORDER` in the store.
 */
export enum ConfigStepId {
  Dimensions = 'dimensions',
  Structure = 'structure',
  Glass = 'glass',
  Railing = 'railing',
  Accessories = 'accessories',
  Installation = 'installation',
  Summary = 'summary',
}

/**
 * The runtime state of a single wizard step, derived from the current
 * configuration and the user's progress.
 */
export interface ConfigStep {
  /** Which step this is. */
  readonly id: ConfigStepId;
  /** Display label for the step navigation. */
  readonly label: string;
  /** Whether the user has visited and advanced past this step. */
  readonly isComplete: boolean;
  /** Whether the current configuration satisfies this step's requirements. */
  readonly isValid: boolean;
}
