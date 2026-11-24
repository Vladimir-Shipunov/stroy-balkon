/**
 * @file exportSvg — turns a live, on-page `<svg>` (the technical drawing in
 * `ShapePlan.tsx`) into a standalone `.svg` file the user can download. The
 * drawing is already styled with inline SVG attributes (fill/stroke/etc.), not
 * CSS-module classes, so a straight clone + serialize is enough to make the
 * file render correctly outside the app (no external stylesheet to carry over).
 */

/** The width of the downloaded drawing, px: a size to look at and to print, whatever unit the viewBox is in. */
export const EXPORT_WIDTH_PX = 1200;

/**
 * The intrinsic size (the `width` / `height` attributes) of the exported file for a viewBox of `box`: `EXPORT_WIDTH_PX`
 * wide, the viewBox's proportions kept. The plan's viewBox is in millimetres (a 5.6 m drawing is 5633 units wide), so
 * taking it as pixels would open the file several thousand pixels across.
 */
export function exportSize(box: { readonly width: number; readonly height: number }): { width: number; height: number } {
  return { width: EXPORT_WIDTH_PX, height: Math.max(1, Math.round((EXPORT_WIDTH_PX * box.height) / box.width)) };
}

/** The viewBox's size, when the drawing has a usable one. */
function viewBoxSize(svgEl: SVGSVGElement): { width: number; height: number } | undefined {
  const vb = svgEl.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) return { width: vb.width, height: vb.height };
  return undefined;
}

/**
 * Clones `svgEl`, makes it a self-contained document (explicit xmlns, width,
 * height) and triggers a browser download of it as `filename`.
 * @param svgEl The live, rendered SVG element to export.
 * @param filename The file name to save as (should end in `.svg`).
 */
export function downloadSvgElement(svgEl: SVGSVGElement, filename: string): void {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  if (!clone.getAttribute('width') || !clone.getAttribute('height')) {
    const box = viewBoxSize(svgEl);
    // Without a viewBox the content is in pixels already: keep the on-page size.
    const size = box ? exportSize(box) : { width: svgEl.clientWidth || 800, height: svgEl.clientHeight || 600 };
    clone.setAttribute('width', String(Math.round(size.width)));
    clone.setAttribute('height', String(Math.round(size.height)));
  }

  // Drop any React/testing instrumentation attributes that leaked onto the root node.
  clone.removeAttribute('class');

  const serialized = new XMLSerializer().serializeToString(clone);
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${serialized}`;
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Builds a filesystem-safe `.svg` filename from the shape's Russian label. */
export function svgFilename(shapeLabel: string): string {
  const slug = shapeLabel
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/giu, '-')
    .replace(/^-+|-+$/g, '');
  return `chertezh-balkona${slug ? `-${slug}` : ''}.svg`;
}
