/**
 * @file The balcony types and shapes offered in the configurator.
 *
 * The app has five balcony types, each with two glazings (parapet / to the floor;
 * for the П-44Т series left- / right-handed). Every type + glazing is one of the
 * app's screens (2..11 in `vamApp.generated.ts`) with two camera views. The owner's
 * six shapes (their floor plans live in `planGeometry.ts`) map onto
 * those types; several shapes share one.
 */

export interface VamGlazingDef {
  readonly id: string;
  readonly label: string;
  /** Picker photo under `/vam/x/ui/`. */
  readonly photo: string;
  /** The app screen (2..11) drawn for this glazing. */
  readonly screen: string;
  /** Right-handed П-44Т is the left-handed screen drawn flipped. */
  readonly mirror?: boolean;
}

export interface VamTypeDef {
  readonly id: string;
  readonly label: string;
  readonly photo: string;
  readonly glazings: readonly VamGlazingDef[];
}

const PARAPET = 'Остекление с парапетом';
const FLOOR = 'Остекление до пола';

export const VAM_TYPES: readonly VamTypeDef[] = [
  {
    id: 'g',
    label: 'Г-образный балкон до 5м',
    photo: 'start',
    glazings: [
      { id: 'parapet', label: PARAPET, photo: 'bardur', screen: '2' },
      { id: 'floor', label: FLOOR, photo: 'panorama', screen: '3' },
    ],
  },
  {
    id: 'p',
    label: 'П-образный балкон до 5м',
    photo: 'P_obraz',
    glazings: [
      { id: 'parapet', label: PARAPET, photo: 'bardur', screen: '4' },
      { id: 'floor', label: FLOOR, photo: 'panorama', screen: '5' },
    ],
  },
  {
    id: 'l5',
    label: 'Лоджия до 5м',
    photo: 'lodjia',
    glazings: [
      { id: 'parapet', label: PARAPET, photo: 'bardur', screen: '6' },
      { id: 'floor', label: FLOOR, photo: 'panorama', screen: '7' },
    ],
  },
  {
    id: 'l8',
    label: 'Лоджия до 8м',
    photo: 'lodjia_6',
    glazings: [
      { id: 'parapet', label: PARAPET, photo: 'bardur', screen: '8' },
      { id: 'floor', label: FLOOR, photo: 'panorama', screen: '9' },
    ],
  },
  {
    id: 'u',
    label: 'Серия П-44Т(Утюг)',
    photo: 'P44t',
    glazings: [
      { id: 'left', label: 'Левосторонний', photo: 'P44tL', screen: '10' },
      { id: 'right', label: 'Правосторонний', photo: 'P44tR', screen: '10', mirror: true },
    ],
  },
];

export interface VamShapeDef {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  /** The app balcony type (`VAM_TYPES`) that stands in for this shape. */
  readonly type: string;
}

export const VAM_SHAPES: readonly VamShapeDef[] = [
  { id: 'sapozhok', label: 'Сапожок', hint: 'ступенчатый выступ', type: 'p' },
  { id: 'lodochka', label: 'Лодочка', hint: 'скос и уступ у стены', type: 'g' },
  { id: 'utyuzhok', label: 'Утюжок', hint: 'скошенный угол', type: 'u' },
  { id: 'loggia', label: 'Обычная лоджия', hint: 'прямоугольная', type: 'l5' },
  { id: 'long-loggia', label: 'Удлинённая лоджия', hint: 'длина до 6 м', type: 'l8' },
  { id: 'khrushchevka', label: 'Хрущёвка', hint: 'узкий, окна с трёх сторон', type: 'p' },
];

export function findVamShape(id: string | undefined): VamShapeDef | undefined {
  return VAM_SHAPES.find((s) => s.id === id);
}

export function findVamType(id: string | undefined): VamTypeDef | undefined {
  return VAM_TYPES.find((t) => t.id === id);
}
