import { useTranslation } from "react-i18next";
import type { CondoReport } from "@/api/condominium-accounting.api";
import { formatDate } from "@/lib/utils";
import { euro } from "../condominium-format";

const REPORT_TOTALS = [
  "ordinary",
  "extraordinary",
  "prior",
  "finalAmount",
  "paid",
  "stillToPay",
] as const;
const REPORT_COLUMNS = [
  "dueDate",
  "ordinary",
  "prior",
  "extraordinary",
  "due",
  "paid",
  "remaining",
] as const;
const REPORT_AMOUNTS = [
  "ordinary",
  "prior",
  "extraordinary",
  "due",
  "paid",
  "remaining",
] as const;

export function Report({ report }: { report: CondoReport }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {REPORT_TOTALS.map((key) => (
          <div key={key}>
            <dt className="text-sm text-muted-foreground">
              {t(`condoBook.totals.${key}`)}
            </dt>
            <dd className="text-lg font-semibold">
              {report[key] == null ? "—" : euro(report[key])}
            </dd>
          </div>
        ))}
      </dl>
      {report.settlement ? (
        <p>
          {t(`condoBook.settlements.${report.settlement.direction}`, {
            amount: euro(report.settlement.amount),
          })}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="text-left font-semibold">
            {t("condoBook.installments")}
          </caption>
          <thead>
            <tr>
              {REPORT_COLUMNS.map((k) => (
                <th key={k} scope="col" className="p-2 text-left">
                  {t(`condoBook.columns.${k}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.installments.map((row) => (
              <tr key={row.id} className="border-t">
                <th scope="row" className="p-2 text-left font-normal">
                  {row.label}
                  <br />
                  {formatDate(row.dueDate)}
                </th>
                {REPORT_AMOUNTS.map((k) => (
                  <td className="whitespace-nowrap p-2" key={k}>
                    {euro(row[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.payments.length ? (
        <section className="space-y-2">
          <h3 className="font-semibold">{t("condoBook.payments")}</h3>
          <ul>
            {report.payments.map((p) => (
              <li key={p.id}>
                {formatDate(p.paidOn)} · {euro(p.amount)} · {p.method} ·{" "}
                {p.covers}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
