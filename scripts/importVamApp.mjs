#!/usr/bin/env node
/**
 * @file Imports the Vam Balkon app's real "Выбор отделки" screens into
 * `public/vam/x/` and generates `src/pages/Configurator/vamApp.generated.ts`.
 *
 * The screen logic comes from the app's compiled Dart code (disassembled with
 * blutter, see docs/vam-2d-mapping.md) and lives in `scripts/vam-app-spec.json`:
 * for every screen (balcony type x glazing) the two views (bare background images)
 * and their tap targets, each with the popups (and so the image layers) it opens.
 * This script turns that into a manifest + the image files it references.
 *
 * Usage: node scripts/importVamApp.mjs [path-to-VamBalkon_extract] [--dry]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const extractRoot = args.find((a) => !a.startsWith('--')) ?? 'D:\\VamBalkon_extract';
const SRC = path.join(extractRoot, 'construktor');
const IMG = path.join(extractRoot, 'APK', 'assets', 'flutter_assets', 'assets', 'images');
const OUT = path.resolve('public/vam/x');
const MANIFEST = path.resolve('src/pages/Configurator/vamApp.generated.ts');
const spec = JSON.parse(readFileSync(path.resolve('scripts/vam-app-spec.json'), 'utf8'));

const FRAME_HEX = { 0: '#f2f2ef', 1: '#c8bf9a', 2: '#3b302b', 3: '#1d1d1d', 4: '#1d1d1d', 5: '#8c4b32' };
const FAMILY = { vert_laminat: 'laminat', vert_vagonka: 'vagonka', strn_parket: 'parket', mdf: 'mdf' };
const FAMILY_LABEL = { laminat: 'Ламинат', vagonka: 'Вагонка', parket: 'Стеновой паркет', mdf: 'МДФ-панели' };
const FAMILY_ORDER = ['laminat', 'vagonka', 'parket', 'mdf'];
const CABINET_HOTSPOTS = new Set(['1_4', '1_5', '1_6', '1_8', '1_9', '1_10', '6_5', '6_6']);
const LAMP_LABELS = { 1: 'Подвесной', 2: 'Плоский', 3: 'Накладной цилиндр', 4: 'Лофт-клетка', 5: 'Трековый чёрный', 6: 'Трековый белый' };
const CABINET_LABELS = ['Низкий шкаф', 'Шкаф на 2 дверцы', 'Шкаф на 3 дверцы', 'Шкаф на 4 дверцы'];

let files = 0;
let bytes = 0;

/** An 800x800 PNG buffer of a source layer (1200 canvases are centre-cropped). */
async function layer800(file) {
  const md = await sharp(file).metadata();
  if (md.width === 1200 && md.height === 1200) return sharp(file).extract({ left: 200, top: 200, width: 800, height: 800 }).png().toBuffer();
  return sharp(file).png().toBuffer();
}

// ---- which camera view a layer belongs to --------------------------------------
// A pair such as wall 2 / wall 7 is one wall seen from both views: its layers are
// drawn on different views, so every layer is matched to the view whose bare
// background it lines up with (outline of the layer vs edges of the background).
const W = 800;
const bgCache = new Map();
async function bgGradient(bgs) {
  const key = bgs.join('+');
  if (bgCache.has(key)) return bgCache.get(key);
  const c = await sharp({ create: { width: W, height: W, channels: 4, background: { r: 120, g: 125, b: 130, alpha: 1 } } })
    .composite(await Promise.all(bgs.map(async (n) => ({ input: await sharp(path.join(IMG, `${n}.webp`)).png().toBuffer() }))))
    .raw()
    .toBuffer();
  const g = new Float32Array(W * W);
  const lum = (i) => (c[i * 4] + c[i * 4 + 1] + c[i * 4 + 2]) / 3;
  for (let y = 1; y < W - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
    const i = y * W + x;
    g[i] = Math.abs(lum(i + 1) - lum(i - 1)) + Math.abs(lum(i + W) - lum(i - W));
  }
  let sum = 0;
  for (let i = 0; i < g.length; i += 1) sum += g[i];
  const out = { g, mean: sum / g.length };
  bgCache.set(key, out);
  return out;
}

async function alphaOf(file) {
  const { data } = await sharp(await layer800(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

/** Layer outline sitting on strong background edges: (mean bg gradient on outline) / (mean gradient). */
async function edgeScore(bgs, file) {
  const { g, mean } = await bgGradient(bgs);
  const d = await alphaOf(file);
  let n = 0;
  let s = 0;
  for (let y = 2; y < W - 2; y += 1) for (let x = 2; x < W - 2; x += 1) {
    const i = y * W + x;
    const e = Math.abs(d[(i + 1) * 4 + 3] - d[(i - 1) * 4 + 3]) + Math.abs(d[(i + W) * 4 + 3] - d[(i - W) * 4 + 3]);
    if (e > 120) {
      n += 1;
      s += Math.max(g[i], g[i + 1], g[i - 1], g[i + W], g[i - W]);
    }
  }
  return n > 60 ? s / n / mean : -1;
}

/** Share of a thin layer's pixels within 7px of the outline of `floorFile` (a baseboard hugs the floor edge). */
async function floorHug(plintusFile, floorFile) {
  const p = await alphaOf(plintusFile);
  const f = await alphaOf(floorFile);
  let n = 0;
  let ok = 0;
  for (let y = 8; y < W - 8; y += 3) for (let x = 8; x < W - 8; x += 3) {
    const i = y * W + x;
    if (p[i * 4 + 3] < 200) continue;
    n += 1;
    let near = false;
    for (let dy = -7; dy <= 7 && !near; dy += 7) for (let dx = -7; dx <= 7; dx += 7) {
      if (Math.abs(f[(i + dy * W + dx) * 4 + 3] - f[i * 4 + 3]) > 120) {
        near = true;
        break;
      }
    }
    if (near) ok += 1;
  }
  return n > 20 ? ok / n : -1;
}

const kFor = (ks) => [4, 3, 1].find((k) => ks.includes(k)) ?? ks[0];

/**
 * The view (0 / 1) a layer is drawn on, and how much better it fits view 0 than view 1
 * (`d`). `ctx` = { views, own, floors } of the screen: walls by piece number, frames / sills by outline
 * fit, baseboard by the floor layer it hugs; furniture and lights stay on their own
 * view; an unclear fit falls back to the tap target's own view.
 */
async function assignView(relPath, ks, ctx) {
  // The app numbers the surfaces of a room 1..10: pieces 1-5 are drawn on the first
  // view, 6-10 on the second (wall 2/7, 3/10, 4/9, floor 5/8 are one surface each).
  const piece = relPath.match(/(?:^|\/)stena(\d+)\//);
  if (piece) return { v: +piece[1] <= 5 ? 0 : 1, d: 0, fixed: true };
  // The П-44Т screens have no light in the app; ours draws one lamp per view (twin series).
  if (/lamp/.test(relPath) && /^1[01]$/.test(ctx.sid)) return { v: /lamp(11|21)_$/.test(relPath) ? 1 : 0, d: 0, fixed: true };
  if (dry || /lamp|shkaf|chair|dryer|flowers/.test(relPath)) return { v: ctx.own, d: 0, fixed: true };
  const k = kFor(ks);
  const file = path.join(SRC, `${relPath}${k}.webp`);
  if (/plintus/.test(relPath)) {
    const scores = [];
    for (const fl of ctx.floors) scores.push([fl.v, await floorHug(file, path.join(SRC, `${fl.p}${fl.k}.webp`))]);
    scores.sort((x, y) => y[1] - x[1]);
    return { v: scores[0] && scores[0][1] > 0.3 ? scores[0][0] : ctx.own, d: 0, fixed: true };
  }
  const a = await edgeScore(ctx.views[0].bg, file);
  const b = await edgeScore(ctx.views[1].bg, file);
  const d = Math.max(a, 0) - Math.max(b, 0);
  if ((a < 0 && b < 0) || Math.abs(a - b) < 0.2 * Math.max(a, b)) return { v: ctx.own, d };
  return { v: a > b ? 0 : 1, d };
}

/** Context of the tap target being built (set in the screen loop). */
let CTX = { sid: '', views: [], own: 0, floors: [] };

const written = new Set();
async function copyLayer(from, rel) {
  const to = path.join(OUT, rel);
  if (written.has(to)) return;
  written.add(to);
  files += 1;
  if (dry) return;
  mkdirSync(path.dirname(to), { recursive: true });
  await sharp(await layer800(from)).webp({ quality: 82, alphaQuality: 90, effort: 4 }).toFile(to);
}

/** Alpha-weighted mean colour + centroid (percent of 800) of a layer. */
async function stats(file) {
  const { data, info } = await sharp(await layer800(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0, sx = 0, sy = 0, m = 0;
  for (let i = 0; i < info.width * info.height; i += 1) {
    const a = data[i * 4 + 3];
    if (a > 128) {
      sx += i % info.width;
      sy += Math.floor(i / info.width);
      m += 1;
    }
    if (a > 200) {
      r += data[i * 4];
      g += data[i * 4 + 1];
      b += data[i * 4 + 2];
      n += 1;
    }
  }
  const h = (v) => Math.round(v / (n || 1)).toString(16).padStart(2, '0');
  return { hex: n ? `#${h(r)}${h(g)}${h(b)}` : '#888888', sx, sy, m, w: info.width, h: info.height };
}

/** Sum of normalised coordinates and count of the pixels of `file` that differ from `other` (all opaque pixels when none differ). */
async function centre(file, other) {
  const d = await alphaOf(file);
  const o = other && existsSync(other) ? await alphaOf(other) : null;
  const pick = (strict) => {
    let sx = 0, sy = 0, m = 0;
    for (let i = 0; i < W * W; i += 1) {
      if (d[i * 4 + 3] < 128) continue;
      if (strict && o) {
        const diff = Math.abs(d[i * 4] - o[i * 4]) + Math.abs(d[i * 4 + 1] - o[i * 4 + 1]) + Math.abs(d[i * 4 + 2] - o[i * 4 + 2]);
        if (diff < 30) continue;
      }
      sx += (i % W) / W;
      sy += Math.floor(i / W) / W;
      m += 1;
    }
    return { sx, sy, m };
  };
  const strict = pick(true);
  return strict.m > 400 ? strict : pick(false);
}

/** Colour indices K for which every prefix has `<prefix>K.webp`. */
function colourIndices(rels) {
  const sets = rels.map((rel) => {
    const dir = path.join(SRC, path.dirname(rel));
    const base = path.basename(rel);
    if (!existsSync(dir)) return new Set();
    const ks = new Set();
    for (const f of readdirSync(dir)) {
      if (f.startsWith(base) && f.endsWith('.webp')) {
        const k = f.slice(base.length, -'.webp'.length);
        if (/^\d+$/.test(k)) ks.add(+k);
      }
    }
    return ks;
  });
  const [first, ...rest] = sets;
  return [...(first ?? [])].filter((k) => rest.every((s) => s.has(k))).sort((a, b) => a - b);
}

/** Draw order of a layer: floor, walls by piece number, frames, sills, baseboard, furniture, light. */
function zOf(rel) {
  if (/lamp/.test(rel)) return 90;
  if (/shkaf|chair|dryer|flowers/.test(rel)) return 80;
  if (/plintus/.test(rel)) return 70;
  if (/podokonnik/.test(rel)) return 60;
  if (/rama/.test(rel)) return 50;
  const m = rel.match(/stena(\d+)/);
  const n = m ? +m[1] : 5;
  return n === 5 || n === 8 ? 0 : n;
}

const rel = (p) => p.replace(/^construktor\//, '');

async function makeOption(id, label, prefixes, extra = {}) {
  const rels = prefixes.map(rel);
  const ks = colourIndices(rels);
  if (!ks.length) return null;
  const found = [];
  for (const r of rels) found.push(await assignView(r, ks, CTX));
  // The two pieces of a pair (wall 2 / wall 7 ...) are one surface seen from both views.
  if (found.length === 2 && !found[0].fixed && !found[1].fixed && found[0].v === found[1].v) {
    const first = found[0].d >= found[1].d ? 0 : 1;
    found[first].v = 0;
    found[1 - first].v = 1;
  }
  const views = found.map((f) => f.v);
  const colors = [];
  let cx = 50, cy = 50;
  for (const [i, k] of ks.entries()) {
    for (const r of rels) await copyLayer(path.join(SRC, `${r}${k}.webp`), `${r}${k}.webp`);
    const main = path.join(SRC, `${rels[0]}${k}.webp`);
    if (dry) {
      colors.push({ k, hex: '#888888' });
      continue;
    }
    const st = await stats(main);
    if (i === Math.min(1, ks.length - 1)) {
      // Tap target at the centre of the surface itself: pixels that change with the colour
      // (a wall piece may carry its window, which does not).
      const own = rels.filter((_, j) => views[j] === CTX.own);
      let tx = 0, ty = 0, tm = 0;
      for (const r of own.length ? own : rels) {
        const other = ks[ks.length - 1] === k ? ks[0] : ks[ks.length - 1];
        const c = await centre(path.join(SRC, `${r}${k}.webp`), other !== k ? path.join(SRC, `${r}${other}.webp`) : null);
        tx += c.sx;
        ty += c.sy;
        tm += c.m;
      }
      cx = tm ? (tx / tm) * 100 : 50;
      cy = tm ? (ty / tm) * 100 : 50;
    }
    let hex = st.hex;
    if (/rama|podokonnik/.test(rels[0]) && FRAME_HEX[k]) hex = FRAME_HEX[k];
    const c = { k, hex };
    if (extra.swatch) c.swatch = extra.swatch(k);
    colors.push(c);
  }
  return { id, label, layers: rels.map((r, i) => ({ p: r, z: zOf(r), v: views[i] })), colors, cx, cy };
}

const swatchLaminat = (k) => `/vam/swatch/laminat/${k}.webp`;
const swatchPlitka = (k) => `/vam/swatch/plitka/${k}.webp`;

/** The options of a hotspot, grouped into slots (one picker each). */
async function buildSlots(h) {
  const id = h.id;
  const slots = [];
  const push = (slot) => {
    if (slot.options.length) slots.push(slot);
  };
  const popups = h.popups;

  if (id === '8_8_decor') {
    const byName = { chair: 'Барный стул', dryer: 'Сушилка', flowers: 'Цветы' };
    for (const p of popups) {
      const key = /dryer/.test(p.cls) ? 'dryer' : /flowers/.test(p.cls) ? 'flowers' : 'chair';
      const opt = await makeOption(key, byName[key], p.prefixes, {});
      if (opt) slots.push({ id: key, label: byName[key], options: [opt] });
    }
    return { kind: 'decor', slots };
  }
  if (CABINET_HOTSPOTS.has(id)) {
    const options = [];
    for (const p of popups) {
      const m = p.cls.match(/shkaf(_ldsp)?(\d)/);
      if (!m) continue;
      const [type, ldsp] = [+m[2], Boolean(m[1])];
      const label = `${CABINET_LABELS[type]}, ${ldsp ? 'ЛДСП' : 'жалюзи'}`;
      const opt = await makeOption(`${type}${ldsp ? 'l' : 'j'}`, label, p.prefixes.filter((x) => /shkaf/.test(x)), {});
      if (opt) options.push(opt);
    }
    options.sort((a, b) => a.id.localeCompare(b.id));
    push({ id: 'main', label: 'Шкаф', options });
    return { kind: 'cabinet', slots };
  }
  const prefixOf = (re) => popups.flatMap((p) => p.prefixes).filter((x) => re.test(x));
  if (/plintus/.test(popups.map((p) => p.prefixes.join()).join())) {
    const opt = await makeOption('plintus', 'Плинтус', prefixOf(/plintus/), {});
    if (opt) opt.colors = opt.colors.filter((c) => c.k > 0);
    if (opt) push({ id: 'main', label: 'Плинтус', options: [opt] });
    return { kind: 'plintus', slots };
  }
  if (/lamp/.test(popups.map((p) => p.prefixes.join()).join()) || /^8_[78]$/.test(id)) {
    const opt = await makeOption('lamp', 'Светильник', prefixOf(/lamp/), {});
    if (opt) {
      opt.colors = opt.colors.filter((c) => c.k > 0).map((c) => ({ ...c, name: LAMP_LABELS[c.k], swatch: `/vam/extras/lamp/thumb-${c.k}.webp` }));
      push({ id: 'main', label: 'Светильник', options: [opt] });
    }
    return { kind: 'light', slots };
  }
  const rama = prefixOf(/(^|\/)rama\d+_$/);
  const sill = prefixOf(/(^|\/)podokonnik\d+_$/);
  if (rama.length || sill.length) {
    const isFrame = rama.length > 0;
    const opt = await makeOption(isFrame ? 'frame' : 'sill', isFrame ? 'Рамы' : 'Подоконник', isFrame ? rama : sill, {});
    if (opt) {
      opt.colors = opt.colors.map((c) => ({ ...c, name: { 0: 'Белый', 1: 'Песочный', 2: 'Тёмно-коричневый', 3: 'Чёрный', 4: 'Графит', 5: 'Красное дерево' }[c.k] }));
      push({ id: 'main', label: isFrame ? 'Цвет рам' : 'Цвет подоконника', options: [opt] });
    }
    return { kind: isFrame ? 'frame' : 'sill', slots };
  }

  // Walls / floor / ceiling: one option per material family.
  const isFloor = /^5/.test(id);
  const options = [];
  const seen = new Set();
  const ordered = [...popups].sort((a, b) => FAMILY_ORDER.indexOf(FAMILY[a.file.split('/')[0]]) - FAMILY_ORDER.indexOf(FAMILY[b.file.split('/')[0]]));
  for (const p of ordered) {
    const fam = FAMILY[p.file.split('/')[0]];
    if (!fam) continue;
    const pre = p.prefixes.filter((x) => /construktor\/.*(stena|potolok)/.test(x));
    if (!pre.length) continue;
    const isTile = pre.some((x) => /plitka/.test(x));
    const isCeiling = pre.some((x) => /potolok/.test(x));
    const oid = isFloor ? (isTile ? 'plitka' : 'laminat') : isCeiling ? `potolok${pre[0].match(/potolok(\d)/)[1]}` : fam;
    if (seen.has(oid)) continue;
    seen.add(oid);
    const label = isFloor ? (isTile ? 'Плитка' : 'Ламинат') : isCeiling ? 'Натяжной потолок' : FAMILY_LABEL[fam];
    const swatch = isCeiling ? undefined : isTile ? swatchPlitka : fam === 'laminat' ? swatchLaminat : undefined;
    const opt = await makeOption(oid, label, pre, swatch ? { swatch } : {});
    if (opt) options.push(opt);
  }
  // Floor: laminate first, then tile.
  if (isFloor) options.sort((a, b) => (a.id === 'laminat' ? -1 : 1) - (b.id === 'laminat' ? -1 : 1));
  push({ id: 'main', label: isFloor ? 'Пол' : 'Стены', options });
  return { kind: isFloor ? 'floor' : /^4/.test(id) ? 'ceiling' : 'wall', slots };
}

// ---- screens ----
// The app's П-44Т screens (10, 11) have no light tap target: reuse the pendant lights of
// the long loggia (`light9`) on the first view so the light can be chosen there too.
const lightPopups = spec['8']?.[1]?.hotspots.find((h) => h.id === '8_7')?.popups;
if (lightPopups) {
  for (const sid of ['10', '11']) {
    if (spec[sid] && !spec[sid][0].hotspots.some((h) => h.id === '8_7')) spec[sid][0].hotspots.push({ id: '8_7', popups: lightPopups });
  }
}
if (!dry) rmSync(OUT, { recursive: true, force: true });
const screens = {};
const bgSeen = new Set();
for (const [sid, views] of Object.entries(spec)) {
  const outViews = [];
  // The floor layers of this screen (a baseboard is matched to the floor edge it hugs).
  const floorHotspot = views.flatMap((v) => v.hotspots).find((h) => /^5/.test(h.id));
  const floorPrefixes = (floorHotspot?.popups ?? []).filter((p) => p.file.startsWith('vert_laminat')).flatMap((p) => p.prefixes).map(rel).filter((r) => /stena[58]\/cvet/.test(r));
  const floors = [];
  for (const r of floorPrefixes) {
    const ks = colourIndices([r]);
    if (ks.length) floors.push({ p: r, k: kFor(ks), v: /stena5\//.test(r) ? 0 : 1 });
  }
  for (const [vi, v] of views.entries()) {
    CTX = { sid, views, own: vi, floors };
    for (const b of v.bg) {
      if (bgSeen.has(b)) continue;
      bgSeen.add(b);
      const from = path.join(IMG, `${b}.webp`);
      files += 1;
      if (!dry) {
        mkdirSync(path.join(OUT, 'bg'), { recursive: true });
        await sharp(from).webp({ quality: 84, effort: 4 }).toFile(path.join(OUT, 'bg', `${b}.webp`));
      }
    }
    const hotspots = [];
    for (const h of v.hotspots) {
      const built = await buildSlots(h);
      if (!built.slots.length) continue;
      const first = built.slots[0].options[0];
      hotspots.push({ id: h.id, kind: built.kind, x: Math.round(first.cx), y: Math.round(first.cy), slots: built.slots.map((s) => ({ ...s, options: s.options.map(({ cx, cy, ...o }) => o) })) });
    }
    // Keep tap targets apart.
    for (const [i, h] of hotspots.entries()) {
      for (let tries = 0; tries < 12; tries += 1) {
        const clash = hotspots.slice(0, i).find((o) => Math.hypot(o.x - h.x, o.y - h.y) < 9);
        if (!clash) break;
        h.y = Math.min(94, h.y + 8);
        if (tries % 3 === 2) h.x = Math.min(94, h.x + 8);
      }
    }
    outViews.push({ bg: v.bg, hotspots });
  }
  screens[sid] = outViews;
}

// Picker photos of the app's first screen.
const UI = ['start', 'P_obraz', 'lodjia', 'lodjia_6', 'P44t', 'bardur', 'panorama', 'P44tL', 'P44tR'];
for (const name of UI) {
  files += 1;
  if (!dry) {
    mkdirSync(path.join(OUT, 'ui'), { recursive: true });
    await sharp(path.join(IMG, `${name}.webp`)).webp({ quality: 88 }).toFile(path.join(OUT, 'ui', `${name}.webp`));
  }
}

if (!dry) {
  const body = `/**
 * @file GENERATED by scripts/importVamApp.mjs — do not edit by hand.
 * The Vam Balkon app's "Выбор отделки" screens: per screen the two views (bare
 * background images under \`/vam/x/bg/\`) and their tap targets. Every option lists
 * image layers (\`/vam/x/<p><k>.webp\`) — one is drawn per chosen colour \`k\`.
 */

export type HotspotKind = 'wall' | 'ceiling' | 'floor' | 'frame' | 'sill' | 'plintus' | 'light' | 'cabinet' | 'decor';

export interface AppColor {
  readonly k: number;
  readonly hex: string;
  readonly swatch?: string;
  readonly name?: string;
}

export interface AppOption {
  readonly id: string;
  readonly label: string;
  /** Layer path prefixes (colour index is appended), draw order and the view (0 / 1) each layer is drawn on. */
  readonly layers: readonly { readonly p: string; readonly z: number; readonly v: 0 | 1 }[];
  readonly colors: readonly AppColor[];
}

export interface AppSlot {
  readonly id: string;
  readonly label: string;
  readonly options: readonly AppOption[];
}

export interface AppHotspot {
  readonly id: string;
  readonly kind: HotspotKind;
  /** Percent of the view. */
  readonly x: number;
  readonly y: number;
  readonly slots: readonly AppSlot[];
}

export interface AppView {
  readonly bg: readonly string[];
  readonly hotspots: readonly AppHotspot[];
}

/** Screen 2..11 -> its two views. */
export const VAM_APP_SCREENS: Readonly<Record<string, readonly [AppView, AppView]>> = ${JSON.stringify(screens, null, 1)};
`;
  writeFileSync(MANIFEST, body);
  console.log(`Manifest written: ${MANIFEST}`);
}
console.log(`${files} files`);
