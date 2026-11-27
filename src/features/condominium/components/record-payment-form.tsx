import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@/api/client";
import { CONDO_KEY, type CondoReport } from "@/api/condominium-accounting.api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getProblemMessage } from "@/lib/api-errors";
import { parseEuroAmount } from "@/lib/euro-amount";
import { euro, selectClass } from "../condominium-format";

export function RecordPayment({
  base,
  report,
  initialInstallment = "",
}: {
  base: string;
  report: CondoReport;
  initialInstallment?: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [installment, setInstallment] = useState(initialInstallment);
  const [amount, setAmount] = useState(() => {
    const row = report.installments.find((i) => i.id === initialInstallment);
    return row ? String(row.remaining) : "";
  });
  const [date, setDate] = useState("");
  const [attempt, setAttempt] = useState(() => crypto.randomUUID());
  const value = parseEuroAmount(amount);
  const save = useMutation({
    mutationFn: () =>
      ApiClient.post(`${base}/payments`, {
        installmentId: installment || null,
        coversPriorBalance: false,
        amount: value,
        paidOn: date,
        method: "Bonifico home banking",
        externalSourceHash: `owner-payment:${attempt}`,
      }),
    onSuccess: () => {
      setAmount("");
      setAttempt(crypto.randomUUID());
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
      void qc.invalidateQueries({ queryKey: ["condominium-manual-payments"] });
    },
  });
  return (
    <form
      className="space-y-4 border-t pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value && date && !save.isPending) save.mutate();
      }}
    >
      <h3 className="font-semibold">{t("condoBook.recordPayment")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("condoBook.paymentHint")}
      </p>
      <Field label={t("condoBook.installment")}>
        <select
          className={selectClass}
          value={installment}
          onChange={(e) => setInstallment(e.target.value)}
        >
          <option value="">{t("condoBook.yearPayment")}</option>
          {report.installments
            .filter((i) => i.remaining > 0)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.label} · {euro(i.remaining)}
              </option>
            ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("condoBook.paymentAmount")}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label={t("condoBook.paymentDate")}>
          <Input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <Button type="submit" disabled={save.isPending || !value || !date}>
        {t("condoBook.recordPayment")}
      </Button>
      {save.isError ? (
        <p role="alert">
          {getProblemMessage(save.error, t) ?? t("condoBook.saveError")}
        </p>
      ) : null}
      {save.isSuccess ? <p role="status">{t("condoBook.saved")}</p> : null}
    </form>
  );
}
