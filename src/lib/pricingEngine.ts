/**
 * @file Pricing engine for the balcony configurator.
 *
 * Exposes a single pure function, {@link calculatePrice}, that turns a
 * {@link BalconyConfig} into a fully itemised {@link PriceBreakdown}. The
 * function has no side effects, performs no I/O, and is fully deterministic:
 * the same input always yields the same output. This makes it trivial to unit
 * test and safe to call from a render/derived-state context.
 *
 * ## Pricing model (all amounts net of VAT, in EUR)
 *
 * 1. **Base construction** — `glazedArea × BASE_PRICE_PER_SQM_EUR`.
 * 2. **Profile system** — base × `(profile.priceMultiplier − 1)`.
 * 3. **Glazing style** — `(base + profile) × (glazing.priceMultiplier − 1)`.
 * 4. **Glass surcharge** — `glazedArea × glass.surchargePerSqmEur`.
 * 5. **Colour finish** — `glazedArea × finish.upchargePerSqmEur`.
 * 6. **Railing** — `widthMetres × railing.pricePerMeterEur`.
 * 7. **Accessories** — per accessory, by its pricing mode (flat / per m² / per m).
 * 8. **Installation** — `install.baseCostEur + glazedArea × install.costPerSqmEur`.
 *
 * The `subtotal` is the sum of all line items; VAT is then applied at the
 * Finnish rate to produce the gross `total`.
 *
 * ### Line inclusion policy
 * Structural components that are always part of a build — base construction,
 * glass, railing and installation — are always emitted, even at €0, so the
 * customer sees exactly what was selected. Optional surcharges (profile and
 * glazing multipliers, colour upcharge, accessories) are emitted only when they
 * contribute a non-zero amount.
 */

import {
  type BalconyConfig,
  PriceCategory,
  type PriceBreakdown,
  type PriceLineItem,
  PriceUnit,
} from '../types/balcony';
import {
  BASE_PRICE_PER_SQM_EUR,
  CURRENCY,
  FINLAND_VAT_RATE,
  getAccessory,
  getColorFinish,
  getGlassType,
  getGlazing,
  getInstallation,
  getProfileSystem,
  getRailing,
} from '../data/catalog';

/** Round a monetary amount to whole cents, avoiding binary-float drift. */
const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** Convert a centimetre measurement to metres. */
const cmToMeters = (cm: number): number => cm / 100;

/**
 * Build a {@link PriceLineItem}, computing `amount` as `quantity × unitPrice`
 * rounded to cents. Keeps every line internally consistent.
 */
const makeLine = (
  id: string,
  label: string,
  category: PriceCategory,
  quantity: number,
  unit: PriceUnit,
  unitPrice: number,
): PriceLineItem => ({
  id,
  label,
  category,
  quantity: round2(quantity),
  unit,
  unitPrice: round2(unitPrice),
  amount: round2(quantity * unitPrice),
});

/**
 * Compute the glazed façade area in m² from a configuration. Returns `0` for
 * non-positive or non-finite dimensions so the engine never produces NaN or
 * negative prices.
 */
export function calculateGlazedArea(config: BalconyConfig): number {
  const widthM = cmToMeters(config.widthCm);
  const heightM = cmToMeters(config.heightCm);
  if (!Number.isFinite(widthM) || !Number.isFinite(heightM) || widthM <= 0 || heightM <= 0) {
    return 0;
  }
  return round2(widthM * heightM);
}

/**
 * Calculate a full, itemised price breakdown for a balcony configuration.
 *
 * Pure and deterministic — see the module docs for the cost model.
 *
 * @param config - A complete balcony configuration.
 * @returns The itemised {@link PriceBreakdown}, including VAT.
 *
 * @example
 * ```ts
 * const breakdown = calculatePrice(config);
 * console.log(breakdown.total); // gross price incl. 24% VAT
 * ```
 */
export function calculatePrice(config: BalconyConfig): PriceBreakdown {
  const glazedAreaSqm = calculateGlazedArea(config);
  const widthMeters = Math.max(0, cmToMeters(config.widthCm));

  const profile = getProfileSystem(config.profileSystem);
  const glazing = getGlazing(config.glazingType);
  const glass = getGlassType(config.glassType);
  const finish = getColorFinish(config.colorFinish);
  const railing = getRailing(config.railing);
  const installation = getInstallation(config.installationType);

  const lineItems: PriceLineItem[] = [];

  /* 1. Base construction — always shown. */
  const baseAmount = glazedAreaSqm * BASE_PRICE_PER_SQM_EUR;
  lineItems.push(
    makeLine(
      'base',
      'Base construction',
      PriceCategory.Base,
      glazedAreaSqm,
      PriceUnit.SquareMeter,
      BASE_PRICE_PER_SQM_EUR,
    ),
  );

  /* 2. Profile system multiplier — shown only when it adds cost. */
  const profileAmount = baseAmount * (profile.priceMultiplier - 1);
  if (round2(profileAmount) !== 0) {
    lineItems.push(
      makeLine(
        'profile',
        `Profile system — ${profile.name}`,
        PriceCategory.Profile,
        glazedAreaSqm,
        PriceUnit.SquareMeter,
        BASE_PRICE_PER_SQM_EUR * (profile.priceMultiplier - 1),
      ),
    );
  }

  /* 3. Glazing-style multiplier on (base + profile) — shown only when non-zero. */
  const structuralSubtotal = baseAmount + profileAmount;
  const glazingAmount = structuralSubtotal * (glazing.priceMultiplier - 1);
  if (round2(glazingAmount) !== 0) {
    const glazingUnitPrice = glazedAreaSqm > 0 ? glazingAmount / glazedAreaSqm : 0;
    lineItems.push(
      makeLine(
        'glazing',
        `${glazing.name}`,
        PriceCategory.Glazing,
        glazedAreaSqm,
        PriceUnit.SquareMeter,
        glazingUnitPrice,
      ),
    );
  }

  /* 4. Glass specification — always shown (communicates the chosen glass). */
  lineItems.push(
    makeLine(
      'glass',
      glass.name,
      PriceCategory.Glass,
      glazedAreaSqm,
      PriceUnit.SquareMeter,
      glass.surchargePerSqmEur,
    ),
  );

  /* 5. Colour finish upcharge — shown only when it adds cost. */
  if (finish.upchargePerSqmEur > 0 && glazedAreaSqm > 0) {
    lineItems.push(
      makeLine(
        'color-finish',
        `Finish — ${finish.name} (${finish.ralCode})`,
        PriceCategory.ColorFinish,
        glazedAreaSqm,
        PriceUnit.SquareMeter,
        finish.upchargePerSqmEur,
      ),
    );
  }

  /* 6. Railing — always shown, priced per linear metre of width. */
  lineItems.push(
    makeLine(
      'railing',
      railing.name,
      PriceCategory.Railing,
      widthMeters,
      PriceUnit.LinearMeter,
      railing.pricePerMeterEur,
    ),
  );

  /* 7. Accessories — one line each, scaled by the accessory's pricing mode. */
  for (const accessoryId of config.accessories) {
    const accessory = getAccessory(accessoryId);
    const { quantity, unit } = resolveAccessoryQuantity(
      accessory.pricingMode,
      glazedAreaSqm,
      widthMeters,
    );
    lineItems.push(
      makeLine(
        `accessory-${accessory.id}`,
        accessory.name,
        PriceCategory.Accessory,
        quantity,
        unit,
        accessory.price,
      ),
    );
  }

  /* 8. Installation — always shown (base call-out + per-m² labour). */
  const installationAmount = installation.baseCostEur + glazedAreaSqm * installation.costPerSqmEur;
  lineItems.push({
    id: 'installation',
    label: installation.name,
    category: PriceCategory.Installation,
    quantity: 1,
    unit: PriceUnit.Flat,
    unitPrice: round2(installationAmount),
    amount: round2(installationAmount),
  });

  /* Totals. */
  const subtotal = round2(lineItems.reduce((sum, item) => sum + item.amount, 0));
  const vatAmount = round2(subtotal * FINLAND_VAT_RATE);
  const total = round2(subtotal + vatAmount);

  return {
    lineItems,
    subtotal,
    vatRate: FINLAND_VAT_RATE,
    vatAmount,
    total,
    currency: CURRENCY,
    glazedAreaSqm,
  };
}

/**
 * Resolve the quantity and unit for an accessory line from its pricing mode.
 * `Flat` accessories are charged once (quantity `1`); area- and width-scaled
 * accessories use the glazed area or balcony width respectively.
 */
function resolveAccessoryQuantity(
  mode: PriceUnit.Flat | PriceUnit.SquareMeter | PriceUnit.LinearMeter,
  glazedAreaSqm: number,
  widthMeters: number,
): { quantity: number; unit: PriceUnit } {
  switch (mode) {
    case PriceUnit.SquareMeter:
      return { quantity: glazedAreaSqm, unit: PriceUnit.SquareMeter };
    case PriceUnit.LinearMeter:
      return { quantity: widthMeters, unit: PriceUnit.LinearMeter };
    case PriceUnit.Flat:
      return { quantity: 1, unit: PriceUnit.Flat };
  }
}
