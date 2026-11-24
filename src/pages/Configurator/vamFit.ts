/**
 * @file Per-shape fitting of the app's real photo frames: a crop and a few degrees of
 * rotation / shear / zoom applied to the photo as a whole, never to its pixels, so a shape
 * the app has no photo of (Лодочка, Сапожок) can still wear the closest real one — cut down
 * and turned toward its own outline — without the picture itself being redrawn or recoloured.
 *
 * Every spec is in the *displayed* orientation of the frame (after the right-handed П-44Т
 * has been flipped), in percent of the square picture, origin top-left; `fitFor` flips a spec
 * for the mirrored screens so one table serves both hands. All geometry here is pure — the
 * scene (`VamScene.tsx`) turns it into a CSS transform / clip-path and the same maths into
 * the canvas the PDF/save path captures, and the tap targets are moved with `fitPoint` so
 * each stays on the surface it belongs to.
 */

import { mirrorWarp, warpLayout, warpPoint } from './vamWarp';
import type { FitWarp } from './vamWarp';

export type FitPt = readonly [number, number];

export interface SceneFit {
  /** The visible region, a polygon in percent of the picture; omitted = the whole picture. */
  readonly clip?: readonly FitPt[];
  /** Rotation about the picture's centre, degrees, clockwise. */
  readonly rotate?: number;
  /** Horizontal shear, degrees: positive leans the top of the picture to the right. */
  readonly skewX?: number;
  /** Vertical shear, degrees: positive drops the right side of the picture. */
  readonly skewY?: number;
  /** Zoom about the picture's centre (1 = none). */
  readonly scaleX?: number;
  readonly scaleY?: number;
  /** Pan, percent of the picture's size. */
  readonly shift?: FitPt;
  /**
   * What shows where the crop cuts the photo away (and wherever the turned photo stops short of the
   * frame): a CSS colour. Left out it is the frame's own light blue-gray, which on a cut through the
   * ceiling reads as a foreign slanted bar — a colour taken from the photo's own ceiling there makes
   * the cut read as the ceiling carrying on.
   */
  readonly backdrop?: string;
  /**
   * A vertical band of the picture — a wall seen head-on — squeezed sideways to a share of its width,
   * which is how a wall is made shorter in a photo without redrawing it: the picture left of the band
   * moves in half the squeezed-away width, the picture right of it the other half, and the whole is
   * then zoomed by the transform below to fill the frame again. Nothing is stretched, so the band
   * should be a plain wall (the squeeze is invisible on flat gray), and every edge that runs into it
   * (ceiling line, floor line) still meets its neighbour exactly. Cut into several spans, the band
   * can also build a protruding corner out of the photo's own wall (see `FitSpan`).
   */
  readonly band?: FitBand;
  /**
   * A wall seen from the side re-cut head-on, with a ledge standing out of its end (`vamWarp.ts`): drawn column by
   * column onto a canvas in place of the picture (and its pieces), from the picture's own pixels. Takes the place of `band`.
   */
  readonly warp?: FitWarp;
  /**
   * Where a tap target that the fit would otherwise have to push to the frame's edge stands instead, by
   * hotspot id: percent of the frame, in the displayed orientation, on screen (after the fit). A zoom
   * can throw a surface's own point out of the picture (the ceiling's, here), and the edge it would be
   * pulled back to may be where another button already sits.
   */
  readonly taps?: Readonly<Record<string, FitPt>>;
}

/**
 * A run of columns of a band that is squeezed on its own. Several runs side by side make a corner that
 * juts out: a far wall, then the side face of the protrusion, then its front face — all cut from the
 * wall's own pixels, so a finish chosen for the wall dresses the protrusion too. Each run's `slope` is
 * the slope its top edge takes on screen, so the ledge's silhouette against the ceiling is drawn the way
 * a real column's is: the side face's top edge climbs steeply toward the viewer (the direction of the
 * house wall's own edge in the photo) and the front face's runs parallel to the far wall's. The faces
 * are told apart by tone as a column lit from the windows on the left would be — the side face, turned
 * to the light, the brighter, with a bright convex edge; a dark crease in the inner corner; the ceiling's
 * contact shadow on both — because a darker face on the light's side reads as a niche, not a ledge.
 */
export interface FitSpan {
  /** Width of the run in the photo (percent of the picture). */
  readonly w: number;
  /** The share of that width the run keeps on screen (1 = as is). */
  readonly k: number;
  /**
   * The slope (rise over run, y down) the wall's top line should have across the run once squeezed;
   * left out it keeps the photo's own slope (`band.edge.slope`), so the line carries on straight.
   */
  readonly slope?: number;
  /**
   * Shading of the run's surface (below the wall's top line): stops of a horizontal ramp across the run,
   * each a position (0 = its left edge, 1 = its right edge) and a signed opacity — negative lays black over
   * the picture, positive white. A face turned from the light is a dark ramp, an inner corner's shadow
   * deepens toward the corner, a lit edge is a bright stop. Keep every stop of a run the same sign (or
   * zero): the ramp is interpolated by CSS and by the canvas alike, which only agree between like colours.
   */
  readonly shade?: readonly ShadeStop[];
  /**
   * The ceiling's contact shadow on this run: how dark it is right under the wall's top line (0..1) and
   * how far down it fades out (percent of the picture's height). Needs `band.edge`.
   */
  readonly ao?: readonly [number, number];
}

/** One stop of a shade's ramp: [position across the run (0..1), signed opacity]. */
export type ShadeStop = readonly [number, number];

/**
 * A vertical band `x0`..`x1` (percent of the picture): one run squeezed to `keep` (0..1) of its width,
 * or several `spans` that together cover it. `edge` is the line where the wall meets the ceiling in the
 * photo (its height at `x0`, percent, and its slope, y down): a plain squeeze would steepen that line
 * to `slope / keep` and bend the ceiling, so each run is sheared to land the line on its `slope`, and
 * the picture on either side is lifted by half of what that adds up to, so the line stays one straight
 * run across the band.
 */
export interface FitBand {
  readonly x0: number;
  readonly x1: number;
  readonly keep?: number;
  readonly spans?: readonly FitSpan[];
  readonly edge?: { readonly y: number; readonly slope: number };
}

/** The runs of a band: its `spans`, or the single run `keep` stands for. */
export function bandSpans(band: FitBand): readonly FitSpan[] {
  return band.spans ?? [{ w: band.x1 - band.x0, k: band.keep ?? 1 }];
}

/** The width (percent) a band gives up. */
export function bandDrop(band: FitBand): number {
  return band.x1 - band.x0 - bandSpans(band).reduce((sum, s) => sum + s.w * s.k, 0);
}

/** A span with where it starts in the photo (`xs`) and on screen (`xt`), its vertical shear (`sl`) and its offset (`fy`). */
export interface SpanLayout extends FitSpan {
  readonly xs: number;
  readonly xt: number;
  /** Vertical shear: a point at column `x` of the span is lowered by `fy + sl · (x − xs)` (percent). */
  readonly sl: number;
  readonly fy: number;
}

export interface BandLayout {
  readonly spans: readonly SpanLayout[];
  /** Width the band gives up (percent). */
  readonly drop: number;
  /** How far the right end of the band ends up below its left end (percent). */
  readonly rise: number;
}

/**
 * Where every run of a band lands. The left of the picture moves in by half the drop and up by half the
 * rise, the right of it in and down by the same, so the whole stays centred and a spec mirrors exactly.
 */
export function bandLayout(band: FitBand): BandLayout {
  const drop = bandDrop(band);
  const runs = bandSpans(band);
  const edgeSlope = band.edge?.slope ?? 0;
  const rises = runs.map((s) => (band.edge ? s.w * (s.k * (s.slope ?? edgeSlope) - edgeSlope) : 0));
  const rise = rises.reduce((sum, r) => sum + r, 0);
  let xs = band.x0;
  let xt = band.x0 + drop / 2;
  let fy = -rise / 2;
  const spans = runs.map((s, i) => {
    const r = rises[i]!;
    const laid: SpanLayout = { ...s, xs, xt, sl: s.w > 0 ? r / s.w : 0, fy };
    xs += s.w;
    xt += s.w * s.k;
    fy += r;
    return laid;
  });
  return { spans, drop, rise };
}

/**
 * The shading of one piece: the ramp (`stops`) across the columns `x0`..`x1` it covers, and, when the
 * band knows its wall line, the height (percent) where that line crosses those two columns — the shade
 * lies below it, on the wall, never on the ceiling — and the ceiling's contact shadow (`ao`).
 */
export interface FitShade {
  readonly x0: number;
  readonly x1: number;
  readonly stops: readonly ShadeStop[];
  readonly top?: readonly [number, number];
  readonly ao?: readonly [number, number];
  /** Height (percent) where the wall ends below — its floor line; the shade stops there (or, as a pair, at the left and right column). Left out, it runs to the picture's foot. */
  readonly bottom?: number | readonly [number, number];
}

/**
 * One piece of a picture cut along a band: the columns `x0`..`x1` (percent, before the move) shown
 * through `translate(tx%, ty%) matrix(k, sl, 0, 1, 0, 0)` about the picture's top-left corner — that is,
 * squeezed to `k` of their width and sheared by `sl` (drop per column), then moved — with an optional
 * shade laid over the wall surface of the span.
 */
export interface FitPiece {
  readonly x0: number;
  readonly x1: number;
  readonly tx: number;
  readonly ty: number;
  readonly k: number;
  readonly sl: number;
  readonly shade?: FitShade;
}

/** How far a piece reaches under its neighbour on the right, so the seam never opens a hairline gap (percent). */
const SEAM_OVERLAP = 0.25;

const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
const clampPct = (v: number): number => Math.min(100, Math.max(0, v));

/**
 * The pieces a band cuts the picture into, in draw order: the part left of it, the part right of it,
 * then the band's runs left to right on top (each covers the overlap of the one before). Undefined when
 * there is no band.
 */
export function fitPieces(fit: SceneFit | undefined): readonly FitPiece[] | undefined {
  const band = fit?.band;
  if (!band) return undefined;
  const { spans, drop, rise } = bandLayout(band);
  const pieces: FitPiece[] = [];
  if (band.x0 > 0) pieces.push({ x0: 0, x1: Math.min(100, band.x0 + SEAM_OVERLAP), tx: round5(drop / 2), ty: round5(-rise / 2), k: 1, sl: 0 });
  if (band.x1 < 100) pieces.push({ x0: Math.max(0, band.x1 - SEAM_OVERLAP), x1: 100, tx: round5(-drop / 2), ty: round5(rise / 2), k: 1, sl: 0 });
  const wallTop = (x: number): number => round5(clampPct(band.edge ? band.edge.y + band.edge.slope * (x - band.x0) : 0));
  spans.forEach((s, i) => {
    const xe = s.xs + s.w;
    const shade: FitShade | undefined = s.shade
      ? {
          x0: round5(s.xs),
          x1: round5(xe),
          stops: s.shade,
          ...(band.edge ? { top: [wallTop(s.xs), wallTop(xe)] as const } : {}),
          ...(band.edge && s.ao ? { ao: s.ao } : {}),
        }
      : undefined;
    pieces.push({
      x0: round5(s.xs),
      x1: round5(i < spans.length - 1 ? xe + SEAM_OVERLAP : xe),
      tx: round5(s.xt - s.k * s.xs),
      ty: round5(s.fy - s.sl * s.xs),
      k: round5(s.k),
      sl: round5(s.sl),
      ...(shade ? { shade } : {}),
    });
  });
  return pieces;
}

/** CSS `clip-path` of a piece, in the piece's own (pre-move) coordinates. */
export function pieceClipPath(piece: FitPiece): string {
  return `inset(0 ${100 - piece.x1}% 0 ${piece.x0}%)`;
}

/** CSS `transform` of a piece (`transform-origin: 0 0`). */
export function pieceTransform(piece: FitPiece): string {
  return `translate(${piece.tx}%, ${piece.ty}%) matrix(${piece.k}, ${piece.sl}, 0, 1, 0, 0)`;
}

/** The colour of each stop of a shade: black for a negative opacity, white for a positive one (a zero stop takes the shade's first coloured one's). */
export function shadeColors(shade: FitShade): readonly string[] {
  const lead = shade.stops.find(([, v]) => v !== 0);
  const white = (v: number): boolean => (v === 0 ? (lead?.[1] ?? 0) > 0 : v > 0);
  return shade.stops.map(([, v]) => `rgba(${white(v) ? '255, 255, 255' : '0, 0, 0'}, ${Math.abs(v)})`);
}

/** The column (percent of the picture, before the move) of a stop position (0..1) of a shade. */
export function shadeStopX(shade: FitShade, position: number): number {
  return round5(shade.x0 + position * (shade.x1 - shade.x0));
}

/** The ceiling's contact shadow of a shade, if it has one: [height of the wall's top line (percent), opacity under it, fade height]. */
export function shadeAo(shade: FitShade): readonly [number, number, number] | undefined {
  if (!shade.ao || !shade.top) return undefined;
  return [round5((shade.top[0] + shade.top[1]) / 2), shade.ao[0], shade.ao[1]];
}

/** The wall below the top line across a shade's columns, as a polygon in percent of the piece (the whole column when there is no line). */
export function shadePolygon(shade: FitShade): readonly FitPt[] {
  const [ya, yb] = shade.top ?? [0, 0];
  const [footA, footB] = typeof shade.bottom === 'number' ? [shade.bottom, shade.bottom] : shade.bottom ?? [100, 100];
  return [[shade.x0, ya], [shade.x1, yb], [shade.x1, footB], [shade.x0, footA]];
}

/** CSS `clip-path` of a piece's shade (undefined when it has none). */
export function shadeClipPath(piece: FitPiece): string | undefined {
  if (!piece.shade) return undefined;
  return `polygon(${shadePolygon(piece.shade).map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
}

/** CSS `background` of a piece's shade: the ceiling's contact shadow (if any) over a horizontal ramp through its stops (undefined when it has none). */
export function shadeBackground(piece: FitPiece): string | undefined {
  const shade = piece.shade;
  if (!shade) return undefined;
  const colours = shadeColors(shade);
  const ramp = `linear-gradient(90deg, ${shade.stops.map(([position], i) => `${colours[i]} ${shadeStopX(shade, position)}%`).join(', ')})`;
  const ao = shadeAo(shade);
  if (!ao) return ramp;
  const [y, darkness, height] = ao;
  return `linear-gradient(180deg, rgba(0, 0, 0, ${darkness}) ${y}%, rgba(0, 0, 0, 0) ${round5(y + height)}%), ${ramp}`;
}

/** Where a point of the picture (percent) ends up once the band is squeezed, before any zoom. */
export function fitBandPoint(band: FitBand, x: number, y: number): FitPt {
  const { spans, drop, rise } = bandLayout(band);
  if (x <= band.x0) return [x + drop / 2, y - rise / 2];
  if (x >= band.x1) return [x - drop / 2, y + rise / 2];
  const s = spans.find((run) => x <= run.xs + run.w) ?? spans[spans.length - 1]!;
  return [s.xt + s.k * (x - s.xs), y + s.fy + s.sl * (x - s.xs)];
}

/** Where a column of the picture (percent) ends up once the band is squeezed, before any zoom. */
export function fitBandX(band: FitBand, x: number): number {
  return fitBandPoint(band, x, 0)[0];
}

const DEG = Math.PI / 180;

/** The 2D affine a spec stands for, about the picture's centre, in percent: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export interface FitMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

/**
 * The same order as the CSS string `fitTransform` builds — `translate() rotate() skewX()
 * skewY() scale()`, the rightmost applied to the picture first: scale, then skewY, then
 * skewX, then rotate, then translate.
 */
export function fitMatrix(fit: SceneFit | undefined): FitMatrix {
  const sx = fit?.scaleX ?? 1;
  const sy = fit?.scaleY ?? 1;
  const r = (fit?.rotate ?? 0) * DEG;
  const kx = Math.tan((fit?.skewX ?? 0) * DEG);
  const ky = Math.tan((fit?.skewY ?? 0) * DEG);
  const [tx, ty] = fit?.shift ?? [0, 0];
  // scale
  let a = sx;
  let b = 0;
  let c = 0;
  let d = sy;
  // skewY: [[1, 0], [ky, 1]]
  [a, b, c, d] = [a, ky * a + b, c, ky * c + d];
  // skewX: [[1, kx], [0, 1]]
  [a, b, c, d] = [a + kx * b, b, c + kx * d, d];
  // rotate
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  [a, b, c, d] = [cos * a - sin * b, sin * a + cos * b, cos * c - sin * d, sin * c + cos * d];
  return { a, b, c, d, e: tx, f: ty };
}

/** Where a point of the picture (percent) ends up on screen (percent). */
export function fitPoint(fit: SceneFit | undefined, x: number, y: number): FitPt {
  if (!fit) return [x, y];
  const m = fitMatrix(fit);
  const [bx, by] = fit.warp ? warpPoint(warpLayout(fit.warp), x, y) : fit.band ? fitBandPoint(fit.band, x, y) : [x, y];
  const dx = bx - 50;
  const dy = by - 50;
  return [50 + m.a * dx + m.c * dy + m.e, 50 + m.b * dx + m.d * dy + m.f];
}

/** How far a tap target's centre stays from the frame's edge (percent), so the whole round button fits inside it. */
const TAP_INSET = 5;

/**
 * A fitted tap target pulled back inside the frame when the zoom has pushed its surface's point past the
 * edge — the ceiling and the floor reach the frame's top and bottom, so a button kept near that edge is
 * still on them and can still be tapped. A shape with no fit is left exactly where it is.
 */
export function fitKeepInFrame(fit: SceneFit | undefined, point: FitPt): FitPt {
  if (!fit) return point;
  const inside = (v: number): number => Math.min(100 - TAP_INSET, Math.max(TAP_INSET, v));
  return [inside(point[0]), inside(point[1])];
}

/**
 * Where the tap target `id` stands on a fitted frame: the spec's own place for it when it names one,
 * otherwise `point` (the fitted position of its surface) kept inside the frame.
 */
export function fitTapPoint(fit: SceneFit | undefined, id: string, point: FitPt): FitPt {
  return fit?.taps?.[id] ?? fitKeepInFrame(fit, point);
}

/** CSS `transform` of the picture for a spec (`transform-origin: center`). */
export function fitTransform(fit: SceneFit | undefined): string {
  if (!fit) return 'none';
  const parts: string[] = [];
  if (fit.shift) parts.push(`translate(${fit.shift[0]}%, ${fit.shift[1]}%)`);
  if (fit.rotate) parts.push(`rotate(${fit.rotate}deg)`);
  if (fit.skewX) parts.push(`skewX(${fit.skewX}deg)`);
  if (fit.skewY) parts.push(`skewY(${fit.skewY}deg)`);
  if (fit.scaleX !== undefined || fit.scaleY !== undefined) parts.push(`scale(${fit.scaleX ?? 1}, ${fit.scaleY ?? 1})`);
  return parts.length ? parts.join(' ') : 'none';
}

/** CSS `clip-path` for a spec's crop, or undefined when the whole picture shows. */
export function fitClipPath(fit: SceneFit | undefined): string | undefined {
  if (!fit?.clip || fit.clip.length < 3) return undefined;
  return `polygon(${fit.clip.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
}

/** Even-odd point-in-polygon test (percent); true for every point when the spec has no crop. */
export function fitShows(fit: SceneFit | undefined, x: number, y: number): boolean {
  const poly = fit?.clip;
  if (!poly || poly.length < 3) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A band seen in a mirror: its runs in reverse order, every slope turned over and every shade read from the other end. */
export function mirrorBand(band: FitBand): FitBand {
  return {
    x0: 100 - band.x1,
    x1: 100 - band.x0,
    ...(band.keep !== undefined ? { keep: band.keep } : {}),
    ...(band.spans
      ? {
          spans: [...band.spans].reverse().map((s) => ({
            w: s.w,
            k: s.k,
            ...(s.slope !== undefined ? { slope: -s.slope } : {}),
            ...(s.shade ? { shade: [...s.shade].reverse().map(([position, v]) => [round5(1 - position), v] as const) } : {}),
            ...(s.ao ? { ao: s.ao } : {}),
          })),
        }
      : {}),
    // The wall's top line is given at the band's left end, which is the old right end once mirrored.
    ...(band.edge ? { edge: { y: band.edge.y + band.edge.slope * (band.x1 - band.x0), slope: -band.edge.slope } } : {}),
  };
}

/** The same spec seen in a mirror (left <-> right): the table is written for the left-handed screen. */
export function mirrorFit(fit: SceneFit): SceneFit {
  return {
    ...(fit.clip ? { clip: fit.clip.map(([x, y]) => [100 - x, y] as const).reverse() } : {}),
    ...(fit.rotate !== undefined ? { rotate: -fit.rotate } : {}),
    ...(fit.skewX !== undefined ? { skewX: -fit.skewX } : {}),
    ...(fit.skewY !== undefined ? { skewY: -fit.skewY } : {}),
    ...(fit.scaleX !== undefined ? { scaleX: fit.scaleX } : {}),
    ...(fit.scaleY !== undefined ? { scaleY: fit.scaleY } : {}),
    ...(fit.shift ? { shift: [-fit.shift[0], fit.shift[1]] as const } : {}),
    ...(fit.backdrop ? { backdrop: fit.backdrop } : {}),
    ...(fit.band ? { band: mirrorBand(fit.band) } : {}),
    ...(fit.warp ? { warp: mirrorWarp(fit.warp) } : {}),
    ...(fit.taps ? { taps: Object.fromEntries(Object.entries(fit.taps).map(([id, [x, y]]) => [id, [100 - x, y] as const])) } : {}),
  };
}

/**
 * The fits, by shape id, then view (0 = frame 1, 1 = frame 2), written for the left-handed
 * screen. A shape or view with no entry shows the whole photo untouched.
 *
 * 2026-10-15: a first fit for the Лодочка — a few degrees of turn, a zoom and a cut-away upper
 * corner — was tried and the owner took it back ("мне не нужно срезать верх… то что ты сделал
 * убери"): what they want is a wall's *length* shortened with the part not needed cut off. They
 * named the wall (the far gray end wall), both frames, and by how much (in half), so that is all
 * this table does — no turn, no top crop:
 * - frame 2 (img10_1): the end wall is the big gray one right of the corner window, x ≈ 400–708 px
 *   of 800 (50–88.5 %), seen head-on and plain, so squeezing it to half its width shows nothing;
 *   the ≈19 % the picture gives up is then taken back by a uniform zoom of 1/(1−0.1925), anchored
 *   at 58 % of the height so the ceiling line and the sill stay in and the extra ceiling and
 *   floor are what is cut off;
 * - frame 1 (img10_0): the same wall is the narrow dark strip between the door-and-window block and
 *   the corner window, x ≈ 443–484 px (55.4–60.5 %); half of it is ≈2.6 % of the picture, zoom ≈1.026
 *   (that first version changed too little to see — see the 2026-10-16 note).
 * Edges that run into the wall (ceiling line, floor line) keep meeting their neighbours because
 * only x is squeezed. Everything else about the photo is as the app draws it.
 *
 * 2026-10-16, the owner's three follow-ups ("выступ должен быть в точке 2 … поправь потолок на правой
 * фотографии, он кривой … левая фотография почти не поменялась, но в силу того что ты сделал балкон
 * уже, там должно было поменяться отображение"):
 * - frame 2's ceiling had bent where the squeeze steepened the wall's top line (measured on the photo:
 *   slope −0.2313, at 23.575 % of the height over x = 50 %), and keeping that line straight with sheared
 *   pieces left the floor line twice as steep as the photo's ("потолок не параллельно полу"), so the wall
 *   is re-cut column by column (`warp`, vamWarp.ts): ceiling and floor both land on level lines, the pan
 *   below keeps the window and sill where they were;
 * - 2026-10-17, "верни как была и просто смести её чуть левее": the camera of this frame moved a little left
 *   along the sill — the picture slides right by 4 % (`warp.slide`), the strip that comes in at the left edge
 *   being the photo's own edge strip, reflected;
 * - point 2 on the blueprint photo is the corner where the far wall meets the house wall (the 400 × 280
 *   ledge of the plan): the warped band is cut into four runs — the far wall (22.5 % of the photo,
 *   kept at 0.4822, darkening into the inner corner), the ledge's side face (5 %, kept at 0.4, lit, with a
 *   bright convex edge), its front face (9 %, kept at 0.6, a little darker toward the house wall) and the
 *   shadow where it meets the house wall (2 %, kept at 0.5) — so the far wall plus the ledge take the same
 *   19.25 % the squeezed wall alone took, the zoom is unchanged, and the ledge is made of the wall's own
 *   pixels (finishes dress it too). The runs are kept near one another (0.4–0.6) on purpose: a finish
 *   with a plank pattern shows the same plank width on the wall and on the ledge. Taken back earlier: a
 *   stepped ceiling with the light and dark faces the wrong way round, a flush stripe with strong tones
 *   that read as a niche or a decal, and swapping this frame for the long-loggia photo (img6_0) with a
 *   rectangular far wall ("зачем ты сломал геометрию балкона… верни как была") — the photo of this
 *   frame stays img10_1. Every edge of the ledge is vertical;
 * - frame 1 squeezes the whole glazed side from the corner strip to the picture's right edge (the
 *   room narrowed, so that side comes in toward the corner, as the lines of its walls would) down to
 *   0.5684 of its width, which gives up the same 19.25 % and so the same zoom as frame 2 — the left
 *   photo now changes as much as the right one.
 *
 * The owner holds the picture as a constant once it is right — do not touch it, or the photo/screen
 * the shape borrows (vamShapes.ts), while working on anything else (plan dimensions in planShapes.ts
 * move the blueprint only and never reach this table). `vamFit.test.ts` pins it.
 */
export const VAM_FITS: Readonly<Record<string, readonly [SceneFit | undefined, SceneFit | undefined]>> = {
  lodochka: [
    // The zoom throws the ceiling's own point (4_3) above the frame; its button stands on the ceiling's lit part,
    // clear of the lamp's (8_7), instead of being pulled onto the lamp's ring.
    { scaleX: 1.2384, scaleY: 1.2384, band: { x0: 55.4, x1: 100, keep: 0.5684 }, taps: { '4_3': [69, 6] } },
    {
      // The second frame is img10_1. The far wall (the finish mask of 6_4: x 45.75–89.25 %, its right edge leaning from
      // 88.4 % at the ceiling to 89.25 % at the floor) is re-cut head-on (vamWarp.ts) into a plain STRAIGHT wall —
      // 2026-10-24, the owner: "верни как было сторону 3, пусть она будет просто прямая" — with no ledge, no step in the
      // ceiling or the floor and no seam. Measured on that mask, its top edge is y 24.861 % at x = 45.75 % with slope
      // −0.229 and its bottom edge y 84.332 % with slope +0.2744 (both straight to within 0.06 %); both land on level
      // lines, and the band gives up 19.25 % of its width (the same zoom as frame 1). The picture left of the wall is
      // the identity in y, so the pan of −1.91 keeps the window and the sill where they were.
      // The wall is made shorter by CUTTING its far end off, not by squeezing it (squeezing halved the width of every
      // board and brick and smeared their joints — "текстура размытая"): the runs, left to right, in photo percent →
      // kept on screen (k = share of the width kept; a `skip` run takes no room):
      //  - 4 % at 1.0: the window's corner strip with its handle;
      //  - eight runs of 3 % (the last 2.93 %) at k = 1 … 0.731: the wall. The photo shows a board wider the nearer it
      //    is, and measured on the finish pictures a board's width grows as the SQUARE of the wall's height at that
      //    column (w / h² = 0.097–0.101 % along the whole wall — a plane receding at an angle), so k = (h₀ / h)² keeps
      //    every board as wide on screen as the first one: a flat wall, not a fan;
      //  - a cut of 15.82 % (x 73.7 → 89.5) that is the rest of the wall up to the door frame. The band ends at 89.5 %,
      //    past the finish mask's slanted right edge, so no wedge of the finish is left standing beside the door frame
      //    (with the band ending at 88.5 % there was a brown sliver, widening toward the floor).
      scaleX: 1.2384,
      scaleY: 1.2384,
      shift: [0, -1.91],
      // The wall's tap target stands on the wall, clear of the window strip.
      taps: { '6_4': [54, 54] },
      warp: {
        x0: 45.75,
        x1: 89.5,
        ceiling: { y: 24.861, slope: -0.229 },
        floor: { y: 84.332, slope: 0.2744 },
        topStart: 24.861,
        floorY: 84.332,
        // The view is turned 9.2 % toward the right end (the wall comes in toward the middle); the picture right of the
        // wall stretches 1.88 times to the frame's edge, as before the band was widened to 89.5 %.
        slide: -9.2,
        // A lamp hangs in the room, not on the wall: it is laid over the warped picture undistorted.
        rigid: ['/lampp11_'],
        spans: [
          { w: 4, k: 1, top: 24.861 },
          { w: 3, k: 1, top: 24.861 },
          { w: 3, k: 0.9532, top: 24.861 },
          { w: 3, k: 0.9096, top: 24.861 },
          { w: 3, k: 0.8689, top: 24.861 },
          { w: 3, k: 0.8309, top: 24.861 },
          { w: 3, k: 0.7953, top: 24.861 },
          { w: 3, k: 0.762, top: 24.861 },
          { w: 2.928, k: 0.7311, top: 24.861 },
          { w: 15.822, k: 1, top: 24.861, skip: true },
        ],
      },
    },
  ],
};

/** The fit of one view of a selection (already flipped for a right-handed screen); undefined = none. */
export function fitFor(
  shapeId: string,
  view: 0 | 1,
  mirror: boolean,
  table: Readonly<Record<string, readonly [SceneFit | undefined, SceneFit | undefined]>> = VAM_FITS,
): SceneFit | undefined {
  const fit = table[shapeId]?.[view];
  if (!fit) return undefined;
  return mirror ? mirrorFit(fit) : fit;
}
