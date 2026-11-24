/**
 * @file The far-wall warp of a photo frame: a vertical band of the picture — a wall seen from the
 * side, its ceiling line climbing and its floor line falling away from each other like the two sides
 * of a fan — is re-cut into a wall seen head-on: ceiling and floor both level and parallel, the wall
 * shorter than it was, a ledge standing out of its end. Each column of the band is squeezed sideways
 * (the wall's length) and stretched or shrunk up and down so that the line where the wall meets the
 * ceiling and the line where it meets the floor land on level lines; the pictures on either side move
 * rigidly in y and are scaled just enough to meet the wall's ends.
 *
 * A plain affine cannot do it (two lines of different slope never become parallel under one), which is
 * why the older band of `vamFit.ts` — pieces moved by CSS — had left the floor line twice as steep as the
 * photo's. Here every column has its own vertical scale, so the warp is drawn onto a canvas
 * (`VamScene.tsx`), column by column, from the numbers below.
 *
 * A ledge standing out of the wall toward the camera is nearer than the wall, so its front face is the wall
 * scaled up about the picture's vanishing point — its top edge is higher, its bottom edge lower — and its side
 * face is the trapezoid between the wall and the front face: both the top and the bottom edge of a run are
 * therefore levels that change along the run (`top`, `bottom`).
 *
 * All values are percent of the (square) picture, y down, in the displayed orientation; `vamFit.ts`
 * mirrors a spec for the right-handed screen. Pure maths — no DOM.
 */
import type { FitPt, FitShade, ShadeStop } from './vamFit';

/** A line in the photo: its height `y` at the band's left column and its slope (rise over run, y down). */
export interface FitLine {
  readonly y: number;
  readonly slope: number;
}

/** A run of columns of the warped wall, squeezed on its own, with where its top and bottom edges end up and how it is shaded. */
export interface WarpSpan {
  /** Width of the run in the photo. */
  readonly w: number;
  /** The share of that width it keeps on screen. */
  readonly k: number;
  /** Height of the ceiling line at the run's right end once warped (its left end is where the run before ended). */
  readonly top: number;
  /** Height of the floor line at the run's right end once warped; left out, the run keeps the level the run before ended at. */
  readonly bottom?: number;
  /** Shade ramp over the run's wall surface (signed opacity stops across it; negative = black, positive = white). */
  readonly shade?: readonly ShadeStop[];
  /** The ceiling's contact shadow on the run: darkness right under the top line (0..1), fade height (percent). */
  readonly ao?: readonly [number, number];
  /**
   * The run's columns are cut out of the picture: they take no room on screen (`k` is not used). A wall is made
   * shorter by cutting a piece out of it, not by squeezing the whole — squeezing halves the width of every board and
   * brick and smears their joints, cutting leaves what remains at its natural scale and sharp. The cut sits where
   * one surface ends and another begins (the inner corner), so no seam shows inside a surface.
   */
  readonly skip?: boolean;
}

export interface FitWarp {
  /** The band of the photo that is re-cut: columns `x0`..`x1`. */
  readonly x0: number;
  readonly x1: number;
  /** Where the wall meets the ceiling / the floor in the photo (given at `x0`). */
  readonly ceiling: FitLine;
  readonly floor: FitLine;
  /** Where the ceiling line starts at the band's left end once warped; every run's `top` follows from it. */
  readonly topStart: number;
  /** The level the floor line starts at at the band's left end once warped (and keeps, unless a run says otherwise). */
  readonly floorY: number;
  readonly spans: readonly WarpSpan[];
  /**
   * How far the view is turned sideways (percent of the picture before the zoom; negative = toward the right — the
   * camera looks more at what stands at the right end, so that end comes in toward the middle). The band, and the
   * picture on the side it moves away from, slide rigidly (what slides out of the frame is cut); the picture on the
   * other side is stretched sideways to meet the frame's edge again, so no pixel has to be invented. Keep it a
   * few percent.
   */
  readonly slide?: number;
  /**
   * Layers (by a part of their url) that are laid over the warped picture as they are, undistorted, with their top
   * centre standing where the warp puts that point of the photo — a lamp hung in the room is not part of the wall,
   * and a squeeze that is right for the wall tears it.
   */
  readonly rigid?: readonly string[];
}

/** A run laid out: where it starts in the photo (`xs`) and on screen (`xt`), how wide it is there (`wt`), and its edges' levels. */
export interface WarpRun extends WarpSpan {
  readonly xs: number;
  readonly xt: number;
  readonly wt: number;
  readonly topFrom: number;
  readonly bottomFrom: number;
  readonly bottom: number;
}

export interface WarpLayout {
  readonly warp: FitWarp;
  /** Width the band gives up. */
  readonly drop: number;
  /** The sideways turn of the view. */
  readonly slide: number;
  readonly runs: readonly WarpRun[];
  /** Vertical scale of the picture left / right of the band (it meets the wall's end there). */
  readonly scaleLeft: number;
  readonly scaleRight: number;
  /** How much the picture left / right of the band is stretched sideways (1 = not at all). */
  readonly stretchLeft: number;
  readonly stretchRight: number;
  /** Ceiling and floor levels at the band's right end. */
  readonly topEnd: number;
  readonly bottomEnd: number;
}

/** Height of the wall's top line in the photo at column `x`. */
export const warpSourceTop = (warp: FitWarp, x: number): number => warp.ceiling.y + warp.ceiling.slope * (x - warp.x0);

/** Height of the wall's floor line in the photo at column `x`. */
export const warpSourceFloor = (warp: FitWarp, x: number): number => warp.floor.y + warp.floor.slope * (x - warp.x0);

/** How the band's runs, and the pictures either side of it, land (before the slide: `xt` is where a column would stand with no slide). */
export function warpLayout(warp: FitWarp): WarpLayout {
  const drop = warp.x1 - warp.x0 - warp.spans.reduce((sum, s) => sum + (s.skip ? 0 : s.w * s.k), 0);
  const slide = warp.slide ?? 0;
  let xs = warp.x0;
  let xt = warp.x0 + drop / 2;
  let level = warp.topStart;
  let floorLevel = warp.floorY;
  const runs = warp.spans.map((s) => {
    const bottom = s.bottom ?? floorLevel;
    const wt = s.skip ? 0 : s.w * s.k;
    const run: WarpRun = { ...s, xs, xt, wt, topFrom: level, bottomFrom: floorLevel, bottom };
    xs += s.w;
    xt += wt;
    level = s.top;
    floorLevel = bottom;
    return run;
  });
  const wallHeight = (x: number): number => warpSourceFloor(warp, x) - warpSourceTop(warp, x);
  return {
    warp,
    drop,
    slide,
    runs,
    scaleLeft: (warp.floorY - warp.topStart) / wallHeight(warp.x0),
    scaleRight: (floorLevel - level) / wallHeight(warp.x1),
    stretchLeft: slide > 0 && warp.x0 > 0 ? (warp.x0 + slide) / warp.x0 : 1,
    stretchRight: slide < 0 && warp.x1 < 100 ? (100 - warp.x1 - slide) / (100 - warp.x1) : 1,
    topEnd: level,
    bottomEnd: floorLevel,
  };
}

/** Where the band's left end stands on screen (before any zoom), with the slide. */
const bandStart = (layout: WarpLayout): number => layout.warp.x0 + layout.drop / 2 + layout.slide;

/** Where the band's right end stands on screen (before any zoom), with the slide. */
const bandEnd = (layout: WarpLayout): number => layout.warp.x1 - layout.drop / 2 + layout.slide;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** The run that owns column `xt` (without the slide) on screen. */
function runAtScreen(layout: WarpLayout, xt: number): WarpRun {
  const shown = layout.runs.filter((r) => r.wt > 0);
  return shown.find((r) => xt <= r.xt + r.wt) ?? shown[shown.length - 1]!;
}

/** Ceiling level on screen (before any zoom) at column `xt` (without the slide) inside the warped band. */
export function warpTopAt(layout: WarpLayout, xt: number): number {
  const run = runAtScreen(layout, xt);
  const t = run.wt > 0 ? clamp01((xt - run.xt) / run.wt) : 0;
  return run.topFrom + (run.top - run.topFrom) * t;
}

/** Floor level on screen (before any zoom) at column `xt` (without the slide) inside the warped band. */
export function warpBottomAt(layout: WarpLayout, xt: number): number {
  const run = runAtScreen(layout, xt);
  const t = run.wt > 0 ? clamp01((xt - run.xt) / run.wt) : 0;
  return run.bottomFrom + (run.bottom - run.bottomFrom) * t;
}

/** Vertical scale of the photo's column `xs` once it stands at screen column `xt` (without the slide) inside the band. */
function bandScale(layout: WarpLayout, xt: number, xs: number): number {
  const { warp } = layout;
  return (warpBottomAt(layout, xt) - warpTopAt(layout, xt)) / (warpSourceFloor(warp, xs) - warpSourceTop(warp, xs));
}

/** Where a point of the photo ends up once warped (and turned), before any zoom. */
export function warpPoint(layout: WarpLayout, x: number, y: number): FitPt {
  const { warp, drop, slide } = layout;
  const half = drop / 2;
  if (x <= warp.x0) {
    // The picture left of the band: stretched when the view turns away from it, shifted when it turns toward the band's far end.
    const shift = slide < 0 ? slide : 0;
    return [half + shift + x * layout.stretchLeft, warp.topStart + (y - warpSourceTop(warp, warp.x0)) * layout.scaleLeft];
  }
  if (x >= warp.x1) {
    return [bandEnd(layout) + (x - warp.x1) * layout.stretchRight, layout.topEnd + (y - warpSourceTop(warp, warp.x1)) * layout.scaleRight];
  }
  const run = layout.runs.find((r) => x <= r.xs + r.w) ?? layout.runs[layout.runs.length - 1]!;
  // A cut-out column has no place of its own: it collapses onto the seam where the cut closes.
  const xt = run.skip ? run.xt : run.xt + run.k * (x - run.xs);
  const scale = bandScale(layout, xt, x);
  return [xt + slide, warpTopAt(layout, xt) + (y - warpSourceTop(warp, x)) * scale];
}

/**
 * What to draw in the destination column centred at `destination` (percent): the photo column to sample (`xs`), how
 * many photo columns that destination column spans (`span`: 1 = one-to-one, 2 = squeezed to half, under 1 = stretched),
 * and the vertical map y' = scaleY · y + offsetY from the photo's rows to the destination's.
 */
export interface WarpColumn {
  readonly xs: number;
  readonly span: number;
  readonly scaleY: number;
  readonly offsetY: number;
}

export function warpColumn(layout: WarpLayout, destination: number): WarpColumn {
  const { warp, drop, slide } = layout;
  const half = drop / 2;
  if (destination <= bandStart(layout)) {
    const shift = slide < 0 ? slide : 0;
    const scale = layout.scaleLeft;
    return {
      xs: Math.max(0, (destination - half - shift) / layout.stretchLeft),
      span: 1 / layout.stretchLeft,
      scaleY: scale,
      offsetY: warp.topStart - scale * warpSourceTop(warp, warp.x0),
    };
  }
  if (destination >= bandEnd(layout)) {
    const scale = layout.scaleRight;
    return {
      xs: Math.min(100, warp.x1 + (destination - bandEnd(layout)) / layout.stretchRight),
      span: 1 / layout.stretchRight,
      scaleY: scale,
      offsetY: layout.topEnd - scale * warpSourceTop(warp, warp.x1),
    };
  }
  const xt = destination - slide;
  const run = runAtScreen(layout, xt);
  const xs = run.xs + (xt - run.xt) / run.k;
  const scale = bandScale(layout, xt, xs);
  return { xs, span: 1 / run.k, scaleY: scale, offsetY: warpTopAt(layout, xt) - scale * warpSourceTop(warp, xs) };
}

const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;

/** The shading of every shaded run, as `FitShade`s in destination coordinates (percent, turned, before any zoom). */
export function warpShades(layout: WarpLayout): readonly FitShade[] {
  return layout.runs.flatMap((run): FitShade[] =>
    run.shade
      ? [
          {
            x0: round5(run.xt + layout.slide),
            x1: round5(run.xt + run.wt + layout.slide),
            stops: run.shade,
            top: [round5(run.topFrom), round5(run.top)] as const,
            bottom: [round5(run.bottomFrom), round5(run.bottom)] as const,
            ...(run.ao ? { ao: run.ao } : {}),
          },
        ]
      : [],
  );
}

/** A warp seen in a mirror: the band flips, its runs reverse, the lines turn over, the turn goes the other way, and the edge levels read from the other end. */
export function mirrorWarp(warp: FitWarp): FitWarp {
  const width = warp.x1 - warp.x0;
  const tops = [warp.topStart, ...warp.spans.map((s) => s.top)].reverse();
  const bottoms: number[] = [warp.floorY];
  for (const s of warp.spans) bottoms.push(s.bottom ?? bottoms[bottoms.length - 1]!);
  bottoms.reverse();
  return {
    x0: 100 - warp.x1,
    x1: 100 - warp.x0,
    // The lines are given at the band's left end, which is the old right end once mirrored.
    ceiling: { y: warp.ceiling.y + warp.ceiling.slope * width, slope: -warp.ceiling.slope },
    floor: { y: warp.floor.y + warp.floor.slope * width, slope: -warp.floor.slope },
    topStart: tops[0]!,
    floorY: bottoms[0]!,
    spans: [...warp.spans].reverse().map((s, i) => ({
      w: s.w,
      k: s.k,
      top: tops[i + 1]!,
      ...(s.skip ? { skip: true } : {}),
      ...(warp.spans.some((span) => span.bottom !== undefined) ? { bottom: bottoms[i + 1]! } : {}),
      ...(s.shade ? { shade: [...s.shade].reverse().map(([position, v]) => [round5(1 - position), v] as const) } : {}),
      ...(s.ao ? { ao: s.ao } : {}),
    })),
    ...(warp.slide !== undefined ? { slide: -warp.slide } : {}),
    ...(warp.rigid ? { rigid: warp.rigid } : {}),
  };
}
