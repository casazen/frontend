/** Shared look of the schematic maps (DB-19a): the font stack and the ink and halo colours of the labels. */

export const FONT = "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif";
export const INK = '#4a4136';
export const HALO = '#f7f1e6';

/** Rough width of a label in px: the engine places labels without measuring text in a browser. */
export const textW = (s: string, size: number, ls = 0, k = 0.57): number => s.length * (size * k + ls);

let mapCounter = 0;
/** Resets the counter of the ids used inside the SVG definitions (for deterministic snapshots). */
export function resetMapIds(): void {
  mapCounter = 0;
}
/** Every SVG gets its own id prefix, so several maps can live in one page without clashing. */
export const nextPrefix = (): string => `sm${++mapCounter}`;
