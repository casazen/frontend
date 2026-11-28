export function formatWholeEuro(amount: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(amount));
}

export interface SplitSource {
  label: string;
  url: string | null;
  note: string;
}

/**
 * A source of the tax advisory as the server writes it: the name of the page, then its address ("Agenzia delle Entrate, Cedolare secca
 * (consultata il 23/09/2026): https://…"), sometimes a remark after it. The address becomes a link; the rest is the label and the note.
 */
export function splitSource(source: string): SplitSource {
  const match = /https?:\/\/[^\s]+/.exec(source);
  if (!match) return { label: source, url: null, note: '' };
  const url = match[0].replace(/[.,;]+$/, '');
  const label = source.slice(0, match.index).replace(/[:\s]+$/, '').trim();
  const note = source.slice(match.index + match[0].length).replace(/^[\s.,;]+/, '').trim();
  return { label: label || url, url, note };
}
