/**
 * @file Which layer a face of the room belongs to (see `LAYERS` in `types.ts`). Most
 * layers follow from the face's kind and paint key; handles and other special parts
 * say so explicitly through `Face.layer`.
 */
import type { Face, LayerId } from './types';

export function layerOf(f: Face): LayerId {
  if (f.layer) return f.layer;
  switch (f.kind) {
    case 'glass':
      return 'glass';
    case 'frame':
      return 'frames';
    case 'unit':
      return f.unit?.img === 'house' ? 'openings' : 'frames';
    case 'curtain':
    case 'white':
    case 'dark':
      return 'openings';
    case 'lamp':
      return 'lamps';
    default:
      if (f.paint === 'P:sill') return 'sill';
      if (f.paint === 'P:plintus') return 'plinth';
      return 'structure';
  }
}
