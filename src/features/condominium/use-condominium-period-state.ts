import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@/api/client";
import { CONDO_BASE, CONDO_KEY, condominiumAccountingApi, type CondoBook, type CondoPeriod } from "@/api/condominium-accounting.api";
import { parseEuroAmount } from "@/lib/euro-amount";

/** The state of one period: its report, the forms of the budget, the final statement and the prior balance, and the writes and the PDFs. */
export function useCondominiumPeriodState(book: CondoBook, period: CondoPeriod) {
  const qc = useQueryClient();
  const base = `${CONDO_BASE}/${book.id}/periods/${period.id}`;
  const report = useQuery({
    queryKey: [CONDO_KEY, book.id, period.id],
    queryFn: () => condominiumAccountingApi.report(book.id, period.id),
  });
  const [selectedInstallment, setSelectedInstallment] = useState("");
  const [paymentTab, setPaymentTab] = useState<"due" | "paid">("due");
  const [ordinary, setOrdinary] = useState("");
  const [extraordinary, setExtraordinary] = useState("");
  const [final, setFinal] = useState("");
  const [cadence, setCadence] = useState("Monthly");
  const [customDates, setCustomDates] = useState("");
  const [prior, setPrior] = useState("");
  const [disposition, setDisposition] = useState("NextInstallment");
  const action = useMutation({
    mutationFn: ({ url, body }: { url: string; body: unknown }) =>
      ApiClient.post(url, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
      void qc.invalidateQueries({ queryKey: ["condominium-manual-payments"] });
      void qc.invalidateQueries({ queryKey: ["lease-rent"] });
      void qc.invalidateQueries({ queryKey: ["long-rent-rents"] });
    },
  });
  const pdf = useMutation({
    mutationFn: (kind: "paid" | "unpaid") =>
      condominiumAccountingApi.pdf(book.id, period.id, kind),
  });
  const pending = action.isPending;
  const amount = parseEuroAmount(ordinary);
  const extra = extraordinary.trim() ? parseEuroAmount(extraordinary) : 0;
  const finalAmount = parseEuroAmount(final);

  return {
    base,
    report,
    selectedInstallment,
    setSelectedInstallment,
    paymentTab,
    setPaymentTab,
    ordinary,
    setOrdinary,
    extraordinary,
    setExtraordinary,
    final,
    setFinal,
    cadence,
    setCadence,
    customDates,
    setCustomDates,
    prior,
    setPrior,
    disposition,
    setDisposition,
    action,
    pdf,
    pending,
    amount,
    extra,
    finalAmount,
  };
}
