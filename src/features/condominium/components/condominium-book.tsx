import { useTranslation } from "react-i18next";
import type { CondoBook } from "@/api/condominium-accounting.api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getProblemMessage } from "@/lib/api-errors";
import { formatDate } from "@/lib/utils";
import { selectClass } from "../condominium-format";
import { LedgerArchive } from "../ledger-archive";
import { DocumentPicker, ProposalReview } from "../ledger-documents";
import { LedgerNavigation, LedgerStartChoice, type LedgerView } from "../ledger-workspace";
import { useCondominiumBookState } from "../use-condominium-book-state";
import { Period } from "./condominium-period";

export function Book({
  book,
  canWrite,
  initialView,
}: {
  book: CondoBook;
  canWrite: boolean;
  initialView: LedgerView;
}) {
  const { t } = useTranslation();
  const {
    view,
    setView,
    newYear,
    setNewYear,
    documentKind,
    setDocumentKind,
    proposal,
    setProposal,
    upload,
    confirm,
    setSelected,
    year,
    setYear,
    period,
    create,
  } = useCondominiumBookState(book, initialView);

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
