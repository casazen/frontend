import {
  useStatementUpload,
  type StatementProposal,
} from "./ledger-document-api";
import { downloadCalendar } from "./ledger-calendar";
import { LedgerBankImport } from "./ledger-bank-import";
import { LedgerArchive } from "./ledger-archive";
import { useState } from "react";
import {
  InstallmentDocument,
  DocumentPicker,
  ProposalReview,
} from "./ledger-documents";
import {
  InstallmentList,
  PaymentList,
  LedgerStartChoice,
  LedgerOverview,
  LedgerNavigation,
  type LedgerView,
} from "./ledger-workspace";
import "./condominium-ledger.css";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@/api/client";
import {
  CONDO_BASE,
  CONDO_KEY,
  condominiumAccountingApi,
  type CondoBook,
  type CondoPeriod,
  type CondoReport,
} from "@/api/condominium-accounting.api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getProblemMessage } from "@/lib/api-errors";
import { parseEuroAmount } from "@/lib/euro-amount";

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
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const euro = (n: number) => formatCurrency(n, "EUR");
function signedEuro(raw: string): number | null {
  const text = raw.trim();
  const negative = text.startsWith("-");
  const amount = parseEuroAmount(negative ? text.slice(1) : text);
  return amount === null ? null : negative ? -amount : amount;
}

/** The property owns the book even while vacant or without a rent schedule. */
export function CondominiumManagement({ propertyId }: { propertyId?: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission("long-rent", "property.write");
  const qc = useQueryClient();
  const properties = useQuery({
    queryKey: [CONDO_KEY, "properties"],
    queryFn: condominiumAccountingApi.properties,
  });
  const [selectedProperty, setProperty] = useState(propertyId ?? "");
  const [selectedBook, setBook] = useState("");
  const [entry, setEntry] = useState<"documents" | "manual" | null>(null);
  const [name, setName] = useState("");
  const [month, setMonth] = useState("1");
  const property = properties.data?.find(
    (p) => p.propertyId === (propertyId ?? selectedProperty),
  );
  const book =
    property?.books.find((b) => b.id === selectedBook) ?? property?.books[0];
  const setup = useMutation({
    mutationFn: () =>
      ApiClient.post(`${CONDO_BASE}/properties/${property!.propertyId}`, {
        name: name.trim() || property!.propertyName,
        fiscalStartMonth: Number(month),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
    },
  });
  return (
    <section className="condo-ledger" data-testid="condominium-management">
      {properties.isPending ? (
        <p role="status">{t("condoBook.loading")}</p>
      ) : null}
      {properties.isError ? (
        <p role="alert">
          {t("condoBook.loadError")}{" "}
          <button
            className="underline"
            onClick={() => void properties.refetch()}
          >
            {t("condoBook.retry")}
          </button>
        </p>
      ) : null}
      {!propertyId && properties.data ? (
        <Field
          className="ledger-property-picker"
          label={t("condoBook.property")}
        >
          <select
            className={selectClass}
            value={selectedProperty}
            onChange={(e) => {
              setProperty(e.target.value);
              setBook("");
              setEntry(null);
              setName("");
              setMonth("1");
              setup.reset();
            }}
          >
            <option value="">{t("condoBook.chooseProperty")}</option>
            {properties.data.map((p) => (
              <option key={p.propertyId} value={p.propertyId}>
                {p.propertyName}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {properties.data?.length === 0 ? (
        <p>{t("condoBook.noProperties")}</p>
      ) : null}
      {property && !book ? (
        <div className="ledger-onboarding">
          <span className="ledger-eyebrow">{property.propertyName}</span>
          <h2>{t("condoLedger.startTitle")}</h2>
          <p>{t("condoLedger.startHint")}</p>
          {!entry && canWrite ? (
            <div className="ledger-choices">
              <button
                type="button"
                className="ledger-choice"
                onClick={() => setEntry("documents")}
              >
                <span className="ledger-choice-icon" aria-hidden="true">
                  ↥
                </span>
                <strong>{t("condoLedger.uploadChoice")}</strong>
                <span>{t("condoLedger.uploadHint")}</span>
                <small>{t("condoLedger.optional")}</small>
              </button>
              <button
                type="button"
                className="ledger-choice"
                onClick={() => setEntry("manual")}
              >
                <span className="ledger-choice-icon" aria-hidden="true">
                  ✎
                </span>
                <strong>{t("condoLedger.manualChoice")}</strong>
                <span>{t("condoLedger.manualHint")}</span>
                <small>{t("condoLedger.later")}</small>
              </button>
            </div>
          ) : null}
          {entry ? (
            <button
              className="ledger-back"
              type="button"
              onClick={() => setEntry(null)}
            >
              ← {t("condoLedger.changeChoice")}
            </button>
          ) : null}
          {canWrite && entry ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!setup.isPending) setup.mutate();
              }}
            >
              <Field label={t("condoBook.name")}>
                <Input
                  value={name}
                  maxLength={200}
                  placeholder={property.propertyName}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label={t("condoBook.startMonth")}>
                <select
                  className={selectClass}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {t(`condoBook.months.${i + 1}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Button disabled={setup.isPending} type="submit">
                {t("condoBook.setup")}
              </Button>
              {setup.isError ? (
                <p role="alert">
                  {getProblemMessage(setup.error, t) ??
                    t("condoBook.saveError")}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}
      {property && property.books.length > 1 ? (
        <Field label={t("condoBook.book")}>
          <select
            className={selectClass}
            value={book?.id ?? ""}
            onChange={(e) => setBook(e.target.value)}
          >
            {property.books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {book ? (
        <Book
          key={book.id}
          book={book}
          canWrite={canWrite}
          initialView={entry === "documents" ? "documents" : "panoramica"}
        />
      ) : null}
    </section>
  );
}

function Book({
  book,
  canWrite,
  initialView,
}: {
  book: CondoBook;
  canWrite: boolean;
  initialView: LedgerView;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [view, setView] = useState<LedgerView>(initialView);
  const [newYear, setNewYear] = useState(false);
  const [documentKind, setDocumentKind] = useState("budget");
  const [proposal, setProposal] = useState<StatementProposal | null>(null);
  const upload = useStatementUpload(book.id, setProposal);
  const confirm = useMutation({
    mutationFn: () =>
      ApiClient.post(
        `${CONDO_BASE}/${book.id}/statements/proposals/${proposal!.id}/confirm`,
        {},
      ),
    onSuccess: () => {
      setProposal(null);
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
    },
  });
  const [selected, setSelected] = useState("");
  const [year, setYear] = useState("");
  const period = book.periods.find((p) => p.id === selected) ?? book.periods[0];
  const create = useMutation({
    mutationFn: () =>
      ApiClient.post<CondoPeriod>(`${CONDO_BASE}/${book.id}/periods`, {
        label: year.trim(),
      }),
    onSuccess: (p) => {
      setSelected(p.id);
      setYear("");
      setNewYear(false);
      setView("budget");
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
    },
  });
  return (
    <div className="ledger-workspace">
      <LedgerNavigation view={view} onNavigate={setView} name={book.name} />
      <div className="ledger-main">
        <header className="ledger-page-head">
          <div>
            <span className="ledger-eyebrow">{book.name}</span>
            <h2>{t(`condoLedger.views.${view}`)}</h2>
            <p>{t(`condoLedger.subtitles.${view}`)}</p>
          </div>
          <div className="ledger-toolbar">
            {book.periods.length > 0 ? (
              <Field label={t("condoBook.period")}>
                <select
                  className={selectClass}
                  value={period?.id ?? ""}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {book.periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} · {formatDate(p.startDate)} –{" "}
                      {formatDate(p.endDate)}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <p>{t("condoBook.noPeriod")}</p>
            )}
            {canWrite && (view === "impostazioni" || view === "resoconti") ? (
              <Button variant="outline" onClick={() => setNewYear(!newYear)}>
                {t("condoBook.newPeriod")}
              </Button>
            ) : null}
            {canWrite &&
            period &&
            (view === "panoramica" || view === "pagamenti") ? (
              <Button onClick={() => setView("record")}>
                {t("condoLedger.views.record")}
              </Button>
            ) : null}
            {canWrite && period && view === "pagamenti" ? (
              <Button variant="outline" onClick={() => setView("bank")}>
                {t("condoLedger.bankTitle")}
              </Button>
            ) : null}
          </div>
        </header>
        {canWrite && (newYear || (!period && view === "budget")) ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!create.isPending && year.trim()) create.mutate();
            }}
          >
            <Field
              label={t("condoBook.newPeriod")}
              hint={t("condoBook.yearHint")}
            >
              <Input
                value={year}
                maxLength={9}
                placeholder={book.fiscalStartMonth === 1 ? "2027" : "2026/2027"}
                onChange={(e) => setYear(e.target.value)}
                required
              />
            </Field>
            <Button
              variant="outline"
              type="submit"
              disabled={create.isPending || !year.trim()}
            >
              {t("condoBook.createPeriod")}
            </Button>
            {create.isError ? (
              <p role="alert">
                {getProblemMessage(create.error, t) ?? t("condoBook.saveError")}
              </p>
            ) : null}
          </form>
        ) : null}
        {!period && view === "panoramica" && canWrite ? (
          <LedgerStartChoice
            onDocuments={() => setView("documents")}
            onManual={() => setView("budget")}
          />
        ) : null}
        {view === "documents" ? (
          <section className="ledger-panel ledger-document-panel">
            <DocumentPicker
              kind={documentKind}
              onKind={(kind) => {
                setDocumentKind(kind);
                setProposal(null);
                upload.reset();
              }}
              upload={upload}
              book={book}
            />
            <ProposalReview
              proposal={proposal}
              confirm={() => confirm.mutate()}
              pending={confirm.isPending}
            />
            {confirm.isError ? (
              <p role="alert">
                {getProblemMessage(confirm.error, t) ??
                  t("condoBook.saveError")}
              </p>
            ) : null}
            <Button
              variant="outline"
              onClick={() => {
                setView("budget");
                setNewYear(!period);
              }}
            >
              {t("condoLedger.manualChoice")}
            </Button>
          </section>
        ) : null}
        {view === "impostazioni" ? (
          <>
            <section className="ledger-panel">
              <h3>{t("condoLedger.houseSettings")}</h3>
              <dl className="ledger-account">
                <dt>{t("condoBook.name")}</dt>
                <dd>{book.name}</dd>
                <dt>{t("condoBook.startMonth")}</dt>
                <dd>{t(`condoBook.months.${book.fiscalStartMonth}`)}</dd>
              </dl>
              <p>{t("condoBook.intro")}</p>
              <Button variant="outline" onClick={() => setNewYear(true)}>
                {t("condoBook.createPeriod")}
              </Button>
            </section>
            <LedgerArchive book={book} canWrite={canWrite} />
          </>
        ) : null}
        {period ? (
          <Period
            key={period.id}
            book={book}
            period={period}
            canWrite={canWrite}
            view={view}
            onNavigate={setView}
          />
        ) : null}
      </div>
    </div>
  );
}

function Period({
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

function Report({ report }: { report: CondoReport }) {
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

function RecordPayment({
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
