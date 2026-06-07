/**
 * @file Static product catalog for the balcony configurator.
 *
 * Holds every selectable option together with the data the pricing engine and
 * the UI need: display names, descriptions, prices and physical metadata.
 * Prices reflect realistic 2024–2025 Finnish / Northern-European balcony
 * glazing market values, in EUR and **net of VAT**.
 *
 * The catalog is exposed as exhaustive `Record<Enum, Spec>` maps. Because the
 * keys are the enum members themselves, adding a new enum value is a compile
 * error until its catalog entry is supplied — there is no way to forget one.
 */

import {
  AccessoryType,
  ColorFinish,
  type CurrencyCode,
  GlassType,
  GlazingType,
  InstallationType,
  PriceUnit,
  ProfileSystem,
  RailingType,
} from '../types/balcony';

/* -------------------------------------------------------------------------- */
/*  Global constants                                                          */
/* -------------------------------------------------------------------------- */

/** Currency every price in this catalog is denominated in. */
export const CURRENCY: CurrencyCode = 'EUR';

/**
 * Base construction price per m² of glazed façade, in EUR. This covers the
 * baseline structure (carriers, seals, fixings, clear glass) before the profile
 * system multiplier, glazing-style multiplier and any glass/finish surcharges.
 */
export const BASE_PRICE_PER_SQM_EUR = 280;

/**
 * Finnish standard VAT rate as a fraction, per the project specification (24%).
 *
 * Centralised here so it can be updated in one place. Note: the statutory
 * Finnish standard rate rose to 25.5% in Sept 2024; update this constant if the
 * configurator must reflect the current statutory rate.
 */
export const FINLAND_VAT_RATE = 0.24;

/* -------------------------------------------------------------------------- */
/*  Profile systems                                                           */
/* -------------------------------------------------------------------------- */

/** Catalog entry describing a structural profile system. */
export interface ProfileSystemSpec {
  readonly id: ProfileSystem;
  readonly name: string;
  readonly description: string;
  /**
   * Multiplier applied to the area-based base price. `1.0` means "priced at the
   * base rate"; `1.55` means "+55% over the base rate".
   */
  readonly priceMultiplier: number;
  /**
   * Indicative effective material rate per m², shown in the UI. Equals
   * `BASE_PRICE_PER_SQM_EUR × priceMultiplier`, rounded — informational only;
   * the engine computes from `priceMultiplier`.
   */
  readonly pricePerSqmEur: number;
  /** Whether the system has a thermal break (suitable for heated balconies). */
  readonly thermallyBroken: boolean;
}

/** Helper to keep the indicative per-m² rate in sync with the multiplier. */
const ratedProfile = (
  id: ProfileSystem,
  name: string,
  description: string,
  priceMultiplier: number,
  thermallyBroken: boolean,
): ProfileSystemSpec => ({
  id,
  name,
  description,
  priceMultiplier,
  pricePerSqmEur: Math.round(BASE_PRICE_PER_SQM_EUR * priceMultiplier),
  thermallyBroken,
});

/** All profile systems, keyed by {@link ProfileSystem}. */
export const PROFILE_SYSTEMS: Record<ProfileSystem, ProfileSystemSpec> = {
  [ProfileSystem.AluminumCold]: ratedProfile(
    ProfileSystem.AluminumCold,
    'Cold aluminium',
    'Lightweight non-insulated aluminium framing for unheated balconies.',
    1.0,
    false,
  ),
  [ProfileSystem.AluminumThermal]: ratedProfile(
    ProfileSystem.AluminumThermal,
    'Thermally broken aluminium',
    'Insulated "warm" aluminium framing suitable for year-round use.',
    1.55,
    true,
  ),
  [ProfileSystem.SlimAluminum]: ratedProfile(
    ProfileSystem.SlimAluminum,
    'Slimline aluminium',
    'Minimal-sightline aluminium profiles for a premium architectural look.',
    1.85,
    true,
  ),
  [ProfileSystem.PVC]: ratedProfile(
    ProfileSystem.PVC,
    'uPVC',
    'Low-maintenance uPVC profiles offering good insulation at a lower cost.',
    0.9,
    true,
  ),
  [ProfileSystem.SteelReinforced]: ratedProfile(
    ProfileSystem.SteelReinforced,
    'Steel-reinforced',
    'Steel-reinforced profiles for tall, wide or wind-exposed openings.',
    1.35,
    false,
  ),
};

/* -------------------------------------------------------------------------- */
/*  Glazing styles                                                            */
/* -------------------------------------------------------------------------- */

/** Catalog entry describing a glazing construction style. */
export interface GlazingSpec {
  readonly id: GlazingType;
  readonly name: string;
  readonly description: string;
  /** Multiplier applied to the structural subtotal (base + profile). */
  readonly priceMultiplier: number;
}

/** All glazing styles, keyed by {@link GlazingType}. */
export const GLAZING_TYPES: Record<GlazingType, GlazingSpec> = {
  [GlazingType.Frameless]: {
    id: GlazingType.Frameless,
    name: 'Frameless glazing',
    description: 'Vertical glass panels with no mullions for an unobstructed view.',
    priceMultiplier: 1.25,
  },
  [GlazingType.SemiFrameless]: {
    id: GlazingType.SemiFrameless,
    name: 'Semi-frameless glazing',
    description: 'Slim top and bottom rails with frameless vertical joints.',
    priceMultiplier: 1.1,
  },
  [GlazingType.Framed]: {
    id: GlazingType.Framed,
    name: 'Framed glazing',
    description: 'Each pane sits in a full perimeter frame — the economical choice.',
    priceMultiplier: 1.0,
  },
  [GlazingType.Sliding]: {
    id: GlazingType.Sliding,
    name: 'Sliding glazing',
    description: 'Horizontally sliding panels on low-friction tracks.',
    priceMultiplier: 1.15,
  },
};

/* -------------------------------------------------------------------------- */
/*  Glass types                                                               */
/* -------------------------------------------------------------------------- */

/** Catalog entry describing a glass specification. */
export interface GlassTypeSpec {
  readonly id: GlassType;
  readonly name: string;
  readonly description: string;
  /** Surcharge per m² of glazed area over clear glass, in EUR. */
  readonly surchargePerSqmEur: number;
  /** Indicative thermal transmittance (U-value) in W/m²K — lower is better. */
  readonly uValue: number;
}

/** All glass types, keyed by {@link GlassType}. */
export const GLASS_TYPES: Record<GlassType, GlassTypeSpec> = {
  [GlassType.Clear]: {
    id: GlassType.Clear,
    name: 'Clear glass',
    description: 'Standard clear float glass with maximum light transmission.',
    surchargePerSqmEur: 0,
    uValue: 5.7,
  },
  [GlassType.Tinted]: {
    id: GlassType.Tinted,
    name: 'Tinted glass',
    description: 'Solar-tinted glass that cuts glare and reduces heat gain.',
    surchargePerSqmEur: 18,
    uValue: 5.6,
  },
  [GlassType.Frosted]: {
    id: GlassType.Frosted,
    name: 'Frosted glass',
    description: 'Obscured satin glass for privacy while keeping daylight.',
    surchargePerSqmEur: 22,
    uValue: 5.7,
  },
  [GlassType.LowE]: {
    id: GlassType.LowE,
    name: 'Low-E insulated glass',
    description: 'Low-emissivity coated double unit for better heat retention.',
    surchargePerSqmEur: 45,
    uValue: 1.1,
  },
  [GlassType.Triple]: {
    id: GlassType.Triple,
    name: 'Triple glazing',
    description: 'Triple-glazed insulated unit with the best thermal performance.',
    surchargePerSqmEur: 95,
    uValue: 0.6,
  },
};

/* -------------------------------------------------------------------------- */
/*  Colour finishes                                                           */
/* -------------------------------------------------------------------------- */

/** Catalog entry describing a frame colour finish. */
export interface ColorFinishSpec {
  readonly id: ColorFinish;
  readonly name: string;
  /** RAL classic code, anodised reference, or `'custom'`. */
  readonly ralCode: string;
  /** Hex preview colour for the UI swatch. */
  readonly hex: string;
  /** Upcharge per m² of glazed area, in EUR. Standard white is free. */
  readonly upchargePerSqmEur: number;
}

/** All colour finishes, keyed by {@link ColorFinish}. */
export const COLOR_FINISHES: Record<ColorFinish, ColorFinishSpec> = {
  [ColorFinish.WhiteRal9016]: {
    id: ColorFinish.WhiteRal9016,
    name: 'Traffic white',
    ralCode: 'RAL 9016',
    hex: '#F1F0EA',
    upchargePerSqmEur: 0,
  },
  [ColorFinish.SilverRal9006]: {
    id: ColorFinish.SilverRal9006,
    name: 'White aluminium',
    ralCode: 'RAL 9006',
    hex: '#A5A5A5',
    upchargePerSqmEur: 14,
  },
  [ColorFinish.AnthraciteRal7016]: {
    id: ColorFinish.AnthraciteRal7016,
    name: 'Anthracite grey',
    ralCode: 'RAL 7016',
    hex: '#383E42',
    upchargePerSqmEur: 12,
  },
  [ColorFinish.BlackRal9005]: {
    id: ColorFinish.BlackRal9005,
    name: 'Jet black',
    ralCode: 'RAL 9005',
    hex: '#0A0A0A',
    upchargePerSqmEur: 16,
  },
  [ColorFinish.BronzeRal8019]: {
    id: ColorFinish.BronzeRal8019,
    name: 'Bronze',
    ralCode: 'RAL 8019',
    hex: '#403A3A',
    upchargePerSqmEur: 20,
  },
  [ColorFinish.Custom]: {
    id: ColorFinish.Custom,
    name: 'Custom RAL colour',
    ralCode: 'custom',
    hex: '#7C6F64',
    upchargePerSqmEur: 30,
  },
};

/* -------------------------------------------------------------------------- */
/*  Railings                                                                  */
/* -------------------------------------------------------------------------- */

/** Catalog entry describing a railing / balustrade type. */
export interface RailingSpec {
  readonly id: RailingType;
  readonly name: string;
  readonly description: string;
  /** Price per linear metre of balcony width, in EUR. */
  readonly pricePerMeterEur: number;
}

/** All railing types, keyed by {@link RailingType}. */
export const RAILINGS: Record<RailingType, RailingSpec> = {
  [RailingType.Glass]: {
    id: RailingType.Glass,
    name: 'Glass railing',
    description: 'Toughened glass balustrade with stainless fixings.',
    pricePerMeterEur: 220,
  },
  [RailingType.Steel]: {
    id: RailingType.Steel,
    name: 'Steel railing',
    description: 'Powder-coated steel railing, robust and low maintenance.',
    pricePerMeterEur: 140,
  },
  [RailingType.Aluminum]: {
    id: RailingType.Aluminum,
    name: 'Aluminium railing',
    description: 'Lightweight corrosion-resistant aluminium railing.',
    pricePerMeterEur: 120,
  },
  [RailingType.Wood]: {
    id: RailingType.Wood,
    name: 'Wood railing',
    description: 'Treated timber railing for a warm, natural appearance.',
    pricePerMeterEur: 160,
  },
};

/* -------------------------------------------------------------------------- */
/*  Accessories                                                               */
/* -------------------------------------------------------------------------- */

/**
 * How an accessory is priced:
 * - `Flat`        — single fixed charge regardless of size.
 * - `PerSqm`      — multiplied by the glazed façade area.
 * - `PerMeter`    — multiplied by the balcony width in metres.
 */
export type AccessoryPricingMode = PriceUnit.Flat | PriceUnit.SquareMeter | PriceUnit.LinearMeter;

/** Catalog entry describing an optional accessory. */
export interface AccessorySpec {
  readonly id: AccessoryType;
  readonly name: string;
  readonly description: string;
  /** Price expressed in the unit implied by {@link pricingMode}, in EUR. */
  readonly price: number;
  /** How {@link price} scales with the configuration. */
  readonly pricingMode: AccessoryPricingMode;
}

/** All accessories, keyed by {@link AccessoryType}. */
export const ACCESSORIES: Record<AccessoryType, AccessorySpec> = {
  [AccessoryType.MosquitoNet]: {
    id: AccessoryType.MosquitoNet,
    name: 'Mosquito net',
    description: 'Retractable insect screen fitted to the opening.',
    price: 85,
    pricingMode: PriceUnit.Flat,
  },
  [AccessoryType.Blinds]: {
    id: AccessoryType.Blinds,
    name: 'Integrated blinds',
    description: 'Pleated sun blinds mounted on the glazing, priced per m².',
    price: 45,
    pricingMode: PriceUnit.SquareMeter,
  },
  [AccessoryType.Ventilation]: {
    id: AccessoryType.Ventilation,
    name: 'Trickle ventilation',
    description: 'Controllable trickle vents for background airflow.',
    price: 130,
    pricingMode: PriceUnit.Flat,
  },
  [AccessoryType.Drainage]: {
    id: AccessoryType.Drainage,
    name: 'Drainage channel',
    description: 'Aluminium drainage channel along the sill, priced per metre.',
    price: 28,
    pricingMode: PriceUnit.LinearMeter,
  },
};

/* -------------------------------------------------------------------------- */
/*  Installation tiers                                                        */
/* -------------------------------------------------------------------------- */

/** Catalog entry describing an installation service tier. */
export interface InstallationSpec {
  readonly id: InstallationType;
  readonly name: string;
  readonly description: string;
  /** Fixed call-out / mobilisation cost, in EUR. */
  readonly baseCostEur: number;
  /** Labour cost per m² of glazed area, in EUR. */
  readonly costPerSqmEur: number;
}

/** All installation tiers, keyed by {@link InstallationType}. */
export const INSTALLATION_TYPES: Record<InstallationType, InstallationSpec> = {
  [InstallationType.SelfAssembly]: {
    id: InstallationType.SelfAssembly,
    name: 'Self-assembly',
    description: 'Collect and install yourself — no labour charge.',
    baseCostEur: 0,
    costPerSqmEur: 0,
  },
  [InstallationType.StandardInstallation]: {
    id: InstallationType.StandardInstallation,
    name: 'Standard installation',
    description: 'Professional fitting of the new glazing by our team.',
    baseCostEur: 250,
    costPerSqmEur: 55,
  },
  [InstallationType.PremiumInstallation]: {
    id: InstallationType.PremiumInstallation,
    name: 'Premium installation',
    description: 'Removal of the old structure, fitting, sealing and finishing.',
    baseCostEur: 450,
    costPerSqmEur: 85,
  },
};

/* -------------------------------------------------------------------------- */
/*  Aggregate + typed lookups                                                 */
/* -------------------------------------------------------------------------- */

/** The complete catalog, grouped by domain. Convenient for UI enumeration. */
export const CATALOG = {
  profileSystems: PROFILE_SYSTEMS,
  glazingTypes: GLAZING_TYPES,
  glassTypes: GLASS_TYPES,
  colorFinishes: COLOR_FINISHES,
  railings: RAILINGS,
  accessories: ACCESSORIES,
  installationTypes: INSTALLATION_TYPES,
} as const;

/** Look up the spec for a profile system. */
export const getProfileSystem = (id: ProfileSystem): ProfileSystemSpec => PROFILE_SYSTEMS[id];
/** Look up the spec for a glazing style. */
export const getGlazing = (id: GlazingType): GlazingSpec => GLAZING_TYPES[id];
/** Look up the spec for a glass type. */
export const getGlassType = (id: GlassType): GlassTypeSpec => GLASS_TYPES[id];
/** Look up the spec for a colour finish. */
export const getColorFinish = (id: ColorFinish): ColorFinishSpec => COLOR_FINISHES[id];
/** Look up the spec for a railing type. */
export const getRailing = (id: RailingType): RailingSpec => RAILINGS[id];
/** Look up the spec for an accessory. */
export const getAccessory = (id: AccessoryType): AccessorySpec => ACCESSORIES[id];
/** Look up the spec for an installation tier. */
export const getInstallation = (id: InstallationType): InstallationSpec => INSTALLATION_TYPES[id];
