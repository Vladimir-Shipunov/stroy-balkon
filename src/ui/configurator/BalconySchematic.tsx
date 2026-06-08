/**
 * @file BalconySchematic — a live technical front-elevation drawing of the
 * configured balcony glazing.
 *
 * Presentation only: it reads the relevant fields from the configurator store
 * and renders a deterministic, fabrication-style SVG (no realism, no gradients,
 * no randomness). The real width:height aspect ratio is mapped into a fixed
 * viewBox so a wide opening reads wide and a tall opening reads tall.
 *
 * The drawing reflects:
 * - finish colour  → frame stroke colour (with a contrast floor for pale RALs);
 * - glazing type   → the vertical pane-division pattern;
 * - railing type   → the style of the band at the sill;
 * - dimensions     → the proportions and the width/height annotations.
 */

import { useConfiguratorStore } from '../../store/configuratorStore';
import { GlazingType, RailingType } from '../../types/balcony';
import { getColorFinish } from '../../data/catalog';
import styles from './BalconySchematic.module.css';

/* -------------------------------------------------------------------------- */
/*  Drawing constants (SVG user units)                                        */
/* -------------------------------------------------------------------------- */

/** Fixed canvas the proportional drawing is fitted into. */
const VIEW_W = 320;
const VIEW_H = 240;
/** Outer padding so annotations and the frame never touch the edge. */
const PAD = 34;
/** Maximum area available to the elevation inside the padding. */
const MAX_W = VIEW_W - PAD * 2;
const MAX_H = VIEW_H - PAD * 2;
/** Thickness of the perimeter frame band. */
const FRAME = 7;
/** Height of the railing band drawn at the sill. */
const RAIL_H = 34;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Perceived luminance (0–255) of a `#rrggbb` hex colour, used to decide when a
 * pale finish needs a darker outline so the frame stays legible on white.
 */
function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) {
    return 128;
  }
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return 128;
  }
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Number of vertical glass panes for a glazing style. Frameless reads as many
 * slim panels; framed/sliding as a few larger ones. Bounded so very wide
 * openings still draw cleanly.
 */
function paneCountFor(glazing: GlazingType, glazedWidth: number): number {
  const perPaneTarget =
    glazing === GlazingType.Frameless
      ? 32
      : glazing === GlazingType.SemiFrameless
        ? 44
        : glazing === GlazingType.Sliding
          ? 60
          : 52;
  const raw = Math.round(glazedWidth / perPaneTarget);
  return Math.min(8, Math.max(2, raw));
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Live front-elevation schematic of the current balcony configuration.
 *
 * Consumed by the summary sidebar. Takes no props — it subscribes to the
 * configurator store and redraws whenever the relevant config fields change.
 */
export function BalconySchematic(): JSX.Element {
  const config = useConfiguratorStore((s) => s.config);
  const { widthCm, heightCm, glazingType, railing, colorFinish } = config;

  /* --- Proportional fit: preserve the real width:height aspect ratio. --- */
  const aspect = widthCm / heightCm;
  let drawW = MAX_W;
  let drawH = drawW / aspect;
  if (drawH > MAX_H) {
    drawH = MAX_H;
    drawW = drawH * aspect;
  }
  const x0 = (VIEW_W - drawW) / 2;
  const y0 = (VIEW_H - drawH) / 2;
  const x1 = x0 + drawW;
  const y1 = y0 + drawH;

  /* --- Finish-driven frame stroke with a contrast floor for pale RALs. --- */
  const finishHex = getColorFinish(colorFinish).hex;
  const isPale = hexLuminance(finishHex) > 200;

  /* --- Glazed opening (inside the frame, above the railing band). --- */
  const gx0 = x0 + FRAME;
  const gx1 = x1 - FRAME;
  const gyTop = y0 + FRAME;
  const railTop = y1 - RAIL_H;
  const gyBottom = railTop - FRAME / 2;
  const glazedW = gx1 - gx0;

  /* --- Vertical pane divisions. --- */
  const panes = paneCountFor(glazingType, drawW);
  const paneStep = glazedW / panes;
  const mullions = Array.from({ length: panes - 1 }, (_, i) => gx0 + paneStep * (i + 1));

  /* --- Railing balusters / slats (deterministic from width). --- */
  const railW = gx1 - gx0;
  const balusterCount = Math.min(14, Math.max(4, Math.round(railW / 16)));
  const balusterStep = railW / balusterCount;
  const balusters = Array.from(
    { length: balusterCount - 1 },
    (_, i) => gx0 + balusterStep * (i + 1),
  );
  const woodSlats = [railTop + RAIL_H * 0.34, railTop + RAIL_H * 0.67];

  const widthMm = widthCm * 10;
  const heightMm = heightCm * 10;

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Front elevation: ${widthMm} by ${heightMm} millimetres, ${glazingType} glazing with ${railing} railing.`}
      >
        {/* Glazed field fill — a faint glass tint behind the panes. */}
        <rect
          className={styles.glass}
          x={gx0}
          y={gyTop}
          width={gx1 - gx0}
          height={gyBottom - gyTop}
        />

        {/* Glazing-style pane divisions. */}
        <GlazingDivisions
          glazing={glazingType}
          mullions={mullions}
          gx0={gx0}
          gx1={gx1}
          gyTop={gyTop}
          gyBottom={gyBottom}
        />

        {/* Railing band at the sill. */}
        <RailingBand
          railing={railing}
          gx0={gx0}
          gx1={gx1}
          railTop={railTop}
          railH={RAIL_H}
          balusters={balusters}
          woodSlats={woodSlats}
        />

        {/* Outer perimeter frame — drawn last so it sits above fills. The */}
        {/* finish hex colours the frame; pale finishes get a thin outline. */}
        <rect
          className={styles.frame}
          x={x0}
          y={y0}
          width={drawW}
          height={drawH}
          style={{ stroke: finishHex, strokeWidth: FRAME }}
        />
        {isPale ? (
          <rect className={styles.frameOutline} x={x0} y={y0} width={drawW} height={drawH} />
        ) : null}

        {/* ---- Dimension annotations ---- */}
        {/* Width: baseline + ticks under the drawing. */}
        <line className={styles.dimLine} x1={x0} y1={y1 + 16} x2={x1} y2={y1 + 16} />
        <line className={styles.dimTick} x1={x0} y1={y1 + 11} x2={x0} y2={y1 + 21} />
        <line className={styles.dimTick} x1={x1} y1={y1 + 11} x2={x1} y2={y1 + 21} />
        <text
          className={styles.dimText}
          x={(x0 + x1) / 2}
          y={y1 + 28}
          textAnchor="middle"
        >{`${widthMm} mm`}</text>

        {/* Height: vertical baseline + ticks at the left side. */}
        <line className={styles.dimLine} x1={x0 - 16} y1={y0} x2={x0 - 16} y2={y1} />
        <line className={styles.dimTick} x1={x0 - 21} y1={y0} x2={x0 - 11} y2={y0} />
        <line className={styles.dimTick} x1={x0 - 21} y1={y1} x2={x0 - 11} y2={y1} />
        <text
          className={styles.dimText}
          x={x0 - 22}
          y={(y0 + y1) / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${x0 - 22} ${(y0 + y1) / 2})`}
        >{`${heightMm} mm`}</text>
      </svg>
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-drawings                                                               */
/* -------------------------------------------------------------------------- */

interface GlazingDivisionsProps {
  readonly glazing: GlazingType;
  readonly mullions: readonly number[];
  readonly gx0: number;
  readonly gx1: number;
  readonly gyTop: number;
  readonly gyBottom: number;
}

/**
 * Vertical pane-division pattern keyed to the glazing style:
 * - frameless    → thin butt-joint lines between many panes;
 * - semi-frameless → butt joints plus slim top/bottom rails;
 * - framed       → each pane boxed by a thin border;
 * - sliding      → two overlapping leaves with a horizontal offset.
 */
function GlazingDivisions({
  glazing,
  mullions,
  gx0,
  gx1,
  gyTop,
  gyBottom,
}: GlazingDivisionsProps): JSX.Element {
  if (glazing === GlazingType.Sliding) {
    const midY = (gyTop + gyBottom) / 2;
    const overlap = Math.min(18, (gx1 - gx0) * 0.12);
    const splitX = (gx0 + gx1) / 2;
    return (
      <g>
        {/* Track lines top & bottom. */}
        <line className={styles.rail} x1={gx0} y1={gyTop} x2={gx1} y2={gyTop} />
        <line className={styles.rail} x1={gx0} y1={gyBottom} x2={gx1} y2={gyBottom} />
        {/* Two leaves that overlap at the centre, slightly offset in depth. */}
        <rect
          className={styles.leaf}
          x={gx0}
          y={gyTop}
          width={splitX - gx0 + overlap}
          height={gyBottom - gyTop}
        />
        <rect
          className={styles.leafFront}
          x={splitX - overlap}
          y={gyTop + 2}
          width={gx1 - (splitX - overlap)}
          height={gyBottom - gyTop - 4}
        />
        {/* Pull handle on the front leaf. */}
        <line
          className={styles.handle}
          x1={splitX - overlap + 6}
          y1={midY - 10}
          x2={splitX - overlap + 6}
          y2={midY + 10}
        />
      </g>
    );
  }

  if (glazing === GlazingType.Framed) {
    return (
      <g>
        {[gx0, ...mullions].map((mx, i, arr) => {
          const next = arr[i + 1] ?? gx1;
          return (
            <rect
              key={`pane-${mx}`}
              className={styles.framedPane}
              x={mx + 1.5}
              y={gyTop + 1.5}
              width={next - mx - 3}
              height={gyBottom - gyTop - 3}
            />
          );
        })}
      </g>
    );
  }

  // Frameless & semi-frameless: thin vertical butt joints between panes.
  return (
    <g>
      {glazing === GlazingType.SemiFrameless ? (
        <>
          <line className={styles.rail} x1={gx0} y1={gyTop} x2={gx1} y2={gyTop} />
          <line className={styles.rail} x1={gx0} y1={gyBottom} x2={gx1} y2={gyBottom} />
        </>
      ) : null}
      {mullions.map((mx) => (
        <line
          key={`mullion-${mx}`}
          className={styles.mullion}
          x1={mx}
          y1={gyTop}
          x2={mx}
          y2={gyBottom}
        />
      ))}
    </g>
  );
}

interface RailingBandProps {
  readonly railing: RailingType;
  readonly gx0: number;
  readonly gx1: number;
  readonly railTop: number;
  readonly railH: number;
  readonly balusters: readonly number[];
  readonly woodSlats: readonly number[];
}

/**
 * The balustrade band drawn at the sill. The infill hints at the railing
 * material: glass = a single translucent panel; steel/aluminium = vertical
 * balusters; wood = horizontal slats.
 */
function RailingBand({
  railing,
  gx0,
  gx1,
  railTop,
  railH,
  balusters,
  woodSlats,
}: RailingBandProps): JSX.Element {
  const railBottom = railTop + railH;
  return (
    <g>
      {/* Top rail + outline of the band. */}
      <rect
        className={styles.railBand}
        x={gx0}
        y={railTop}
        width={gx1 - gx0}
        height={railH}
      />

      {railing === RailingType.Glass ? (
        <rect
          className={styles.railGlass}
          x={gx0 + 3}
          y={railTop + 4}
          width={gx1 - gx0 - 6}
          height={railH - 8}
        />
      ) : null}

      {railing === RailingType.Steel || railing === RailingType.Aluminum
        ? balusters.map((bx) => (
            <line
              key={`baluster-${bx}`}
              className={styles.baluster}
              x1={bx}
              y1={railTop + 4}
              x2={bx}
              y2={railBottom - 4}
            />
          ))
        : null}

      {railing === RailingType.Wood
        ? woodSlats.map((sy) => (
            <line
              key={`slat-${sy}`}
              className={styles.slat}
              x1={gx0 + 3}
              y1={sy}
              x2={gx1 - 3}
              y2={sy}
            />
          ))
        : null}
    </g>
  );
}
