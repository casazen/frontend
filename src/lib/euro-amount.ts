export function parseEuroAmount(raw: string): number | null {
  const text = raw.trim().replace(/[\s\u00a0']/g, '');
  if (text === '') return null;
  let normalized = text;
  if (text.includes(',')) {
    if (!/^(?:\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)$/.test(text)) return null;
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, '');
  } else if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}
