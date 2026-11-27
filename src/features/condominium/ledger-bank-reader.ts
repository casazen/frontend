import { parseEuroAmount } from "@/lib/euro-amount";
import { isStayDate } from "@/lib/stay-dates";
export interface BankRow {
  id: string;
  date: string;
  amount: number;
  details: string;
  selected: boolean;
  installment: string;
  imported: boolean;
}
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function asDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const text = String(value ?? "").trim();
  const parts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const iso = parts
    ? `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`
    : text;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
    !Number.isFinite(Date.parse(iso)) ||
    !isStayDate(iso)
  )
    return null;
  return iso;
}
export async function readBankFile(
  file: File,
): Promise<Omit<BankRow, "selected" | "installment" | "imported">[]> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("File troppo grande (massimo 10 MB).");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets[workbook.SheetNames[0]],
    { header: 1, defval: "", raw: true },
  );
  const normal = (v: unknown) =>
    String(v ?? "")
      .trim()
      .toLowerCase();
  const head = rows.findIndex(
    (row) =>
      row.some((c) => normal(c) === "data") &&
      row.some((c) => normal(c).startsWith("importo")),
  );
  if (head < 0) throw new Error("Intestazioni Data / Importo mancanti.");
  const headers = rows[head].map(normal);
  const dateAt = headers.indexOf("data");
  const amountAt = headers.findIndex((h) => h.startsWith("importo"));
  const detailsAt = headers.findIndex((h) =>
    /dettagli|descrizione|causale/.test(h),
  );
  const currencyAt = headers.findIndex((h) => /divisa|valuta|currency/.test(h));
  const seen = new Map<string, number>();
  const result: Omit<BankRow, "selected" | "installment" | "imported">[] = [];
  for (const row of rows.slice(head + 1)) {
    const date = asDate(row[dateAt]);
    const raw = row[amountAt];
    const number =
      typeof raw === "number"
        ? raw
        : (() => {
            const text = String(raw ?? "")
              .replace(/EUR|€/gi, "")
              .trim();
            const n = parseEuroAmount(
              text.startsWith("-") ? text.slice(1) : text,
            );
            return n === null ? NaN : text.startsWith("-") ? -n : n;
          })();
    const currency =
      currencyAt < 0
        ? "EUR"
        : String(row[currencyAt] ?? "")
            .trim()
            .toUpperCase();
    if (
      !date ||
      !Number.isFinite(number) ||
      number >= 0 ||
      (currency && currency !== "EUR")
    )
      continue;
    const amount = Math.round(Math.abs(number) * 100) / 100;
    if (amount > 1_000_000 || amount <= 0) continue;
    const details = detailsAt < 0 ? "" : String(row[detailsAt] ?? "").trim();
    const identity = JSON.stringify([date, amount, details]);
    const occurrence = (seen.get(identity) ?? 0) + 1;
    seen.set(identity, occurrence);
    result.push({
      id: await hash(`${identity}:${occurrence}`),
      date,
      amount,
      details,
    });
  }
  if (!result.length)
    throw new Error("Nessun movimento in uscita in EUR riconosciuto.");
  return result;
}
