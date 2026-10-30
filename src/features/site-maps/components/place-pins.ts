/**
 * Keeps pins from hiding each other (DB-19b). The position of a house is rounded to about 1 km, so a pin may be moved by a
 * little without lying more than the rounding already does: never farther than `maxKm` (and never more than `capPx`). When even
 * that is not enough (a wide frame with many houses in one village) the pins that would sit on top of each other are grouped in
 * a grid: one bubble with their number, which brings the map closer to them. Pins that matter now (the selected one, the one lit
 * by the list, the emphasised ones) are never moved or grouped and are placed first; the others work around them.
 */
export interface PinBox {
  /** Position in px inside the frame. */
  x: number;
  y: number;
  /** Size of the pill in px. */
  w: number;
  h: number;
  /** Never moved nor grouped. */
  keep: boolean;
}

export interface Placement {
  /** Shift of every pin in px. */
  shifts: { dx: number; dy: number }[];
  /** For every pin, the pin that stands for its group: itself if it is alone or if it is the first of a group. */
  group: number[];
}

/** Rough size of a pill from its text: 8 px a character and the padding, at least a touch target. */
export const pillSize = (label: string): { w: number; h: number } => ({ w: Math.max(44, label.length * 8 + 36), h: 44 });

const overlaps = (a: PinBox, b: PinBox): boolean => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 2;

export function placePins(boxes: readonly PinBox[], { spanKm, widthPx, maxKm = 1.5, capPx = 44 }: { spanKm: number; widthPx: number; maxKm?: number; capPx?: number }): Placement {
  const shifts = boxes.map(() => ({ dx: 0, dy: 0 }));
  const group = boxes.map((_, i) => i);
  const maxShift = Math.min(capPx, (maxKm / spanKm) * widthPx);
  const order = boxes
    .map((_, i) => i)
    .sort((a, b) => Number(boxes[b].keep) - Number(boxes[a].keep) || boxes[a].y - boxes[b].y || boxes[a].x - boxes[b].x);
  const placed: { box: PinBox; index: number }[] = [];
  for (const i of order) {
    const b = boxes[i];
    if (b.keep) {
      placed.push({ box: b, index: i });
      continue;
    }
    const steps = [{ dx: 0, dy: 0 }];
    if (maxShift >= 4) {
      for (const f of [0.34, 0.67, 1]) {
        const r = maxShift * f;
        steps.push({ dx: 0, dy: r }, { dx: 0, dy: -r }, { dx: r, dy: 0 }, { dx: -r, dy: 0 }, { dx: r * 0.7, dy: r * 0.7 }, { dx: -r * 0.7, dy: r * 0.7 }, { dx: r * 0.7, dy: -r * 0.7 }, { dx: -r * 0.7, dy: -r * 0.7 });
      }
    }
    const free = steps.find((s) => !placed.some((p) => overlaps({ ...b, x: b.x + s.dx, y: b.y + s.dy }, p.box)));
    if (free) {
      shifts[i] = free;
      placed.push({ box: { ...b, x: b.x + free.dx, y: b.y + free.dy }, index: i });
      continue;
    }
    // no free place: it joins the group of the first pin it would cover, unless that is a pin that must stay alone
    const owner = placed.find((p) => overlaps(b, p.box));
    if (owner && !boxes[owner.index].keep) group[i] = group[owner.index];
    else placed.push({ box: b, index: i });
  }
  return { shifts, group };
}
