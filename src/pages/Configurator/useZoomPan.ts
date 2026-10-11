/**
 * @file useZoomPan — shared zoom/pan behaviour for the plan and photo balcony
 * scenes (`PlanScene.tsx`, `VamScene.tsx`). Both stack a canvas/images layer
 * together with percentage-positioned hotspot buttons inside one wrapper; this
 * hook only ever hands back a CSS `transform` for that wrapper, so the
 * hotspots scale and move in lockstep with the picture without their own
 * percentage math changing.
 *
 * Supports mouse wheel zoom, pinch-to-zoom and single-finger pan (once
 * zoomed in) via the Pointer Events API, plus imperative `zoomIn`/`zoomOut`/
 * `reset` for on-screen buttons. A small drag-distance threshold tells a tap
 * (which should still open a hotspot) apart from a pan gesture.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const WHEEL_SCALE_STEP = 0.0018;
const BUTTON_SCALE_STEP = 1.3;
/** Pointer movement, in px, beyond which a gesture counts as a drag rather than a click. */
const DRAG_THRESHOLD = 6;

interface ZoomPanState {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

const INITIAL_STATE: ZoomPanState = { scale: MIN_SCALE, x: 0, y: 0 };

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

export interface UseZoomPanResult {
  /** Attach to the fixed-size element that should receive gestures (not the scaled one). */
  readonly containerRef: (el: HTMLDivElement | null) => void;
  /** Spread onto the same element `containerRef` is attached to. */
  readonly containerHandlers: {
    readonly onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
    readonly onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
    readonly onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
    readonly onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
    readonly onClickCapture: (e: ReactMouseEvent<HTMLDivElement>) => void;
  };
  /** Apply to the wrapper that contains BOTH the picture and the hotspot overlay. */
  readonly style: CSSProperties;
  readonly scale: number;
  readonly isZoomed: boolean;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly reset: () => void;
}

/** Zoom/pan state + gesture handlers for one balcony scene. */
export function useZoomPan(): UseZoomPanResult {
  const [state, setState] = useState<ZoomPanState>(INITIAL_STATE);
  const [interacting, setInteracting] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);

  // Active pointers, keyed by pointerId — map size tells a one-finger pan
  // apart from a two-finger pinch.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const pinchDistanceRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const maxOffset = useCallback((scale: number): number => {
    const el = elRef.current;
    if (!el || scale <= 1) return 0;
    const rect = el.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    return (size * (scale - 1)) / 2;
  }, []);

  const applyScale = useCallback(
    (nextScale: number) => {
      setState((prev) => {
        const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
        const bound = maxOffset(scale);
        return { scale, x: clamp(prev.x, -bound, bound), y: clamp(prev.y, -bound, bound) };
      });
    },
    [maxOffset],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      setState((prev) => {
        if (prev.scale <= 1) return prev;
        const bound = maxOffset(prev.scale);
        return { ...prev, x: clamp(prev.x + dx, -bound, bound), y: clamp(prev.y + dy, -bound, bound) };
      });
    },
    [maxOffset],
  );

  const zoomIn = useCallback(() => applyScale(state.scale * BUTTON_SCALE_STEP), [applyScale, state.scale]);
  const zoomOut = useCallback(() => applyScale(state.scale / BUTTON_SCALE_STEP), [applyScale, state.scale]);
  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    elRef.current = el;
  }, []);

  // Wheel zoom needs a non-passive native listener so preventDefault (no page
  // scroll while zooming the scene) actually works — React's onWheel prop is
  // attached passively and would just warn.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * WHEEL_SCALE_STEP);
      applyScale(state.scale * factor);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyScale, state.scale]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Capture is deferred to onPointerMove, once the gesture actually turns into a
    // drag/pinch (see there for why): capturing unconditionally here redirects the
    // matching pointerup — and the click the browser synthesizes from it — to this
    // container instead of whatever hotspot button is under the pointer, silently
    // breaking every tap (confirmed live: a real click never reached the button's
    // onClick, while a programmatic .click() on the same button worked fine).
    setInteracting(true);
    if (pointersRef.current.size === 1) {
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current = false;
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      pinchDistanceRef.current = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
    }
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      const prevPoint = pointersRef.current.get(e.pointerId)!;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size >= 2) {
        if (!movedRef.current) e.currentTarget.setPointerCapture?.(e.pointerId);
        movedRef.current = true;
        const pts = Array.from(pointersRef.current.values());
        const distance = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        const prevDistance = pinchDistanceRef.current;
        if (prevDistance && prevDistance > 0) {
          applyScale(state.scale * (distance / prevDistance));
        }
        pinchDistanceRef.current = distance;
        return;
      }

      const start = dragStartRef.current;
      if (!start) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD) {
        // Only now does this gesture count as a drag rather than a tap — capture the
        // pointer so panning keeps tracking it even if it leaves the container.
        if (!movedRef.current) e.currentTarget.setPointerCapture?.(e.pointerId);
        movedRef.current = true;
      }
      const dx = e.clientX - prevPoint.x;
      const dy = e.clientY - prevPoint.y;
      panBy(dx, dy);
    },
    [applyScale, panBy, state.scale],
  );

  const endPointer = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      if (movedRef.current) suppressClickRef.current = true;
      movedRef.current = false;
      dragStartRef.current = null;
      pinchDistanceRef.current = null;
      setInteracting(false);
    } else if (pointersRef.current.size === 1) {
      // Dropped from a pinch back to a single finger — restart the pan baseline.
      const [remaining] = Array.from(pointersRef.current.values());
      dragStartRef.current = remaining ? { ...remaining } : null;
      pinchDistanceRef.current = null;
    }
  }, []);

  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }, []);

  const style = useMemo<CSSProperties>(
    () => ({
      transform: `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`,
      transition: interacting ? 'none' : undefined,
    }),
    [state.x, state.y, state.scale, interacting],
  );

  return {
    containerRef,
    containerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onClickCapture,
    },
    style,
    scale: state.scale,
    isZoomed: state.scale > 1,
    canZoomIn: state.scale < MAX_SCALE - 1e-3,
    canZoomOut: state.scale > MIN_SCALE + 1e-3,
    zoomIn,
    zoomOut,
    reset,
  };
}
