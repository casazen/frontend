import type { TextRange } from './search';

/**
 * `text` with the parts the search found in bold on a soft background. Plain text nodes and spans only: whatever is in `text`
 * (a name, a property) is never read as markup. The weight and the background are the whole signal, so nothing depends on a
 * color, and a screen reader reads the text as it is, without announcing a mark.
 */
export function HighlightedText({ text, ranges }: { text: string; ranges: readonly TextRange[] }) {
  if (ranges.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(
      <span key={`${range.start}-${index}`} data-match="" className="rounded-[2px] bg-primary/15 font-semibold text-foreground">
        {text.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
