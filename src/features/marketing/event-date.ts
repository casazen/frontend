export function eventDateText(date: string, language: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(parsed);
}
