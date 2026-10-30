/**
 * Keeps pins from sitting on top of each other (DB-19b). The position of a house is rounded to about 1 km, so a pin may be
 * moved by a little without lying more than the rounding already does: never farther than `maxKm` (and never more than
 * `capPx`). Pins are looked at from the top of the frame down; each one takes the nearest free place among a few candidates;
 * if none is free it stays where it is (the selected pin is always drawn on top, and every pin is also in the list).
 */
export interface PinBox {
  /** Position in px inside the frame. */
  x: number;
  y: number;
  /** Size of the pill in px. */
  w: number;
  h: number;
}

export interface Shift {
  dx: number;
  dy: number;
}

/** Rough size of a pill from its text: 8 px a character and the padding, at least a touch target. */
export const pillSize = (label: string): { w: number; h: number } => ({ w: Math.max(44, label.length * 8 + 36), h: 44 });

const overlaps = (a: PinBox, b: PinBox): boolean => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 2;

export function placePins(boxes: readonly PinBox[], { spanKm, widthPx, maxKm = 1.5, capPx = 44 }: { spanKm: number; widthPx: number; maxKm?: number; capPx?: number }): Shift[] {
  const out: Shift[] = boxes.map(() => ({ dx: 0, dy: 0 }));
  const maxShift = Math.min(capPx, (maxKm / spanKm) * widthPx);
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a].y - boxes[b].y || boxes[a].x - boxes[b].x);
  const placed: PinBox[] = [];
  for (const i of order) {
    const b = boxes[i];
    const steps: Shift[] = [{ dx: 0, dy: 0 }];
    if (maxShift >= 4) {
      for (const f of [0.34, 0.67, 1]) {
        const r = maxShift * f;
        steps.push({ dx: 0, dy: r }, { dx: 0, dy: -r }, { dx: r, dy: 0 }, { dx: -r, dy: 0 }, { dx: r * 0.7, dy: r * 0.7 }, { dx: -r * 0.7, dy: r * 0.7 }, { dx: r * 0.7, dy: -r * 0.7 }, { dx: -r * 0.7, dy: -r * 0.7 });
      }
    }
    const pick = steps.find((s) => !placed.some((p) => overlaps({ ...b, x: b.x + s.dx, y: b.y + s.dy }, p))) ?? steps[0];
    out[i] = pick;
    placed.push({ ...b, x: b.x + pick.dx, y: b.y + pick.dy });
  }
  return out;
}
