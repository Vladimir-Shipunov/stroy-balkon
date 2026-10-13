/**
 * @file ShapePlan — the floor plan of a balcony shape (`planShapes.ts`) drawn in the
 * graphic language of the owner's drawings: hatched concrete walls, thin side
 * panels as a double line, the glazing as a yellow double line, the balcony door
 * block in the house wall and CAD dimension lines with arrows. The detailed
 * version (side panel) also numbers the walls like the tap targets ("Стена 3").
 */
import { forwardRef, useId } from 'react';
import { PLAN_SHAPES, edgeOf, planFor } from './planShapes';
import type { EdgeKind, PlanDim, PlanGeom, Pt } from './planShapes';
import type { VamShapeDef } from './vamShapes';
import { glazingUnitCuts } from './wallGeometry';
import { PHOTO_FOV } from './photoPlanLink';
import type { PlanCamera } from './photoPlanLink';

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

/** Thickness drawn outside the room for every edge kind, mm. */
const THICK: Readonly<Record<EdgeKind, number>> = { house: 210, wall: 170, concrete: 170, panel: 70, glazing: 80 };
const INK = '#6f6b64';
const HATCH = '#8d887f';
const GLASS = '#e4ad3b';
const GLASS_FILL = '#fbf0d4';
const ROOM = '#f7f3ec';

type V = readonly [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const len = (a: V): number => Math.hypot(a[0], a[1]);
const unit = (a: V): V => mul(a, 1 / (len(a) || 1));
const cross = (a: V, b: V): number => a[0] * b[1] - a[1] * b[0];
/** Outward normal of a counter-clockwise outline's edge a->b (the room is on the left). */
const outward = (a: V, b: V): V => {
  const d = unit(sub(b, a));
  return [d[1], -d[0]];
};

function inside(poly: readonly Pt[], p: V): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

/** Distance from p to the segment a-b. */
function segDist(p: V, a: V, b: V): number {
  const d = sub(b, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1] || 1)));
  return len(sub(p, add(a, mul(d, t))));
}

/** Where the outer faces of the two edges meeting at vertex i cross (a mitred corner). */
function outerCorner(g: PlanGeom, i: number, side: 'start' | 'end', edge: number): V {
  const n = g.poly.length;
  const prev = (i - 1 + n) % n;
  const [p0, p1] = edgeOf(g, prev);
  const [q0, q1] = edgeOf(g, i);
  const v = g.poly[i]!;
  const d1 = unit(sub(p1, p0));
  const d2 = unit(sub(q1, q0));
  // In line (the Утюжок's concrete + glazing) or nearly so: square end at the edge's own thickness.
  if (Math.abs(cross(d1, d2)) < 0.05) return add(v, mul(side === 'start' ? outward(q0, q1) : outward(p0, p1), THICK[g.kinds[edge]!]));
  const a1 = add(v, mul(outward(p0, p1), THICK[g.kinds[prev]!]));
  const a2 = add(v, mul(outward(q0, q1), THICK[g.kinds[i]!]));
  const s = cross(sub(a2, a1), d2) / cross(d1, d2);
  return add(a1, mul(d1, s));
}

const pts = (list: readonly V[]): string => list.map((p) => `${p[0].toFixed(1)},${(-p[1]).toFixed(1)}`).join(' ');

interface DimLine {
  readonly dim: PlanDim;
  readonly p: V;
  readonly q: V;
}

/** The dimension line's ends: on y = at / x = at, or `at` mm outside the room along a->b. */
function dimLine(dim: PlanDim, g: PlanGeom): DimLine {
  const { a, b } = dim;
  if (dim.axis === 'x') return { dim, p: [a[0], dim.at], q: [b[0], dim.at] };
  if (dim.axis === 'y') return { dim, p: [dim.at, a[1]], q: [dim.at, b[1]] };
  let nrm: V = outward(a, b);
  const mid = mul(add(a, b), 0.5);
  if (inside(g.poly, add(mid, mul(nrm, 20)))) nrm = mul(nrm, -1);
  return { dim, p: add(a, mul(nrm, dim.at)), q: add(b, mul(nrm, dim.at)) };
}

/** Text placement of a dimension: centre, rotation (deg) reading left-to-right or bottom-to-top. */
function dimText(l: DimLine, font: number): { at: V; angle: number } {
  const dir = unit(sub(l.q, l.p));
  let angle = (Math.atan2(-dir[1], dir[0]) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  const up: V = [Math.sin((angle * Math.PI) / 180), Math.cos((angle * Math.PI) / 180)];
  return { at: add(mul(add(l.p, l.q), 0.5), mul(up, font * 0.35)), angle };
}

/** A CAD dimension: extension lines, an arrowed dimension line and the value. */
function Dimension({ line, font }: { readonly line: DimLine; readonly font: number }): JSX.Element {
  const { dim, p, q } = line;
  const ext = (from: V, to: V): string => {
    const d = sub(to, from);
    const l = len(d);
    if (l < 1) return '';
    const u = mul(d, 1 / l);
    const s0 = add(from, mul(u, Math.min(font * 0.4, l * 0.2)));
    const s1 = add(to, mul(u, font * 0.45));
    return `M${s0[0].toFixed(1)},${(-s0[1]).toFixed(1)}L${s1[0].toFixed(1)},${(-s1[1]).toFixed(1)}`;
  };
  const arrow = font * 0.62;
  const head = (tip: V, back: V): string => {
    const u = unit(sub(back, tip));
    const w: V = [-u[1] * arrow * 0.28, u[0] * arrow * 0.28];
    return pts([tip, add(add(tip, mul(u, arrow)), w), add(add(tip, mul(u, arrow)), mul(w, -1))]);
  };
  const t = dimText(line, font);
  return (
    <g>
      <path d={`${ext(dim.a, p)}${ext(dim.b, q)}`} stroke={INK} strokeWidth={font * 0.05} fill="none" />
      <line x1={p[0]} y1={-p[1]} x2={q[0]} y2={-q[1]} stroke={INK} strokeWidth={font * 0.06} />
      <polygon points={head(p, q)} fill={INK} />
      <polygon points={head(q, p)} fill={INK} />
      <text
        x={t.at[0]}
        y={-t.at[1]}
        fontSize={font}
        textAnchor="middle"
        fill="#4a4741"
        fontFamily="Manrope, Arial, sans-serif"
        transform={`rotate(${t.angle.toFixed(2)} ${t.at[0].toFixed(1)} ${(-t.at[1]).toFixed(1)})`}
        stroke="#fff"
        strokeWidth={font * 0.18}
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
  const n = g.poly.length;
  const xs = g.poly.map((p) => p[0]);
  const ys = g.poly.map((p) => p[1]);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

  // The view box holds the walls and, in the detailed card, the dimensions; the text
  // size is then a fixed share of the box so every shape's labels look the same size.
  const bounds = (font: number): [number, number, number, number] => {
    let x0 = Math.min(...xs) - 260;
    let x1 = Math.max(...xs) + 260;
    let y0 = Math.min(...ys) - 260;
    let y1 = Math.max(...ys) + 260;
    const grow = (v: V, m: number): void => {
      x0 = Math.min(x0, v[0] - m);
      x1 = Math.max(x1, v[0] + m);
      y0 = Math.min(y0, v[1] - m);
      y1 = Math.max(y1, v[1] + m);
    };
    if (detailed) {
      for (const d of g.dims) {
        const l = dimLine(d, g);
        grow(l.p, font * 0.6);
        grow(l.q, font * 0.6);
        const t = dimText(l, font);
        grow(t.at, font * Math.max(1, d.text.length * 0.35));
      }
    }
    return [x0, y0, x1, y1];
  };
  let font = size * 0.05;
  for (let pass = 0; pass < 3; pass += 1) {
    const [x0, y0, x1, y1] = bounds(font);
    // The card is 100% wide (~300 px) and at most 0.86 of that tall: ~13 px text.
    font = Math.max(x1 - x0, (y1 - y0) / 0.86) * 0.043;
  }
  const [minX, minY, maxX, maxY] = bounds(font);
  const pad = font * 0.4;
  // The setup badges are tiny (78x50 px): heavier lines keep the outline readable.
  const stroke = font * (detailed ? 0.07 : 0.16);

  const bands = g.kinds.map((kind, i) => {
    const [a, b] = edgeOf(g, i);
    return { kind, i, a, b, a2: outerCorner(g, i, 'start', i), b2: outerCorner(g, (i + 1) % n, 'end', i) };
  });

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
      {bands.map(({ kind, i, a, b, a2, b2 }) => {
        const quad = pts([a, b, b2, a2]);
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
          return <polygon key={i} points={quad} fill="#fff" stroke={INK} strokeWidth={stroke} />;
        }
        // Concrete: hatched; part of it may be a light (thin) wall.
        const thin = g.thin?.[i];
        const edgeLen = len(sub(b, a));
        const at = (t: number, outer: boolean): V => {
          const k = t / edgeLen;
          return outer ? add(a2, mul(sub(b2, a2), k)) : add(a, mul(sub(b, a), k));
        };
        if (thin) {
          const [t0, t1] = thin;
          const thinW = THICK.panel / THICK[kind];
          const inner0 = at(t0, false);
          const inner1 = at(t1, false);
          const outer0 = add(inner0, mul(sub(at(t0, true), inner0), thinW));
          const outer1 = add(inner1, mul(sub(at(t1, true), inner1), thinW));
          return (
            <g key={i}>
              {t0 > 0 ? <polygon points={pts([a, inner0, at(t0, true), a2])} fill={`url(#${hatchId})`} stroke={INK} strokeWidth={stroke} /> : null}
              <polygon points={pts([inner0, inner1, outer1, outer0])} fill="#fff" stroke={INK} strokeWidth={stroke} />
              {t1 < edgeLen - 1 ? <polygon points={pts([inner1, b, b2, at(t1, true)])} fill={`url(#${hatchId})`} stroke={INK} strokeWidth={stroke} /> : null}
            </g>
          );
        }
        return <polygon key={i} points={quad} fill={`url(#${hatchId})`} stroke={INK} strokeWidth={stroke} />;
      })}
      {/* Support blocks go over the wall bands so their mitred corners don't show through. */}
      {(g.blocks ?? []).map((b, k) => (
        <polygon key={`b${k}`} points={pts(b)} fill={`url(#${hatchId})`} stroke={INK} strokeWidth={stroke * 0.6} />
      ))}
      {g.openings.map((o, k) => {
        const t = THICK.house;
        return (
          <g key={`o${k}`}>
            <polygon points={pts([along(o.from, 0), along(o.to, 0), along(o.to, t), along(o.from, t)])} fill="#fff" stroke={INK} strokeWidth={stroke * 0.8} />
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
      {detailed ? g.dims.map((d, k) => <Dimension key={`d${k}`} line={dimLine(d, g)} font={font} />) : null}
      {detailed ? (
        // The dimension texts are the owner's drawing values; the outline itself is a
        // least-squares fit reconciling them (see planShapes.ts's file comment — some
        // non-scale source drawings state sub-dimensions that can't all hold exactly).
        // This note keeps that honest instead of implying the outline is drawn to the labels.
        <text x={minX - pad + font * 0.3} y={-minY + pad - font * 0.3} fontSize={font * 0.55} fill="#a39d90" fontFamily="Manrope, Arial, sans-serif">
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
