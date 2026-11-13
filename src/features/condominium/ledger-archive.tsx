import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiClient } from "@/api/client";
import {
  CONDO_KEY,
  condominiumAccountingApi,
  type CondoBook,
  type CondoProperty,
} from "@/api/condominium-accounting.api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveBlobAs } from "@/lib/file-download";
import { getProblemMessage } from "@/lib/api-errors";
import { formatCurrency } from "@/lib/utils";
interface ImportBatch {
  id: string;
  alreadyImported: boolean;
  casaZenIsSource: boolean;
  houses: {
    id: string;
    name: string;
    propertyId: string | null;
    confirmed: boolean;
    years: {
      label: string;
      ordinary: number;
      extraordinary: number;
      prior: number;
      payments: number;
      settlement: number;
    }[];
  }[];
}
const base = "/long-rent/condominium-imports";
export function LedgerArchive({
  book,
  canWrite,
}: {
  book: CondoBook;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const properties =
    qc.getQueryData<CondoProperty[]>([CONDO_KEY, "properties"]) ?? [];
  const stage = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 5 * 1024 * 1024)
        throw new Error(t("condoLedger.archiveFileLimit"));
      const data: unknown = JSON.parse(await file.text());
      return ApiClient.post<ImportBatch>(base, data);
    },
    onSuccess: (result) => {
      setBatch(result);
      setMapping({});
    },
  });
  const verify = useMutation({
    mutationFn: ({ house, property }: { house: string; property: string }) =>
      ApiClient.post<ImportBatch>(
        `${base}/${batch!.id}/houses/${house}/property`,
        { propertyId: property },
      ),
    onSuccess: setBatch,
  });
  const confirm = useMutation({
    mutationFn: () =>
      ApiClient.post<ImportBatch>(`${base}/${batch!.id}/confirm`, {}),
    onSuccess: (result) => {
      setBatch(result);
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
    },
  });
  const backup = useMutation({
    mutationFn: async () => {
      const reports = await Promise.all(
        book.periods.map((period) =>
          condominiumAccountingApi.report(book.id, period.id),
        ),
      );
      saveBlobAs(
        new Blob(
          [
            JSON.stringify(
              {
                format: "casazen-condominium-reports-v1",
                exportedAt: new Date().toISOString(),
                book,
                reports,
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
        "resoconti-condominiali.json",
      );
    },
  });
  const pending = stage.isPending || verify.isPending || confirm.isPending;
  return (
    <section className="ledger-panel">
      <h3>{t("condoLedger.archiveTitle")}</h3>
      <p>{t("condoLedger.archiveHint")}</p>
      <Button
        variant="outline"
        disabled={backup.isPending}
        onClick={() => backup.mutate()}
      >
        {t("condoLedger.exportData")}
      </Button>
      {canWrite ? (
        <div className="space-y-4 mt-5">
          <Field
            label={t("condoLedger.importHistory")}
            hint={t("condoLedger.importHistoryHint")}
          >
            <Input
              type="file"
              accept=".json,application/json"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setBatch(null);
                  stage.mutate(file);
                }
                e.target.value = "";
              }}
            />
          </Field>
          {batch ? (
            <>
              <p>
                {t(
                  batch.casaZenIsSource
                    ? "condoLedger.historyImported"
                    : "condoLedger.historyReview",
                )}
              </p>
              {batch.houses.map((house) => (
                <div className="ledger-panel" key={house.id}>
                  <h3>{house.name}</h3>
                  <div className="overflow-x-auto">
                    <table>
                      <thead>
                        <tr>
                          {[
                            "period",
                            "ordinary",
                            "extraordinary",
                            "prior",
                            "paid",
                          ].map((k) => (
                            <th key={k}>
                              {k === "period"
                                ? t("condoBook.period")
                                : t(`condoBook.totals.${k}`)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {house.years.map((year) => (
                          <tr key={year.label}>
                            <th>{year.label}</th>
                            {[
                              year.ordinary,
                              year.extraordinary,
                              year.prior,
                              year.payments,
                            ].map((n, i) => (
                              <td key={i}>{formatCurrency(n, "EUR")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!house.confirmed ? (
                    <>
                      <Field
                        label={`${t("condoBook.property")} · ${house.name}`}
                      >
                        <select
                          disabled={pending}
                          value={mapping[house.id] ?? house.propertyId ?? ""}
                          onChange={(e) =>
                            setMapping((old) => ({
                              ...old,
                              [house.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">
                            {t("condoBook.chooseProperty")}
                          </option>
                          {properties.map((p) => (
                            <option key={p.propertyId} value={p.propertyId}>
                              {p.propertyName}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Button
                        variant="outline"
                        disabled={
                          pending || !(mapping[house.id] ?? house.propertyId)
                        }
                        onClick={() =>
                          verify.mutate({
                            house: house.id,
                            property: mapping[house.id] ?? house.propertyId!,
                          })
                        }
                      >
                        {t("condoLedger.verifyProperty")}
                      </Button>
                    </>
                  ) : null}
                </div>
              ))}
              {!batch.casaZenIsSource ? (
                <Button
                  disabled={
                    pending ||
                    !batch.houses.length ||
                    batch.houses.some(
                      (h) =>
                        !h.propertyId ||
                        (mapping[h.id] && mapping[h.id] !== h.propertyId),
                    )
                  }
                  onClick={() => confirm.mutate()}
                >
                  {t("condoLedger.confirmHistory")}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {stage.isError || verify.isError || confirm.isError || backup.isError ? (
        <p role="alert">
          {getProblemMessage(
            stage.error ?? verify.error ?? confirm.error ?? backup.error,
            t,
          ) ?? t("condoBook.saveError")}
        </p>
      ) : null}
    </section>
  );
}
