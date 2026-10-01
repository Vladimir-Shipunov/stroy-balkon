#!/usr/bin/env node
/**
 * @file Imports the Vam Balkon 2D balcony scenes from the extracted APK into
 * `public/vam/` and generates `src/pages/Configurator/vamManifest.ts`.
 *
 * How the source is organised (decoded from the compiled app + visual checks,
 * see docs/vam-2d-mapping.md):
 *  - `construktor/stenaN/cvetM_K.webp` — every file is an 800x800 layer that
 *    already sits at its final position, so layers just stack at (0,0).
 *  - N = which piece of the room (5,8 = floor; 1,2,3,4,6,7,9,10 = walls,
 *    ceiling, windows, sill), M = balcony layout, K = colour (finish/paint).
 *  - Wall material families live in different folders: laminat (stenaN),
 *    vagonka/4m/stenaN, sten_parket/4m/stenaN (parket), mdf/stenaN.
 *
 * The source is a machine-specific extract outside the repo; the script and
 * its output (files + manifest) are committed, so the app never reads `D:\`.
 *
 * Usage: node scripts/importVamAssets.mjs [path-to-VamBalkon_extract] [--dry]
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const extractRoot = args.find((a) => !a.startsWith('--')) ?? 'D:\\VamBalkon_extract';
const src = path.join(extractRoot, 'construktor');
const outRoot = path.resolve('public/vam');
const manifestFile = path.resolve('src/pages/Configurator/vamManifest.ts');

if (!existsSync(src)) {
  console.error(`Source not found: ${src}\nPass the VamBalkon_extract path as an argument.`);
  process.exit(1);
}

const FLOOR_PIECES = [5, 8];

/** Folder of a wall material family for piece N. */
const FAMILY_DIR = {
  laminat: (p) => path.join(src, `stena${p}`),
  vagonka: (p) => path.join(src, 'vagonka', '4m', `stena${p}`),
  parket: (p) => path.join(src, 'sten_parket', '4m', `stena${p}`),
  mdf: (p) => path.join(src, 'mdf', `stena${p}`),
};
const FAMILY_LABEL = {
  laminat: 'Ламинат',
  vagonka: 'Вагонка',
  parket: 'Стеновой паркет',
  mdf: 'МДФ-панели',
};

/**
 * `m` is the layout index (cvetM) per family/piece; vagonka numbers the square
 * balcony's window pieces 5 where the other families use 6.
 */
/**
 * Floors come in two families: laminate (`cvetM_K`) and tile (`plitka_cvetM_K`).
 * The tile sets are numbered independently (`tileM`): matched to each layout's
 * floor silhouette by overlap (99-100%), not by the wall numbering.
 */
const FLOOR_FAMILIES = [
  { id: 'laminat', label: 'Ламинат', name: (layout) => `cvet${layout.floorM}` },
  { id: 'plitka', label: 'Плитка', name: (layout) => `plitka_cvet${layout.tileM}` },
];

/**
 * One entry = one camera view of a balcony (the app shows two per balcony). A view
 * is a bare-balcony background (`imgN_K`, several files are stacked when a glazing
 * needs an overlay) plus the pieces of one M-set that fit it: floor + end wall for
 * the sets drawn to sit inside a background, or the full wall/ceiling set (M1, M4)
 * that carries its own left side. Pairs were checked by compositing them.
 */
const LAYOUTS = [
  {
    id: 'p',
    label: 'П-образный',
    hint: 'торцевое окно',
    floorM: 1,
    tileM: 3,
    mainPiece: 1,
    wallPieces: [1, 2, 3, 4, 6, 7, 9, 10],
    families: { laminat: () => 1, vagonka: () => 1, parket: () => 1, mdf: () => 1 },
    glazings: [
      { id: 'classic', label: 'Окна от парапета', glazingType: 'classic', bg: ['4_0'], rama: '4', pod: null },
      { id: 'panoramic', label: 'Панорамное', glazingType: 'panoramic', bg: ['5_0'], rama: '5', pod: null },
    ],
  },
  {
    id: 'g',
    label: 'Г-образный',
    hint: 'окна с двух сторон',
    floorM: 2,
    tileM: 4,
    mainPiece: 6,
    wallPieces: [1, 6],
    families: { laminat: () => 2, vagonka: () => 2, parket: () => 2 },
    glazings: [
      { id: 'classic', label: 'Окна от парапета', glazingType: 'classic', bg: ['2_0'], rama: null, pod: '2' },
      { id: 'panoramic', label: 'Панорамное', glazingType: 'panoramic', bg: ['2_0', '2_7'], rama: null, pod: null },
    ],
  },
  {
    id: 'c',
    label: 'Лоджия',
    hint: 'окна с двух сторон',
    floorM: 2,
    tileM: 4,
    mainPiece: 6,
    wallPieces: [1, 6],
    families: { laminat: () => 3, vagonka: () => 3, parket: () => 3 },
    glazings: [
      { id: 'classic', label: 'Окна от парапета', glazingType: 'classic', bg: ['6_0'], rama: '6', pod: '6' },
      { id: 'panoramic', label: 'Панорамное', glazingType: 'panoramic', bg: ['7_0'], rama: '7', pod: '7' },
    ],
  },
  {
    id: 'l1',
    label: 'Длинная лоджия',
    hint: 'окна с двух сторон',
    floorM: 4,
    tileM: 1,
    mainPiece: 1,
    wallPieces: [1, 2, 3, 4, 6, 7, 9, 10],
    families: { laminat: () => 4, vagonka: () => 4, parket: () => 4 },
    glazings: [
      { id: 'classic', label: 'Окна от парапета', glazingType: 'classic', bg: ['8_0'], rama: '8', pod: '8' },
      { id: 'panoramic', label: 'Панорамное', glazingType: 'panoramic', bg: ['9_0'], rama: '9', pod: '9' },
    ],
  },
  {
    id: 'l2',
    label: 'Длинная лоджия, другая сторона',
    hint: 'окна с двух сторон',
    floorM: 5,
    tileM: 1,
    mainPiece: 6,
    wallPieces: [1, 6],
    families: { laminat: () => 5, vagonka: () => 5, parket: () => 5 },
    glazings: [
      { id: 'classic', label: 'Окна от парапета', glazingType: 'classic', bg: ['8_1'], rama: '81', pod: '81' },
      { id: 'panoramic', label: 'Панорамное', glazingType: 'panoramic', bg: ['9_1'], rama: '91', pod: '91' },
    ],
  },
  {
    id: 'u1',
    label: 'П-44Т, левый вид',
    hint: 'угловое окно',
    floorM: 2,
    tileM: 4,
    mainPiece: 6,
    wallPieces: [1, 6],
    families: { laminat: () => 3, vagonka: () => 3, parket: () => 3 },
    glazings: [{ id: 'classic', label: 'Окна от парапета', glazingType: 'classic', bg: ['10_0'], rama: '10', pod: null }],
  },
  {
    id: 'u2',
    label: 'П-44Т, правый вид',
    hint: 'угловое окно',
    floorM: 2,
    tileM: 4,
    mainPiece: 6,
    wallPieces: [1, 6],
    families: { laminat: () => 3, vagonka: () => 3, parket: () => 3 },
    glazings: [{ id: 'classic', label: 'Окна от парапета', glazingType: 'classic', bg: ['10_1'], rama: '101', pod: null }],
  },
];

/**
 * Glazing variants (see docs/vam-2d-mapping.md): a bare-balcony background
 * `imgN_K.webp` replaces the two window pieces of the layout; `rama<N>_K` recolours
 * the window frames and `podokonnik<N>_K` the sill (series N = background N).
 * Colour 0 of both is a blank layer = the default white.
 */
const WINDOW_PIECES = [2, 10];
const BG_DIR = path.join(extractRoot, 'APK', 'assets', 'flutter_assets', 'assets', 'images');
const SILL_DIR = path.join(src, 'laminat_podokonnik');
/** Swatch colour of the frame variants (K>0): the sprite also holds the glass, so its mean is no use. */
const FRAME_HEX = { 0: '#f2f2ef', 1: '#c8bf9a', 2: '#3b302b', 3: '#1d1d1d', 4: '#1d1d1d', 5: '#8c4b32' };

const file = (dir, m, k) => path.join(dir, `cvet${m}_${k}.webp`);

/** Source file for a wall piece, or null. Families missing a piece borrow it from vagonka. */
function wallSource(layout, family, piece, k) {
  const own = file(FAMILY_DIR[family](piece), layout.families[family](piece), k);
  if (existsSync(own)) return own;
  if (family === 'parket') {
    const borrowed = file(FAMILY_DIR.vagonka(piece), layout.families.vagonka(piece), k);
    if (existsSync(borrowed)) return borrowed;
  }
  return null;
}

function floorSource(layout, family, piece, k) {
  const f = path.join(src, `stena${piece}`, `${family.name(layout)}_${k}.webp`);
  return existsSync(f) ? f : null;
}

/** Alpha-weighted mean colour of a layer, as #rrggbb (for the swatch chip). */
async function averageHex(f) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] > 200) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  if (!n) return '#888888';
  const h = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

let totalBytes = 0;
let files = 0;
/** The extract stores near-lossless webp (~10x larger); re-encode so the repo stays small. */
async function copyOne(from, to) {
  files += 1;
  if (dry) {
    totalBytes += statSync(from).size;
    return;
  }
  mkdirSync(path.dirname(to), { recursive: true });
  await sharp(from).webp({ quality: 82, alphaQuality: 90, effort: 5 }).toFile(to);
  totalBytes += statSync(to).size;
}

/**
 * A furniture/decor sprite as an 800x800 PNG buffer. Some sprites are drawn on a
 * 1200x1200 canvas with a 200px margin: the 800 scene is their centre crop.
 */
async function sprite800(f) {
  const md = await sharp(f).metadata();
  if (md.width === 1200 && md.height === 1200) {
    return sharp(f).extract({ left: 200, top: 200, width: 800, height: 800 }).png().toBuffer();
  }
  return sharp(f).png().toBuffer();
}

/** Bounding box + mean colour of the opaque part of an 800x800 sprite; `null` when blank. */
async function spriteInfo(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * info.channels;
      if (data[i + 3] > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (data[i + 3] > 200) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n += 1;
      }
    }
  }
  if (maxX < 0 || !n) return null;
  const h = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return { box: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }, hex: `#${h(r)}${h(g)}${h(b)}` };
}

/** Write a sprite layer (800x800 webp). Returns its colour info, or null when the frame is blank. */
async function writeSprite(from, to) {
  const buf = await sprite800(from);
  const info = await spriteInfo(buf);
  if (!info) return null;
  files += 1;
  if (!dry) {
    mkdirSync(path.dirname(to), { recursive: true });
    await sharp(buf).webp({ quality: 82, alphaQuality: 90, effort: 5 }).toFile(to);
    totalBytes += statSync(to).size;
  }
  return info;
}

/** A small picker icon: the sprite cropped to its silhouette on a square, transparent canvas. */
async function writeThumb(from, to, size = 96) {
  if (dry) return;
  const buf = await sprite800(from);
  const info = await spriteInfo(buf);
  if (!info) return;
  mkdirSync(path.dirname(to), { recursive: true });
  const fit = await sharp(buf).extract(info.box).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp(fit).webp({ quality: 85, alphaQuality: 90 }).toFile(to);
}

/**
 * A round-chip texture: the app's own picker image (real laminate photo, plant,
 * chair...), centre-cropped and shrunk. Returns its public URL, or null when the
 * source has no such image.
 */
async function writeSwatch(from, rel, { size = 64, crop = 1 } = {}) {
  if (!existsSync(from)) return null;
  files += 1;
  const to = path.join(outRoot, rel);
  if (!dry) {
    const md = await sharp(from).metadata();
    const w = Math.round(md.width * crop);
    const h = Math.round(md.height * crop);
    mkdirSync(path.dirname(to), { recursive: true });
    await sharp(from)
      .extract({ left: Math.floor((md.width - w) / 2), top: Math.floor((md.height - h) / 2), width: w, height: h })
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 82 })
      .toFile(to);
    totalBytes += statSync(to).size;
  }
  return `/vam/${rel.replaceAll('\\', '/')}`;
}

/** Attach `swatch` URLs (and optional names) to a colour list. */
async function decorate(colors, swatchFor, nameFor) {
  for (const c of colors) {
    const swatch = swatchFor ? await swatchFor(c.k) : null;
    if (swatch) c.swatch = swatch;
    const name = nameFor?.(c.k);
    if (name) c.name = name;
  }
  return colors;
}

/** True when two 800x800 sprites are visually the same (duplicate colour variants in the source). */
async function sameSprite(a, b) {
  const [ra, rb] = await Promise.all([a, b].map((buf) => sharp(buf).ensureAlpha().raw().toBuffer()));
  let diff = 0;
  let n = 0;
  for (let i = 0; i < ra.length; i += 4) {
    if (ra[i + 3] > 128 || rb[i + 3] > 128) {
      diff += Math.abs(ra[i] - rb[i]) + Math.abs(ra[i + 1] - rb[i + 1]) + Math.abs(ra[i + 2] - rb[i + 2]) + Math.abs(ra[i + 3] - rb[i + 3]);
      n += 4;
    }
  }
  return n === 0 || diff / n < 2;
}

/**
 * Colour variants of an overlay series (K = colour). Colour 0 is a blank layer
 * (the default), kept as an option with no file; identical neighbours are dropped.
 */
async function variantColours(fromFor, outFor, hexOf) {
  const colors = [];
  let prev = null;
  for (let k = 0; k <= 9; k += 1) {
    const from = fromFor(k);
    if (!existsSync(from)) continue;
    const buf = await sprite800(from);
    const info = await spriteInfo(buf);
    if (!info) {
      if (k === 0) colors.push({ k, hex: hexOf(k, null) });
      continue;
    }
    if (prev && (await sameSprite(prev, buf))) continue;
    prev = buf;
    await writeSprite(from, outFor(k));
    colors.push({ k, hex: hexOf(k, info.hex) });
  }
  return colors;
}

// `x/` belongs to importVamApp.mjs (the app's real screens) — never wipe it here.
if (!dry) {
  for (const entry of existsSync(outRoot) ? readdirSync(outRoot) : []) {
    if (entry !== 'x') rmSync(path.join(outRoot, entry), { recursive: true, force: true });
  }
}

const ICON_DIR = path.join(BG_DIR, 'icon');
const PLINTUS_NAMES = { 1: 'Белый', 2: 'Серый', 3: 'Тёмно-коричневый' };
const FINISH_NAMES = { 0: 'Белый', 1: 'Песочный', 2: 'Тёмно-коричневый', 3: 'Чёрный', 4: 'Графит', 5: 'Красное дерево' };

/**
 * Real laminate photos (`cvetK.jpg`, K = the colour index used by `_K` in every
 * laminate layer — checked by chroma against the floor and wall layers). Some are
 * photographed with a white border, hence the centre crop.
 */
const swatchCache = new Map();
function cached(key, make) {
  if (!swatchCache.has(key)) swatchCache.set(key, make());
  return swatchCache.get(key);
}
const laminateSwatch = (k) => cached(`l${k}`, () => writeSwatch(path.join(BG_DIR, `cvet${k}.jpg`), `swatch/laminat/${k}.webp`, { crop: 0.7 }));
const tileSwatch = (k) => cached(`t${k}`, () => writeSwatch(path.join(BG_DIR, `plitka_cvet${k}.webp`), `swatch/plitka/${k}.webp`, { crop: 0.8 }));

const manifest = [];
for (const layout of LAYOUTS) {
  const out = path.join(outRoot, layout.id);
  const entry = {
    id: layout.id,
    label: layout.label,
    hint: layout.hint,
    wallPieces: layout.wallPieces,
    floorPieces: FLOOR_PIECES,
    families: [],
    floorFamilies: [],
  };

  for (const family of Object.keys(layout.families)) {
    const colors = [];
    for (let k = 0; k <= 30; k += 1) {
      const sources = layout.wallPieces.map((p) => wallSource(layout, family, p, k));
      if (sources.some((s) => !s)) continue;
      for (const [i, p] of layout.wallPieces.entries()) {
        await copyOne(sources[i], path.join(out, 'wall', family, String(k), `${p}.webp`));
      }
      const main = sources[layout.wallPieces.indexOf(layout.mainPiece)];
      colors.push({ k, hex: await averageHex(main) });
    }
    // Laminate walls share the app's laminate photo swatches with the laminate floor.
    if (family === 'laminat') await decorate(colors, (k) => laminateSwatch(k));
    if (colors.length) entry.families.push({ id: family, label: FAMILY_LABEL[family], colors });
    console.log(`${layout.id}/${family}: ${colors.length} colours`);
  }

  for (const floorFamily of FLOOR_FAMILIES) {
    const colors = [];
    for (let k = 0; k <= 30; k += 1) {
      const sources = FLOOR_PIECES.map((p) => floorSource(layout, floorFamily, p, k));
      if (sources.some((s) => !s)) continue;
      for (const [i, p] of FLOOR_PIECES.entries()) {
        await copyOne(sources[i], path.join(out, 'floor', floorFamily.id, String(k), `${p}.webp`));
      }
      colors.push({ k, hex: await averageHex(sources[0]) });
    }
    await decorate(colors, (k) => (floorFamily.id === 'laminat' ? laminateSwatch(k) : tileSwatch(k)));
    if (colors.length) entry.floorFamilies.push({ id: floorFamily.id, label: floorFamily.label, colors });
    console.log(`${layout.id}/floor-${floorFamily.id}: ${colors.length} colours`);
  }

  // Baseboard: `plintus<M>_K` (K = colour) hugs this layout's floor edge. The
  // `plintus<M>1` twin series draws a second, misaligned outline — not used.
  entry.plintusColors = [];
  for (let k = 1; k <= 9; k += 1) {
    const from = path.join(src, `plintus${layout.floorM}_${k}.webp`);
    if (!existsSync(from)) continue;
    const info = await writeSprite(from, path.join(out, 'plintus', `${k}.webp`));
    if (info) entry.plintusColors.push({ k, hex: info.hex });
  }
  // The app's picker icons plintus1..3 are flat white / grey / dark brown.
  await decorate(entry.plintusColors, null, (k) => PLINTUS_NAMES[k]);
  console.log(`${layout.id}/plintus: ${entry.plintusColors.length} colours`);

  // Glazing variants: background + frame colours + sill colours.
  entry.windowPieces = WINDOW_PIECES;
  entry.glazings = [];
  for (const g of layout.glazings) {
    const bgFiles = g.bg.map((n) => path.join(BG_DIR, `img${n}.webp`));
    if (bgFiles.some((f) => !existsSync(f))) {
      console.warn(`  ${layout.id}/${g.id}: background img${g.bg.join('+')} not found, skipped`);
      continue;
    }
    const gOut = path.join(out, 'glazing', g.id);
    files += 1;
    if (!dry) {
      mkdirSync(gOut, { recursive: true });
      const [first, ...overlays] = bgFiles;
      const bgBuf = await sharp(first)
        .composite(overlays.map((input) => ({ input, left: 0, top: 0 })))
        .png()
        .toBuffer();
      await sharp(bgBuf).webp({ quality: 82, effort: 5 }).toFile(path.join(gOut, 'bg.webp'));
      // The bare balcony, as the app's picker shows it.
      await sharp(bgBuf).resize(360, 360).webp({ quality: 80 }).toFile(path.join(gOut, 'bare.webp'));
      totalBytes += statSync(path.join(gOut, 'bg.webp')).size;
    }
    const frameColors = await variantColours(
      (k) => path.join(SILL_DIR, `rama${g.rama ?? 'none'}_${k}.webp`),
      (k) => path.join(gOut, 'frame', `${k}.webp`),
      (k) => FRAME_HEX[k] ?? '#888888',
    );
    const sillColors = g.pod
      ? await variantColours(
          (k) => path.join(SILL_DIR, `podokonnik${g.pod}_${k}.webp`),
          (k) => path.join(gOut, 'sill', `${k}.webp`),
          (k, mean) => (k === 0 ? '#f2f2ef' : mean ?? '#888888'),
        )
      : [];
    await decorate(frameColors, null, (k) => FINISH_NAMES[k]);
    await decorate(sillColors, null, (k) => FINISH_NAMES[k]);
    entry.glazings.push({ id: g.id, label: g.label, glazingType: g.glazingType, frameColors, sillColors });
    console.log(`${layout.id}/glazing-${g.id}: frames ${frameColors.length}, sills ${sillColors.length}`);
  }

  if (!dry) {
    const firstFamily = entry.families.find((f) => f.id === 'vagonka') ?? entry.families[0];
    const wallK = firstFamily.colors.find((c) => c.k === 1)?.k ?? firstFamily.colors[0].k;
    const laminate = entry.floorFamilies[0];
    const floorK = laminate.colors.find((c) => c.k === 1)?.k ?? laminate.colors[0].k;
    const parts = [
      ...FLOOR_PIECES.map((p) => path.join(out, 'floor', laminate.id, String(floorK), `${p}.webp`)),
      ...layout.wallPieces.map((p) => path.join(out, 'wall', firstFamily.id, String(wallK), `${p}.webp`)),
    ];
    const full = await sharp({ create: { width: 800, height: 800, channels: 4, background: '#8a8f96' } })
      .composite(parts.map((input) => ({ input, left: 0, top: 0 })))
      .png()
      .toBuffer();
    await sharp(full).resize(360, 360).webp({ quality: 82 }).toFile(path.join(out, 'thumb.webp'));

    // Glazing thumbnails: the same default finish over each variant's background.
    for (const g of entry.glazings) {
      const gOut = path.join(out, 'glazing', g.id);
      const gParts = [
        path.join(gOut, 'bg.webp'),
        ...FLOOR_PIECES.map((p) => path.join(out, 'floor', laminate.id, String(floorK), `${p}.webp`)),
        ...layout.wallPieces.filter((p) => !WINDOW_PIECES.includes(p)).map((p) => path.join(out, 'wall', firstFamily.id, String(wallK), `${p}.webp`)),
      ];
      const gFull = await sharp({ create: { width: 800, height: 800, channels: 4, background: '#8a8f96' } })
        .composite(gParts.map((input) => ({ input, left: 0, top: 0 })))
        .png()
        .toBuffer();
      await sharp(gFull).resize(240, 240).webp({ quality: 82 }).toFile(path.join(gOut, 'thumb.webp'));
    }
  }
  manifest.push(entry);
}

// ---- Layout-independent extras: the sprites stand in shared camera space (near /
// mid / far slots on the floor, lamps on the ceiling), so they work on every layout.
const extrasOut = path.join(outRoot, 'extras');

async function collectColours(fileFor, outFor) {
  const colors = [];
  for (let k = 1; k <= 30; k += 1) {
    const from = fileFor(k);
    if (!existsSync(from)) continue;
    const info = await writeSprite(from, outFor(k));
    if (info) colors.push({ k, hex: info.hex });
  }
  return colors;
}

// Ceiling lights: 6 models (icon/lampK.webp) in four arrangements — `lamp1` (a near
// light + one further along), `lamp11` (mirrored to the other side), `lamp2` / `lamp21`
// (a single far light, two variants). lamp2* are drawn on 1200 canvases (centre-cropped).
const LAMP_SLOTS = [
  { id: 'a', label: 'Расположение 1', series: 'lamp1' },
  { id: 'b', label: 'Расположение 2', series: 'lamp11' },
  { id: 'c', label: 'Расположение 3', series: 'lamp2' },
  { id: 'd', label: 'Расположение 4', series: 'lamp21' },
];
const lamps = { slots: [] };
for (const slot of LAMP_SLOTS) {
  const items = [];
  for (let k = 1; k <= 12; k += 1) {
    const from = path.join(src, `${slot.series}_${k}.webp`);
    if (!existsSync(from)) continue;
    const info = await writeSprite(from, path.join(extrasOut, 'lamp', slot.id, `${k}.webp`));
    if (!info) continue;
    // Picker icon: the app's own photo of the model (icon/lampK.webp), not the thin sprite.
    if (slot.id === 'a') await writeSwatch(path.join(ICON_DIR, `lamp${k}.webp`), `extras/lamp/thumb-${k}.webp`, { size: 96 });
    items.push({ k });
  }
  if (items.length) lamps.slots.push({ id: slot.id, label: slot.label, items });
}
console.log(`lamps: ${lamps.slots.map((s) => `${s.id}=${s.items.length}`).join(' ')}`);

const CHAIR_SLOTS = [
  { id: 'near', label: 'Ближе', series: 'chair1_1' },
  { id: 'mid', label: 'Дальше', series: 'chair2_1' },
];
const chair = { slots: [] };
for (const slot of CHAIR_SLOTS) {
  const colors = await collectColours(
    (k) => path.join(src, 'chair', `${slot.series}_${k}.webp`),
    (k) => path.join(extrasOut, 'chair', slot.id, `${k}.webp`),
  );
  // The app's picker shows the chair itself for each colour (icon/chair_cvetK.webp).
  await decorate(colors, (k) => writeSwatch(path.join(ICON_DIR, `chair_cvet${k}.webp`), `swatch/chair/${k}.webp`, { crop: 0.85 }));
  if (colors.length) chair.slots.push({ id: slot.id, label: slot.label, colors });
}
if (chair.slots[0]) {
  await writeThumb(path.join(src, 'chair', `${CHAIR_SLOTS[0].series}_${chair.slots[0].colors[0].k}.webp`), path.join(extrasOut, 'chair', 'thumb.webp'));
}
console.log(`chair: ${chair.slots.map((s) => `${s.id}=${s.colors.length}`).join(' ')}`);

// The app offers every cabinet in two materials ("Материал шкафа": Жалюзи / ЛДСП);
// the ldsp series (`shkaf_ldspD…`) mirror the louvre ones frame for frame.
const CABINET_TYPES = [
  { id: 'low', label: 'Низкий шкаф', series: { jaluzi: 'shkaf0', ldsp: 'shkaf_ldsp0' } },
  { id: 'd2', label: 'Шкаф на 2 дверцы', series: { jaluzi: 'shkaf1', ldsp: 'shkaf_ldsp1' } },
  { id: 'd3', label: 'Шкаф на 3 дверцы', series: { jaluzi: 'shkaf2', ldsp: 'shkaf_ldsp2' } },
  { id: 'd4', label: 'Шкаф на 4 дверцы', series: { jaluzi: 'shkaf3', ldsp: 'shkaf_ldsp3' } },
];
const CABINET_MATERIALS = [
  { id: 'jaluzi', label: 'Жалюзи' },
  { id: 'ldsp', label: 'ЛДСП' },
];
// far: shkafN_K, near-left: shkafN_1_K, near-right: shkafN_2_K
// Louvre cabinets also exist repeated-digit series (shkaf11 / shkaf111 / shkaf1111 for
// model 1): the same cabinet further down a long loggia, three more depths. No ldsp twins.
const repeated = (n) => (s, k) => (s.startsWith('shkaf_') ? '__none__' : `${s}${s.slice(5).repeat(n)}_${k}.webp`);
const CABINET_SLOTS = [
  { id: 'far', label: 'Вдали', file: (s, k) => `${s}_${k}.webp` },
  { id: 'left', label: 'Слева', file: (s, k) => `${s}_1_${k}.webp` },
  { id: 'right', label: 'Справа', file: (s, k) => `${s}_2_${k}.webp` },
  { id: 'deep1', label: 'В глубине', file: repeated(1) },
  { id: 'deep2', label: 'Ближе к концу', file: repeated(2) },
  { id: 'deep3', label: 'В самом конце', file: repeated(3) },
];
const cabinets = [];
for (const type of CABINET_TYPES) {
  const materials = [];
  for (const material of CABINET_MATERIALS) {
    const series = type.series[material.id];
    const slots = [];
    for (const slot of CABINET_SLOTS) {
      const colors = await collectColours(
        (k) => path.join(src, 'shkaf', slot.file(series, k)),
        (k) => path.join(extrasOut, 'cabinet', type.id, material.id, slot.id, `${k}.webp`),
      );
      if (colors.length) slots.push({ id: slot.id, label: slot.label, colors });
    }
    if (slots.length) materials.push({ id: material.id, label: material.label, slots });
    console.log(`cabinet ${type.id}/${material.id}: ${slots.map((s) => `${s.id}=${s.colors.length}`).join(' ')}`);
  }
  const first = materials[0]?.slots;
  const iconSlot = first?.find((s) => s.id === 'left') ?? first?.[0];
  if (iconSlot) {
    const k = iconSlot.colors[0].k;
    const slotDef = CABINET_SLOTS.find((s) => s.id === iconSlot.id);
    await writeThumb(path.join(src, 'shkaf', slotDef.file(type.series.jaluzi, k)), path.join(extrasOut, 'cabinet', type.id, 'thumb.webp'));
  }
  cabinets.push({ id: type.id, label: type.label, materials });
}

// Dryers: the app numbers them 1..8 (icon/numberK.webp = dryer K). `chair1_1_K` and
// `chair2_1_K` (dryer/ folder — the files kept the chair naming) are the same models
// in the mirrored position; series 2 has no frames 5 and 7 (blank).
const DRYER_SLOTS = [
  { id: 'p1', label: 'Расположение 1', series: 'chair1_1' },
  { id: 'p2', label: 'Расположение 2', series: 'chair2_1' },
];
const dryers = { slots: [] };
for (const slot of DRYER_SLOTS) {
  const items = [];
  for (let k = 1; k <= 12; k += 1) {
    const from = path.join(src, 'dryer', `${slot.series}_${k}.webp`);
    if (!existsSync(from)) continue;
    const info = await writeSprite(from, path.join(extrasOut, 'dryer', slot.id, `${k}.webp`));
    if (!info) continue;
    await writeThumb(from, path.join(extrasOut, 'dryer', slot.id, `thumb-${k}.webp`), 72);
    items.push({ k });
  }
  if (items.length) dryers.slots.push({ id: slot.id, label: slot.label, items });
}
console.log(`dryers: ${dryers.slots.map((s) => `${s.id}=${s.items.length}`).join(' ')}`);

// Flowers: a planter on the right window (series 1) or a pot on the left parapet
// (series 2), each in 3 plants (icon/flowers_cvetK.webp shows the plant).
const FLOWER_SLOTS = [
  { id: 'planter', label: 'Кашпо на окне', series: 'chair1_1' },
  { id: 'pot', label: 'Горшок на парапете', series: 'chair2_1' },
];
const flowers = { slots: [] };
for (const slot of FLOWER_SLOTS) {
  const colors = await collectColours(
    (k) => path.join(src, 'flowers', `${slot.series}_${k}.webp`),
    (k) => path.join(extrasOut, 'flowers', slot.id, `${k}.webp`),
  );
  await decorate(colors, (k) => writeSwatch(path.join(ICON_DIR, `flowers_cvet${k}.webp`), `swatch/flowers/${k}.webp`, { crop: 1 }));
  if (colors.length) flowers.slots.push({ id: slot.id, label: slot.label, colors });
}
if (flowers.slots[0]) {
  await writeThumb(path.join(src, 'flowers', `${FLOWER_SLOTS[0].series}_${flowers.slots[0].colors[0].k}.webp`), path.join(extrasOut, 'flowers', 'thumb.webp'));
}
console.log(`flowers: ${flowers.slots.map((s) => `${s.id}=${s.colors.length}`).join(' ')}`);

const extras = { cabinets, chair, lamps, dryers, flowers };

// ---- Showcase renders for the marketing pages (hero / promo / about). Composed
// from the layers just written above, so they always match the configurator.
const SHOWCASE = [
  { name: 'hero', layout: 'p', family: 'vagonka', wall: 0, floor: 4, plintus: 3, lamp: 1 },
  { name: 'promo', layout: 'l1', family: 'vagonka', wall: 6, floor: 2, plintus: 2, lamp: 4 },
  { name: 'story', layout: 'p', family: 'parket', wall: 0, floor: 0, lamp: 1, chair: ['mid', 5] },
];
if (!dry) {
  for (const s of SHOWCASE) {
    const layout = LAYOUTS.find((l) => l.id === s.layout);
    const base = path.join(outRoot, s.layout);
    const parts = [
      ...FLOOR_PIECES.map((p) => path.join(base, 'floor', s.floorFamily ?? 'laminat', String(s.floor), `${p}.webp`)),
      ...layout.wallPieces.map((p) => path.join(base, 'wall', s.family, String(s.wall), `${p}.webp`)),
    ];
    if (s.plintus) parts.push(path.join(base, 'plintus', `${s.plintus}.webp`));
    if (s.chair) parts.push(path.join(extrasOut, 'chair', s.chair[0], `${s.chair[1]}.webp`));
    if (s.lamp) parts.push(path.join(extrasOut, 'lamp', 'a', `${s.lamp}.webp`));
    const full = await sharp({ create: { width: 800, height: 800, channels: 4, background: '#8a8f96' } })
      .composite(parts.map((input) => ({ input, left: 0, top: 0 })))
      .png()
      .toBuffer();
    mkdirSync(path.join(outRoot, 'showcase'), { recursive: true });
    await sharp(full).flatten({ background: '#8a8f96' }).webp({ quality: 86 }).toFile(path.join(outRoot, 'showcase', `${s.name}.webp`));
  }
  console.log(`showcase: ${SHOWCASE.map((s) => s.name).join(', ')}`);
}

if (!dry) {
  const body = `/**
 * @file GENERATED by scripts/importVamAssets.mjs — do not edit by hand.
 * Which 2D balcony layouts, wall material families and colours exist under
 * \`public/vam/\` (see docs/vam-2d-mapping.md).
 */

export interface VamColorDef {
  /** Colour index in the source assets (also the folder name). */
  readonly k: number;
  /** Mean colour of the finish, for the swatch chip. */
  readonly hex: string;
  /** The app's own picker image for this colour (real laminate photo, plant, chair...). */
  readonly swatch?: string;
  /** Human name when the app gives one (e.g. baseboard colours). */
  readonly name?: string;
}

export interface VamFamilyDef {
  readonly id: string;
  readonly label: string;
  readonly colors: readonly VamColorDef[];
}

/**
 * A glazing variant: a bare-balcony background replaces the layout's window pieces
 * (\`/vam/<layout>/glazing/<id>/bg.webp\`, icon \`thumb.webp\`). Frame colours are
 * \`.../frame/<k>.webp\`, sill colours \`.../sill/<k>.webp\`; colour 0 is the default
 * white and has no file.
 */
export interface VamGlazingDef {
  readonly id: string;
  readonly label: string;
  /** Closest site glazing type (drives price + leads). */
  readonly glazingType: string;
  readonly frameColors: readonly VamColorDef[];
  readonly sillColors: readonly VamColorDef[];
}

export interface VamLayoutDef {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  /** Wall/ceiling/window/sill pieces, bottom-to-top stacking order. */
  readonly wallPieces: readonly number[];
  readonly floorPieces: readonly number[];
  readonly families: readonly VamFamilyDef[];
  /** Floor families (laminate, tile), each with its colours: \`/vam/<layout>/floor/<family>/<k>/<piece>.webp\`. */
  readonly floorFamilies: readonly VamFamilyDef[];
  /** Baseboard colours (\`/vam/<layout>/plintus/<k>.webp\`). */
  readonly plintusColors: readonly VamColorDef[];
  /** Pieces replaced by the glazing background when a variant is chosen. */
  readonly windowPieces: readonly number[];
  readonly glazings: readonly VamGlazingDef[];
}

/** A placement + its available colours (furniture sprites stand in fixed slots). */
export interface VamSlotDef {
  readonly id: string;
  readonly label: string;
  readonly colors: readonly VamColorDef[];
}

/** Cabinet material ("Материал шкафа"): louvre doors or flat chipboard. */
export interface VamCabinetMaterialDef {
  readonly id: string;
  readonly label: string;
  readonly slots: readonly VamSlotDef[];
}

export interface VamCabinetTypeDef {
  readonly id: string;
  readonly label: string;
  readonly materials: readonly VamCabinetMaterialDef[];
}

export interface VamExtrasDef {
  /** \`/vam/extras/cabinet/<type>/<material>/<slot>/<k>.webp\`, icon \`/vam/extras/cabinet/<type>/thumb.webp\`. */
  readonly cabinets: readonly VamCabinetTypeDef[];
  /** \`/vam/extras/chair/<slot>/<k>.webp\`, icon \`/vam/extras/chair/thumb.webp\`. */
  readonly chair: { readonly slots: readonly VamSlotDef[] };
  /** \`/vam/extras/lamp/<slot>/<k>.webp\` (arrangement + model), icon \`/vam/extras/lamp/thumb-<k>.webp\`. */
  readonly lamps: { readonly slots: readonly { readonly id: string; readonly label: string; readonly items: readonly { readonly k: number }[] }[] };
  /** \`/vam/extras/dryer/<slot>/<k>.webp\`, icon \`.../thumb-<k>.webp\` (dryer number = k). */
  readonly dryers: { readonly slots: readonly { readonly id: string; readonly label: string; readonly items: readonly { readonly k: number }[] }[] };
  /** \`/vam/extras/flowers/<slot>/<k>.webp\`, icon \`/vam/extras/flowers/thumb.webp\`. */
  readonly flowers: { readonly slots: readonly VamSlotDef[] };
}

export const VAM_LAYOUTS: readonly VamLayoutDef[] = ${JSON.stringify(manifest, null, 2)};

export const VAM_EXTRAS: VamExtrasDef = ${JSON.stringify(extras, null, 2)};
`;
  writeFileSync(manifestFile, body);
  console.log(`\nManifest written: ${manifestFile}`);
}

console.log(`${dry ? '[dry] ' : ''}${files} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
