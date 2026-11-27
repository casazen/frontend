const MARKER = /^\s*(?:\d{1,2}[.)]|[-–•*])\s+/;

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
