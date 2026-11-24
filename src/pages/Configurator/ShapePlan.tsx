/**
 * @file ShapePlan — the floor plan of a balcony shape (`planShapes.ts`) drawn in the
 * graphic language of the owner's drawings: hatched concrete walls, thin side
 * panels as a double line, the glazing as a yellow double line, the balcony door
 * block in the house wall and CAD dimension lines with arrows. The detailed
 * version (side panel) also numbers the walls like the tap targets ("Стена 3").
 */
import { forwardRef, useId } from 'react';
import { PLAN_SHAPES, edgeOf, planFor } from './planShapes';
import type { PlanGeom } from './planShapes';
import type { VamShapeDef } from './vamShapes';
import { glazingUnitCuts } from './wallGeometry';
import { PHOTO_FOV } from './photoPlanLink';
import type { PlanCamera } from './photoPlanLink';
import {
  DIM_LINE_EM,
  EXT_LINE_EM,
  HALO_EM,
  STROKE_EM,
  THICK,
  VIEW_PAD_EM,
  add,
  arrowHead,
  bandParts,
  bandQuad,
  extensionLines,
  inside,
  len,
  mul,
  outward,
  planView,
  segDist,
  signedArea,
  solidPolygons,
  sub,
  unit,
  wallBands,
} from './planDrawing';
import type { DimPlacement, V } from './planDrawing';

interface ShapePlanProps {
  readonly shape: VamShapeDef;
  /** Glazing id (mirrors the right-handed П-44Т); the base plan when absent. */
  readonly glazing?: string | undefined;
  readonly className?: string | undefined;
  /** Dimension lines and wall numbers (the side panel); the setup badges draw the outline only. */
  readonly detailed?: boolean;
  /** Where the photo frames are shot from (detailed card only): a dot and a view cone each. */
  readonly cameras?: readonly PlanCamera[] | undefined;
  /** Wall edges (0-based) lit up on the plan — the surface tapped on a photo. */
  readonly highlight?: readonly number[] | undefined;
}

const INK = '#6f6b64';
const HATCH = '#8d887f';
const GLASS = '#e4ad3b';
const GLASS_FILL = '#fbf0d4';
const ROOM = '#f7f3ec';
/** The ground under the hatching of the solid mass: the outline of the mass is painted under it, so only its outer edge shows. */
const PAPER = '#ffffff';

/** A plan point as SVG coordinates (the plan's y points up, the SVG's down). */
const pt = (p: V): string => `${p[0].toFixed(1)},${(-p[1]).toFixed(1)}`;
const pts = (list: readonly V[]): string => list.map(pt).join(' ');

/**
 * The solid pieces as ONE path, every ring wound the same way: the renderer then fills (and strokes) the union in a
 * single pass, so a seam where two pieces only abut is painted once — painted as separate shapes, each side covers the
 * seam pixels only partly and the ink under them shows through as a hairline.
 */
function massPath(polys: readonly (readonly V[])[]): string {
  return polys
    .map((poly) => {
      const ring = signedArea(poly) < 0 ? [...poly].reverse() : poly;
      return `M${ring.map(pt).join('L')}Z`;
    })
    .join('');
}

/** A CAD dimension: extension lines, an arrowed dimension line and the value. */
function Dimension({ placement, font }: { readonly placement: DimPlacement; readonly font: number }): JSX.Element {
  const { dim, line, label } = placement;
  const { p, q } = line;
  const ext = extensionLines(line, font)
    .map(([from, to]) => `M${pt(from)}L${pt(to)}`)
    .join('');
  return (
    <g>
      <path d={ext} stroke={INK} strokeWidth={font * EXT_LINE_EM} fill="none" />
      <line x1={p[0]} y1={-p[1]} x2={q[0]} y2={-q[1]} stroke={INK} strokeWidth={font * DIM_LINE_EM} />
      <polygon points={pts(arrowHead(p, q, font))} fill={INK} />
      <polygon points={pts(arrowHead(q, p, font))} fill={INK} />
      {/* Anchored by its baseline: `label.box` is where the glyphs are. The halo is round-joined so a sharp digit (4, 7) cannot spike it. */}
      <text
        x={label.at[0]}
        y={-label.at[1]}
        fontSize={font}
        textAnchor="middle"
        fill="#4a4741"
        fontFamily="Manrope, Arial, sans-serif"
        transform={`rotate(${label.angle.toFixed(2)} ${label.at[0].toFixed(1)} ${(-label.at[1]).toFixed(1)})`}
        stroke="#fff"
        strokeWidth={font * HALO_EM * 2}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {dim.text}
      </text>
    </g>
  );
}

/** Wall number badges inside the room, pushed apart from each other and from the walls. */
function placeNumbers(g: PlanGeom, r: number, avoid: readonly V[] = []): V[] {
  const placed: V[] = [];
  const n = g.poly.length;
  for (let i = 0; i < n; i += 1) {
    const [a, b] = edgeOf(g, i);
    const inw = mul(outward(a, b), -1);
    const d = sub(b, a);
    let best: V | null = null;
    let bestScore = -Infinity;
    for (const t of [0.5, 0.35, 0.65, 0.22, 0.78]) {
      for (const k of [1.9, 2.6, 3.4]) {
        const c = add(add(a, mul(d, t)), mul(inw, r * k));
        if (!inside(g.poly, c)) continue;
        let clear = Infinity;
        for (let j = 0; j < n; j += 1) {
          const [p, q] = edgeOf(g, j);
          clear = Math.min(clear, segDist(c, p, q) - r * 1.25);
        }
        for (const o of placed) clear = Math.min(clear, len(sub(c, o)) - r * 2.3);
        for (const o of avoid) clear = Math.min(clear, len(sub(c, o)) - r * 2.4);
        // Prefer the middle of the edge and close to it, but never overlapping.
        const score = Math.min(clear, 0) * 10 - Math.abs(t - 0.5) * r - k * r * 0.2;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
    }
    placed.push(best ?? add(mul(add(a, b), 0.5), mul(inw, r * 1.9)));
  }
  return placed;
}

/**
 * The plan drawing of a shape.
 * @returns The SVG element.
 */
export const ShapePlan = forwardRef<SVGSVGElement, ShapePlanProps>(function ShapePlan(
  { shape, glazing, className, detailed = false, cameras, highlight },
  ref,
): JSX.Element | null {
  const uid = useId().replace(/:/g, '');
  const hatchId = `hatch-${uid}`;
  const clipId = `room-${uid}`;
  const g = (glazing ? planFor(shape.id, glazing) : undefined) ?? PLAN_SHAPES[shape.id];
  if (!g) return null;
  const { font, size, minX, minY, maxX, maxY, dims, note } = planView(g, detailed);
  const pad = font * VIEW_PAD_EM;
  // The setup badges are tiny (78x50 px): heavier lines keep the outline readable.
  const stroke = font * (detailed ? STROKE_EM : 0.16);

  const bands = wallBands(g);
  const solids = solidPolygons(g, bands);
  const mass = massPath(solids);

  // The balcony door block: a white gap across the house wall with the frame line in it.
  const [h0, h1] = edgeOf(g, 0);
  const hd = unit(sub(h1, h0));
  const hn = outward(h0, h1);
  const along = (s: number, out: number): V => add(add(h0, mul(hd, s)), mul(hn, out));
  const badgeR = font * 0.62;
  const numbers = detailed ? placeNumbers(g, badgeR, (cameras ?? []).map((c): V => [c.x, c.y])) : [];
  const hatch = size * 0.035;

  return (
    <svg
      ref={ref}
      className={className}
      viewBox={`${(minX - pad).toFixed(0)} ${(-maxY - pad).toFixed(0)} ${(maxX - minX + pad * 2).toFixed(0)} ${(maxY - minY + pad * 2).toFixed(0)}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`План: ${shape.label}`}
    >
      <defs>
        <pattern id={hatchId} patternUnits="userSpaceOnUse" width={hatch} height={hatch} patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={hatch} stroke={HATCH} strokeWidth={size * 0.0045} />
        </pattern>
        <clipPath id={clipId}>
          <polygon points={pts(g.poly)} />
        </clipPath>
      </defs>
      <polygon points={pts(g.poly)} fill={ROOM} />
      {detailed
        ? cameras?.map((c) => {
            // The view cone of the photo frame, clipped to the room.
            const reach = size * 1.4;
            const k = Math.tan(PHOTO_FOV / 2);
            const rx = c.fy;
            const ry = -c.fx;
            const p1: V = [c.x + (c.fx + rx * k) * reach, c.y + (c.fy + ry * k) * reach];
            const p2: V = [c.x + (c.fx - rx * k) * reach, c.y + (c.fy - ry * k) * reach];
            return (
              <g key={`cone-${c.label}`} clipPath={`url(#${clipId})`}>
                <polygon points={pts([[c.x, c.y], p1, p2])} fill={GLASS} opacity={0.11} />
                <polyline points={pts([p1, [c.x, c.y], p2])} stroke={GLASS} strokeWidth={font * 0.05} fill="none" opacity={0.5} />
              </g>
            );
          })
        : null}
      {/*
        The solid wall mass — the hatched bands and the support blocks — is painted as ONE shape: its outline is
        stroked twice as wide as the drawing's line, then the whole mass is covered with paper, then hatched. What is
        left of the outline is the outer edge of the union only, so the mitres between the bands and the places where
        a block overlaps them leave no stray lines — a step is a clean notch, not a square stuck on. The corners are
        round-joined: a mitre join would spike out of the sharp (25-40 degree) ends of the mitred bands.
      */}
      <path d={mass} fill="none" stroke={INK} strokeWidth={stroke * 2} strokeLinejoin="round" />
      <path d={mass} fill={PAPER} stroke="none" />
      <path d={mass} fill={`url(#${hatchId})`} stroke="none" />
      {bands.map((band) => {
        const { kind, i, a, b, a2, b2 } = band;
        const quad = pts(bandQuad(band));
        if (kind === 'glazing') {
          // Mullion ticks at the same cut points as the interior render's window units
          // (render/scene.ts's glazingFaces), so the drawing shows the same sash count
          // instead of a single decorative centre line — see docs/GEOMETRY_AUDIT.md §3.
          const edgeLen = len(sub(b, a));
          const mullions = detailed
            ? glazingUnitCuts(edgeLen)
                .slice(1, -1)
                .map((t) => {
                  const k = t / edgeLen;
                  return [add(a, mul(sub(b, a), k)), add(a2, mul(sub(b2, a2), k))] as const;
                })
            : [];
          return (
            <g key={i}>
              <polygon points={quad} fill={GLASS_FILL} />
              <polyline points={pts([a, b])} stroke={GLASS} strokeWidth={stroke * 1.6} fill="none" />
              <polyline points={pts([a2, b2])} stroke={GLASS} strokeWidth={stroke * 1.6} fill="none" />
              {mullions.map(([p0, p1], mi) => (
                <polyline key={mi} points={pts([p0, p1])} stroke={GLASS} strokeWidth={stroke * 0.6} fill="none" opacity={0.7} />
              ))}
            </g>
          );
        }
        if (kind === 'panel') {
          return <polygon key={i} points={quad} fill="#fff" stroke={INK} strokeWidth={stroke} strokeLinejoin="round" />;
        }
        // Concrete: the hatched pieces are in the mass above; the thin (light) part of the wall is laid over it.
        const light = bandParts(g, band).light;
        return light ? <polygon key={i} points={pts(light)} fill="#fff" stroke={INK} strokeWidth={stroke} strokeLinejoin="round" /> : null;
      })}
      {g.openings.map((o, k) => {
        const t = THICK.house;
        return (
          <g key={`o${k}`}>
            <polygon points={pts([along(o.from, 0), along(o.to, 0), along(o.to, t), along(o.from, t)])} fill="#fff" stroke={INK} strokeWidth={stroke * 0.8} strokeLinejoin="round" />
            <polyline points={pts([along(o.from, t * 0.5), along(o.to, t * 0.5)])} stroke={INK} strokeWidth={stroke * 0.9} fill="none" />
          </g>
        );
      })}
      <polygon points={pts(g.poly)} fill="none" stroke={INK} strokeWidth={stroke} strokeLinejoin="round" />
      {detailed
        ? (highlight ?? []).map((i) => {
            const [a, b] = edgeOf(g, i);
            return <polyline key={`hl${i}`} points={pts([a, b])} stroke="#e0701c" strokeWidth={font * 0.34} strokeLinecap="round" fill="none" opacity={0.9} />;
          })
        : null}
      {detailed
        ? cameras?.map((c) => {
            // The camera dot sits where the photo is shot from; the digit is the frame.
            return (
              <g key={`cam-${c.label}`}>
                <circle cx={c.x} cy={-c.y} r={font * 0.5} fill="#e0701c" stroke="#fff" strokeWidth={font * 0.1} />
                <text x={c.x} y={-c.y + font * 0.22} fontSize={font * 0.66} textAnchor="middle" fill="#fff" fontWeight={700} fontFamily="Manrope, Arial, sans-serif">
                  {c.label.slice(-1)}
                </text>
              </g>
            );
          })
        : null}
      {dims.map((placement, k) => (
        <Dimension key={`d${k}`} placement={placement} font={font} />
      ))}
      {note ? (
        // The dimension texts are the owner's drawing values; the outline itself is a
        // least-squares fit reconciling them (see planShapes.ts's file comment — some
        // non-scale source drawings state sub-dimensions that can't all hold exactly).
        // This note keeps that honest instead of implying the outline is drawn to the labels.
        <text x={note.x} y={-note.baseline} fontSize={note.size} fill="#a39d90" fontFamily="Manrope, Arial, sans-serif">
          схема, не в масштабе
        </text>
      ) : null}
      {numbers.map((c, i) => (
        <g key={`n${i}`}>
          <circle cx={c[0]} cy={-c[1]} r={badgeR} fill="#fff" stroke="#e0a52c" strokeWidth={font * 0.1} />
          <text x={c[0]} y={-c[1] + font * 0.33} fontSize={font * 0.9} textAnchor="middle" fill="#9a6b10" fontWeight={700} fontFamily="Manrope, Arial, sans-serif">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
});
