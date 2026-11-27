/** A number («1.», «2)») or a tick («-», «–», «•», «*») at the start of a line written by the host. */
const MARKER = /^\s*(?:\d{1,2}[.)]|[-–•*])\s+/;

/**
 * The steps of a way to follow, as the host wrote it in the guide (UX round 2026-11, after the «Step 2 di 6» of the arrival
 * instructions that hosts know from their channel manager): paragraphs set apart by a blank line are steps, and so are lines
 * that the host numbered or ticked («1. Parcheggia…», «- Entra…»). Anything else stays one text: a few lines of prose are not
 * cut into pieces. Fewer than two steps is one text too (an empty list).
 */
export function guideSteps(value: string): string[] {
  const paragraphs = value
    .split(/\r?\n[^\S\r\n]*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs.map((paragraph) => paragraph.replace(MARKER, ''));

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1 && lines.every((line) => MARKER.test(line))) return lines.map((line) => line.replace(MARKER, ''));
  return [];
}
