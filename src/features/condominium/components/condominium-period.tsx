import { useTranslation } from "react-i18next";
import type { CondoBook, CondoPeriod } from "@/api/condominium-accounting.api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getProblemMessage } from "@/lib/api-errors";
import { parseEuroAmount } from "@/lib/euro-amount";
import { selectClass } from "../condominium-format";
import { LedgerBankImport } from "../ledger-bank-import";
import { downloadCalendar } from "../ledger-calendar";
import { InstallmentDocument } from "../ledger-documents";
import { InstallmentList, LedgerOverview, LedgerStartChoice, PaymentList, type LedgerView } from "../ledger-workspace";
import { useCondominiumPeriodState } from "../use-condominium-period-state";
import { RecordPayment } from "./record-payment-form";
import { Report } from "./condominium-report";

const PDF_KINDS = ["paid", "unpaid"] as const;
const OWNER_CADENCES = [
  "Monthly",
  "Bimonthly",
  "Semiannual",
  "Single",
  "Custom",
] as const;
const BALANCE_DISPOSITIONS = [
  "NextInstallment",
  "SeparateInstallment",
  "Refund",
  "CarryForward",
] as const;

function signedEuro(raw: string): number | null {
  const text = raw.trim();
  const negative = text.startsWith("-");
  const amount = parseEuroAmount(negative ? text.slice(1) : text);
  return amount === null ? null : negative ? -amount : amount;
}

export function Period({
  book,
  period,
  canWrite,
  view,
  onNavigate,
}: {
  book: CondoBook;
  period: CondoPeriod;
  canWrite: boolean;
  view: LedgerView;
  onNavigate: (view: LedgerView) => void;
}) {
  const { t } = useTranslation();
  const {
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
  } = useCondominiumPeriodState(book, period);

  return (
    <div className="space-y-6">
      {report.isPending ? <p role="status">{t("condoBook.loading")}</p> : null}
      {report.isError ? (
        <p role="alert">
          {t("condoBook.loadError")}{" "}
          <button className="underline" onClick={() => void report.refetch()}>
            {t("condoBook.retry")}
          </button>
        </p>
      ) : null}
      {report.data &&
      view === "panoramica" &&
      canWrite &&
      report.data.ordinary === 0 &&
      report.data.finalAmount === null &&
      !report.data.installments.length &&
      !report.data.payments.length ? (
        <LedgerStartChoice
          onDocuments={() => onNavigate("documents")}
          onManual={() => onNavigate("budget")}
        />
      ) : report.data && view === "panoramica" ? (
        <LedgerOverview
          report={report.data}
          canWrite={canWrite}
          onNavigate={onNavigate}
        />
      ) : null}
      {view === "plan" && canWrite ? (
        <section className="ledger-panel">
          <InstallmentDocument book={book} />
        </section>
      ) : null}
      {view === "bank" && canWrite && report.data ? (
        <LedgerBankImport
          bookId={book.id}
          periodId={period.id}
          report={report.data}
        />
      ) : null}
      {view === "pagamenti" && report.data ? (
        <>
          <div
            className="ledger-segments"
            role="tablist"
            aria-label={t("condoLedger.paymentFilter")}
          >
            <button
              role="tab"
              aria-selected={paymentTab === "due"}
              onClick={() => setPaymentTab("due")}
            >
              {t("condoLedger.due")}{" "}
              <span>
                {report.data.installments.filter((i) => i.remaining > 0).length}
              </span>
            </button>
            <button
              role="tab"
              aria-selected={paymentTab === "paid"}
              onClick={() => setPaymentTab("paid")}
            >
              {t("condoLedger.paid")} <span>{report.data.payments.length}</span>
            </button>
          </div>
          <section className="ledger-panel" role="tabpanel">
            {paymentTab === "due" ? (
              <InstallmentList
                report={report.data}
                onRecord={(id) => {
                  setSelectedInstallment(id);
                  onNavigate("record");
                }}
                canWrite={canWrite}
              />
            ) : (
              <PaymentList report={report.data} />
            )}
          </section>
        </>
      ) : null}
      {view === "resoconti" && report.data ? (
        <section className="ledger-panel">
          <Report report={report.data} />
        </section>
      ) : null}
      {view === "resoconti" ? (
        <div className="flex flex-wrap gap-3">
          {PDF_KINDS.map((kind) => (
            <Button
              key={kind}
              variant="outline"
              disabled={pdf.isPending || !report.data}
              onClick={() => pdf.mutate(kind)}
            >
              {t(`condoBook.pdf.${kind}`)}
            </Button>
          ))}
          {report.data ? (
            <Button
              variant="outline"
              onClick={() => downloadCalendar(report.data!)}
            >
              {t("condoLedger.calendar")}
            </Button>
          ) : null}
          {canWrite ? (
            <>
              <Button onClick={() => onNavigate("budget")}>
                {t("condoLedger.addStatement")}
              </Button>
              <Button variant="outline" onClick={() => onNavigate("documents")}>
                {t("condoLedger.uploadChoice")}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {canWrite ? (
        <>
          {["budget", "final", "prior"].includes(view) ? (
            <>
              <button
                className="ledger-back"
                type="button"
                onClick={() => onNavigate("resoconti")}
              >
                ← {t("condoLedger.views.resoconti")}
              </button>
              <div
                className="ledger-segments"
                aria-label={t("condoLedger.statementType")}
              >
                {(["budget", "final", "prior"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => onNavigate(v)}
                  >
                    {t(`condoLedger.views.${v}`)}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {view === "budget" ? (
            <form
              className="space-y-4 border-t pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (amount && extra !== null && extra >= 0 && !pending)
                  action.mutate({
                    url: `${base}/budget`,
                    body: {
                      ordinaryAmount: amount,
                      extraordinary: extra ? [{ amount: extra }] : [],
                      cadence,
                      customDueDates:
                        cadence === "Custom"
                          ? customDates.split(/[\s,;]+/).filter(Boolean)
                          : undefined,
                    },
                  });
              }}
            >
              <h3 className="font-semibold">{t("condoBook.budget")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("condoBook.budgetHint")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("condoBook.ordinary")}>
                  <Input
                    inputMode="decimal"
                    value={ordinary}
                    onChange={(e) => setOrdinary(e.target.value)}
                  />
                </Field>
                <Field label={t("condoBook.extraordinary")}>
                  <Input
                    inputMode="decimal"
                    value={extraordinary}
                    onChange={(e) => setExtraordinary(e.target.value)}
                  />
                </Field>
                <Field label={t("condoBook.cadence")}>
                  <select
                    className={selectClass}
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value)}
                  >
                    {OWNER_CADENCES.map((c) => (
                      <option key={c} value={c}>
                        {t(`condoBook.cadences.${c}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {cadence === "Custom" ? (
                <Field
                  label={t("condoBook.customDates")}
                  hint={t("condoBook.customDatesHint")}
                >
                  <Textarea
                    value={customDates}
                    onChange={(e) => setCustomDates(e.target.value)}
                  />
                </Field>
              ) : null}
              <Button
                type="submit"
                disabled={pending || !amount || extra === null || extra < 0}
              >
                {t("condoBook.saveBudget")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onNavigate("plan")}
              >
                {t("condoLedger.manualPlan")}
              </Button>
            </form>
          ) : null}
          {view === "final" ? (
            <form
              className="space-y-4 border-t pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (finalAmount && !pending)
                  action.mutate({
                    url: `${base}/final`,
                    body: { amount: finalAmount, settlement: disposition },
                  });
              }}
            >
              <h3 className="font-semibold">{t("condoBook.final")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("condoBook.finalHint")}
              </p>
              <Field label={t("condoBook.finalAmount")}>
                <Input
                  inputMode="decimal"
                  value={final}
                  onChange={(e) => setFinal(e.target.value)}
                />
              </Field>
              <Field label={t("condoBook.disposition")}>
                <select
                  className={selectClass}
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                >
                  {BALANCE_DISPOSITIONS.map((d) => (
                    <option key={d} value={d}>
                      {t(`condoBook.dispositions.${d}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit" disabled={pending || !finalAmount}>
                {t("condoBook.saveFinal")}
              </Button>
            </form>
          ) : null}
          {view === "prior" ? (
            <form
              className="space-y-4 border-t pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                const value = signedEuro(prior);
                if (value !== null && !pending)
                  action.mutate({
                    url: `${base}/prior-balance`,
                    body: { amount: value, disposition },
                  });
              }}
            >
              <h3 className="font-semibold">{t("condoBook.priorTitle")}</h3>
              <Field
                label={t("condoBook.priorAmount")}
                hint={t("condoBook.priorHint")}
              >
                <Input
                  inputMode="decimal"
                  value={prior}
                  onChange={(e) => setPrior(e.target.value)}
                />
              </Field>
              <Field label={t("condoBook.disposition")}>
                <select
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                >
                  {BALANCE_DISPOSITIONS.map((d) => (
                    <option key={d} value={d}>
                      {t(`condoBook.dispositions.${d}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                type="submit"
                disabled={pending || signedEuro(prior) === null}
              >
                {t("condoBook.savePrior")}
              </Button>
            </form>
          ) : null}
          {report.data && view === "record" ? (
            <RecordPayment
              key={selectedInstallment}
              base={base}
              report={report.data}
              initialInstallment={selectedInstallment}
            />
          ) : null}
        </>
      ) : null}
      {action.isSuccess ? <p role="status">{t("condoBook.saved")}</p> : null}
      {action.isError || pdf.isError ? (
        <p role="alert">
          {getProblemMessage(action.error ?? pdf.error, t) ??
            t("condoBook.saveError")}
        </p>
      ) : null}
    </div>
  );
}
