import type { CondoReport } from "@/api/condominium-accounting.api";
import { saveBlobAs } from "@/lib/file-download";
import { formatCurrency } from "@/lib/utils";
function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function foldIcs(line: string) {
  const chunks: string[] = [];
  let current = "";
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > 73) {
      chunks.push(current);
      current = "";
    }
    current += char;
  }
  chunks.push(current);
  return chunks.join("\r\n ");
}
export function downloadCalendar(report: CondoReport) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CasaZen//Rate Condominiali//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  for (const row of report.installments.filter((i) => i.remaining > 0))
    lines.push(
      "BEGIN:VEVENT",
      `UID:casazen-condo-${row.id}@casazen.it`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${row.dueDate.slice(0, 10).replace(/-/g, "")}`,
      `SUMMARY:${escapeIcs(`${report.condominiumName} · ${row.label}`)}`,
      `DESCRIPTION:${escapeIcs(`${formatCurrency(row.remaining, "EUR")} · ${report.periodLabel}`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P5D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(row.label)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  lines.push("END:VCALENDAR");
  saveBlobAs(
    new Blob([lines.map(foldIcs).join("\r\n") + "\r\n"], {
      type: "text/calendar;charset=utf-8",
    }),
    `rate-${report.periodLabel.replace(/[^\w-]/g, "-")}.ics`,
  );
}
