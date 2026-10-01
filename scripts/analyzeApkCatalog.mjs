/**
 * @file One-off analysis tool: walks the extracted Vam Balkon APK's Flutter
 * asset tree and builds a structured JSON catalog of every construktor image
 * (category, path, dimensions, average color, parsed variant/frame tokens).
 * Reads only from D:\VamBalkon_extract\APK (never modifies it). Output feeds
 * the architecture/design decisions in docs/vam-balkon-apk-analysis.md — it
 * is not wired into the running app.
 *
 * Usage: node scripts/analyzeApkCatalog.mjs
 */
import { readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const APK_IMAGES_ROOT = 'D:\\VamBalkon_extract\\APK\\assets\\flutter_assets\\assets\\images';
const OUT_DIR = path.join(process.cwd(), 'docs', 'apk-catalog');

/** Recursively collect all .webp/.png/.jpg files under a directory, returning paths relative to `base`. */
function walk(dir, base, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, base, out);
    } else if (/\.(webp|png|jpe?g)$/i.test(entry.name)) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

/** Parse a filename like "shkaf_ldsp0_1_8.webp" or "cvet1_0.webp" into best-effort tokens. */
function parseFilename(filename) {
  const stem = filename.replace(/\.(webp|png|jpe?g)$/i, '');
  const parts = stem.split('_');
  const frame = /^\d+$/.test(parts[parts.length - 1]) ? Number(parts[parts.length - 1]) : null;
  const variantBase = frame !== null ? parts.slice(0, -1).join('_') : stem;
  const colorMatch = stem.match(/cvet(\d+)/i);
  const color = colorMatch ? Number(colorMatch[1]) : null;
  return { variantBase, frame, colorIndex: color };
}

/** Derive category/subpath info from a construktor-relative path, e.g. "vagonka/4m/stena1/cvet1_0.webp". */
function classifyConstruktorPath(relPath) {
  const segments = relPath.split('/');
  const filename = segments[segments.length - 1];
  const folderChain = segments.slice(0, -1); // e.g. ['vagonka','4m','stena1'] or ['stena1'] or []
  const category = folderChain[0] ?? '(root-accessory)';
  const shapeSegment = folderChain.find((s) => /^stena\d+$/.test(s)) ?? null;
  const sizeSegment = folderChain.find((s) => /^\d+m$/.test(s)) ?? null;
  return { category, folderChain, filename, shapeSegment, sizeSegment };
}

async function averageColorHex(absPath) {
  try {
    const { data, info } = await sharp(absPath).resize(1, 1, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    if (info.channels >= 4 && data[3] === 0) return null; // fully transparent pixel
    const [r, g, b] = data;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return null;
  }
}

async function buildCatalog() {
  const construktorDir = path.join(APK_IMAGES_ROOT, 'construktor');
  const relPaths = walk(construktorDir, construktorDir).sort();

  const entries = [];
  let processed = 0;
  for (const relPath of relPaths) {
    const absPath = path.join(construktorDir, relPath);
    const stat = statSync(absPath);
    const isEmptyPlaceholder = stat.size <= 100;
    const { category, folderChain, filename, shapeSegment, sizeSegment } = classifyConstruktorPath(relPath);
    const { variantBase, frame, colorIndex } = parseFilename(filename);

    let width = null;
    let height = null;
    let aspectRatio = null;
    let avgColor = null;

    if (!isEmptyPlaceholder) {
      try {
        const meta = await sharp(absPath).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
        aspectRatio = width && height ? Number((width / height).toFixed(3)) : null;
      } catch {
        /* unreadable image, leave dims null */
      }
      avgColor = await averageColorHex(absPath);
    }

    entries.push({
      category,
      parentChain: folderChain,
      shapeVariant: shapeSegment,
      sizeVariant: sizeSegment,
      name: variantBase,
      colorIndex,
      frame,
      isEmptyPlaceholder,
      file: `construktor/${relPath}`,
      ext: path.extname(filename).slice(1),
      fileSizeBytes: stat.size,
      width,
      height,
      aspectRatio,
      avgColorHex: avgColor,
    });

    processed += 1;
    if (processed % 300 === 0) {
      process.stderr.write(`  ...${processed}/${relPaths.length}\n`);
    }
  }

  return entries;
}

/** Roll the flat per-file catalog up into distinct logical objects/materials (ignoring individual frames). */
function buildSummary(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = `${e.category}::${e.parentChain.join('/')}::${e.name}`;
    if (!groups.has(key)) {
      groups.set(key, {
        category: e.category,
        parentChain: e.parentChain,
        shapeVariant: e.shapeVariant,
        sizeVariant: e.sizeVariant,
        name: e.name,
        colorIndex: e.colorIndex,
        frameCount: 0,
        emptyFrameCount: 0,
        sampleFile: null,
        avgColorHex: null,
        width: null,
        height: null,
      });
    }
    const g = groups.get(key);
    g.frameCount += 1;
    if (e.isEmptyPlaceholder) g.emptyFrameCount += 1;
    if (!g.sampleFile && !e.isEmptyPlaceholder) {
      g.sampleFile = e.file;
      g.avgColorHex = e.avgColorHex;
      g.width = e.width;
      g.height = e.height;
    }
  }

  const byCategory = {};
  for (const g of groups.values()) {
    byCategory[g.category] ??= [];
    byCategory[g.category].push(g);
  }
  for (const list of Object.values(byCategory)) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return byCategory;
}

async function main() {
  console.log('Walking construktor asset tree and reading image metadata (this can take a minute)...');
  const entries = await buildCatalog();
  const summary = buildSummary(entries);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, 'catalog-full.json'), JSON.stringify(entries, null, 2));
  writeFileSync(path.join(OUT_DIR, 'catalog-summary.json'), JSON.stringify(summary, null, 2));

  const categoryCounts = Object.fromEntries(
    Object.entries(summary).map(([cat, items]) => [cat, items.length]),
  );
  console.log(`\nTotal raw files: ${entries.length}`);
  console.log(`Distinct logical objects/materials per category:`);
  console.log(JSON.stringify(categoryCounts, null, 2));
  console.log(`\nWritten:\n  ${path.join(OUT_DIR, 'catalog-full.json')}\n  ${path.join(OUT_DIR, 'catalog-summary.json')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
