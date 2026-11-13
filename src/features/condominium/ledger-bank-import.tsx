import { readBankFile, type BankRow } from "./ledger-bank-reader";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiClient } from "@/api/client";
import {
  CONDO_KEY,
  CONDO_BASE,
  type CondoReport,
} from "@/api/condominium-accounting.api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getProblemMessage } from "@/lib/api-errors";
import { formatCurrency, formatDate } from "@/lib/utils";
export function LedgerBankImport({
  bookId,
  periodId,
  report,
}: {
  bookId: string;
  periodId: string;
  report: CondoReport;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [rows, setRows] = useState<BankRow[]>([]);
  const read = useMutation({
    mutationFn: readBankFile,
    onSuccess: (result) => {
      setRows(
        result.map((row) => ({
          ...row,
          selected: false,
          installment: "",
          imported: false,
        })),
      );
    },
  });
  const post = useMutation({
    mutationFn: async () => {
      for (const row of rows.filter((r) => r.selected && !r.imported)) {
        await ApiClient.post(
          `${CONDO_BASE}/${bookId}/periods/${periodId}/payments`,
          {
            installmentId: row.installment || null,
            coversPriorBalance: false,
            amount: row.amount,
            paidOn: row.date,
            method: "Estratto conto",
            note: row.details.slice(0, 500),
            externalSourceHash: `bank-import:${bookId}:${row.id}`,
          },
        );
        setRows((old) =>
          old.map((r) =>
            r.id === row.id ? { ...r, imported: true, selected: false } : r,
          ),
        );
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
      void qc.invalidateQueries({ queryKey: ["condominium-manual-payments"] });
    },
  });
  function update(id: string, change: Partial<BankRow>) {
    post.reset();
    setRows((old) => old.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }
  return (
    <section className="ledger-panel">
      <h3>{t("condoLedger.bankTitle")}</h3>
      <p>{t("condoLedger.bankHint")}</p>
      <fieldset disabled={read.isPending || post.isPending}>
        <Field label={t("condoLedger.bankFile")}>
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setRows([]);
                post.reset();
                read.mutate(file);
              }
              e.target.value = "";
            }}
          />
        </Field>
        {rows.length ? (
          <>
            <div className="ledger-bank-rows">
              {rows.map((row) => (
                <div className="ledger-bank-row" key={row.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={row.selected}
                      disabled={row.imported}
                      onChange={(e) =>
                        update(row.id, { selected: e.target.checked })
                      }
                    />
                    <span>
                      {formatDate(row.date)} ·{" "}
                      {formatCurrency(row.amount, "EUR")}
                      <small>{row.details}</small>
                    </span>
                  </label>
                  {row.imported ? (
                    <span className="ledger-badge">
                      {t("condoLedger.imported")}
                    </span>
                  ) : (
                    <select
                      aria-label={`${t("condoBook.installment")} ${formatDate(row.date)} ${row.amount}`}
                      value={row.installment}
                      onChange={(e) =>
                        update(row.id, { installment: e.target.value })
                      }
                    >
                      <option value="">{t("condoBook.yearPayment")}</option>
                      {report.installments
                        .filter((i) => i.remaining > 0)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.label}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
            <Button
              disabled={!rows.some((r) => r.selected && !r.imported)}
              onClick={() => post.mutate()}
            >
              {t("condoLedger.confirmBank")}
            </Button>
          </>
        ) : null}
      </fieldset>
      {read.isPending ? <p role="status">{t("condoLedger.reading")}</p> : null}
      {post.isSuccess ? <p role="status">{t("condoBook.saved")}</p> : null}
      {read.isError || post.isError ? (
        <p role="alert">
          {getProblemMessage(read.error ?? post.error, t) ??
            (read.error instanceof Error
              ? read.error.message
              : t("condoBook.saveError"))}
        </p>
      ) : null}
    </section>
  );
}
