/**
 * @file Client-side "Скачать спецификацию (PDF)" export (brief §17): a PDF with the
 * chosen balcony shape/glazing, the materials picked per surface, and the extra
 * services ticked. Built with `pdfmake` (its bundled Roboto font covers Cyrillic out
 * of the box) — no `puppeteer` or `html2canvas`, both deliberately dropped elsewhere
 * in this repo.
 *
 * No price/quote fetch or price table here by design: this site does not calculate
 * or display cost (docs/vam-2d-mapping.md — owner decision, reconfirmed 2026-10-10)
 * — this export is a materials/options spec sheet only.
 */
import type { Extras } from './useConfigurator';
import { vamSummary } from './vamCatalog';
import type { VamSelection } from './vamCatalog';

interface PdfMakeApi {
  addVirtualFileSystem: (vfs: unknown) => void;
  createPdf: (docDefinition: unknown) => { download: (fileName?: string) => void };
}

const EXTRA_LABELS: Readonly<Record<keyof Extras, string>> = {
  insulation: 'Утепление',
  ceilingFinish: 'Отделка потолка',
  dismantling: 'Демонтаж',
};

const BALCONY_HEADER_LABELS = new Set(['Форма балкона', 'Тип балкона', 'Остекление']);

export interface DownloadSpecPdfInput {
  readonly selection: VamSelection;
  readonly extras: Extras;
}

/** Thrown by `downloadSpecPdf` with a message safe to show the user directly. */
export class SpecPdfError extends Error {}

/** Builds the pdfmake document definition for one configuration's spec sheet. */
function buildDocDefinition(selection: VamSelection, extras: Extras): unknown {
  const rows = vamSummary(selection);
  const headRows = rows.filter((r) => BALCONY_HEADER_LABELS.has(r.label));
  const materialRows = rows.filter((r) => !BALCONY_HEADER_LABELS.has(r.label));
  const extrasChosen = (Object.keys(EXTRA_LABELS) as (keyof Extras)[]).filter((k) => extras[k]).map((k) => EXTRA_LABELS[k]);
  const stamp = new Date().toLocaleDateString('ru-RU');

  const headerTable = {
    table: {
      widths: ['*', '*'],
      body: headRows.map((r) => [{ text: r.label, bold: true }, r.value]),
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 14],
  };

  const materialsTable = materialRows.length
    ? {
        table: {
          widths: ['*', '*'],
          headerRows: 1,
          body: [
            [{ text: 'Поверхность', bold: true }, { text: 'Материал, цвет', bold: true }],
            ...materialRows.map((r) => [r.label, r.value]),
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 14],
      }
    : { text: 'Отделка не выбрана', italics: true, margin: [0, 0, 0, 14] };

  const extrasTable = extrasChosen.length
    ? {
        table: { widths: ['*'], body: extrasChosen.map((label) => [label]) },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 14],
      }
    : { text: 'Дополнительные услуги не выбраны', italics: true, margin: [0, 0, 0, 14] };

  return {
    info: { title: 'Спецификация балкона' },
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    content: [
      { text: 'Спецификация отделки балкона', style: 'title' },
      { text: `Сформировано: ${stamp}`, style: 'muted', margin: [0, 0, 0, 16] },
      headerTable,
      { text: 'Отделка по поверхностям', style: 'section' },
      materialsTable,
      { text: 'Дополнительные услуги', style: 'section' },
      extrasTable,
      {
        text: 'Состав работ и материалов согласуется со специалистом после замера.',
        style: 'disclaimer',
      },
    ],
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
      muted: { fontSize: 9, color: '#666666' },
      section: { fontSize: 13, bold: true, margin: [0, 10, 0, 6] },
      disclaimer: { fontSize: 9, italics: true, color: '#666666' },
    },
  };
}

/**
 * Builds a Cyrillic-safe PDF spec sheet (shape/glazing/materials/extras, no price)
 * with pdfmake and triggers a browser download.
 */
export async function downloadSpecPdf(input: DownloadSpecPdfInput): Promise<void> {
  const { selection, extras } = input;

  // pdfmake ships no TypeScript declarations for its browser build files, so these
  // two dynamic imports resolve to `any` (suppressed below) and are cast explicitly.
  // @ts-expect-error pdfmake ships no TypeScript declarations for its browser build
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  // @ts-expect-error pdfmake ships no TypeScript declarations for its browser build
  const vfsModule = await import('pdfmake/build/vfs_fonts');
  const pdfMake = (pdfMakeModule as { default: PdfMakeApi }).default;
  const vfs = (vfsModule as { default: unknown }).default;
  pdfMake.addVirtualFileSystem(vfs);

  const docDefinition = buildDocDefinition(selection, extras);
  const stamp = new Date().toISOString().slice(0, 10);
  pdfMake.createPdf(docDefinition).download(`specifikaciya-${selection.shape}-${stamp}.pdf`);
}
