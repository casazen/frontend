import { todayInRome } from "@/lib/stay-dates";
import { useTranslation } from "react-i18next";
import {
  Home,
  CreditCard,
  FileChartColumn,
  SlidersHorizontal,
  Building2,
} from "lucide-react";
import type { CondoReport } from "@/api/condominium-accounting.api";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

export type LedgerView =
  | "panoramica"
  | "pagamenti"
  | "resoconti"
  | "impostazioni"
  | "budget"
  | "final"
  | "prior"
  | "record"
  | "documents"
  | "bank"
  | "plan";
const pages = [
  ["panoramica", Home],
  ["pagamenti", CreditCard],
  ["resoconti", FileChartColumn],
  ["impostazioni", SlidersHorizontal],
] as const;
const euro = (value: number) => formatCurrency(value, "EUR");
export function LedgerNavigation({
  view,
  onNavigate,
  name,
}: {
  view: LedgerView;
  onNavigate: (view: LedgerView) => void;
  name: string;
}) {
  const { t } = useTranslation();
  const active = ["record", "bank"].includes(view)
    ? "pagamenti"
    : ["budget", "final", "prior", "documents", "plan"].includes(view)
      ? "resoconti"
      : view;
  return (
    <aside className="ledger-rail">
      <div className="ledger-brand">
        <span>
          <Building2 size={22} />
        </span>
        <div>
          <strong>{t("condoLedger.brand")}</strong>
          <small>{t("condoManual.title")}</small>
        </div>
      </div>
      <div className="ledger-house">
        <small>{t("condoLedger.house")}</small>
        <strong>{name}</strong>
      </div>
      <nav aria-label={t("condoLedger.navigation")}>
        {pages.map(([id, Icon]) => (
          <button
            type="button"
            key={id}
            aria-current={active === id ? "page" : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{t(`condoLedger.views.${id}`)}</span>
          </button>
        ))}
      </nav>
      <p className="ledger-rail-note">{t("condoLedger.railNote")}</p>
    </aside>
  );
}
export function InstallmentList({
  report,
  onRecord,
  canWrite,
}: {
  report: CondoReport;
  onRecord: (id: string) => void;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const rows = report.installments
    .filter((i) => i.remaining > 0)
    .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate));
  return rows.length ? (
    <div className="ledger-rows">
      {rows.map((row) => (
        <div className="ledger-row" key={row.id}>
          <span className="ledger-voice" aria-hidden="true">
            P
          </span>
          <div>
            <strong>{row.label}</strong>
            <small>
              {formatDate(row.dueDate)} · {t("condoLedger.remaining")}
            </small>
          </div>
          <strong>{euro(row.remaining)}</strong>
          {canWrite ? (
            <Button variant="outline" onClick={() => onRecord(row.id)}>
              {t("condoBook.recordPayment")}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  ) : (
    <p className="ledger-empty">
      {t(
        report.installments.length
          ? "condoLedger.allPaid"
          : "condoLedger.noPlan",
      )}
    </p>
  );
}
export function PaymentList({
  report,
  limit,
}: {
  report: CondoReport;
  limit?: number;
}) {
  const { t } = useTranslation();
  const rows = report.payments
    .toSorted((a, b) => b.paidOn.localeCompare(a.paidOn))
    .slice(0, limit);
  return rows.length ? (
    <div className="ledger-rows">
      {rows.map((p) => (
        <div className="ledger-row" key={p.id}>
          <span className="ledger-voice ledger-voice-paid" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>{p.covers}</strong>
            <small>
              {formatDate(p.paidOn)} · {p.method}
            </small>
          </div>
          <strong>{euro(p.amount)}</strong>
          <span className="ledger-badge">{t("condoLedger.paid")}</span>
        </div>
      ))}
    </div>
  ) : (
    <p className="ledger-empty">{t("condoLedger.noPayments")}</p>
  );
}
export function LedgerOverview({
  report,
  canWrite,
  onNavigate,
}: {
  report: CondoReport;
  canWrite: boolean;
  onNavigate: (view: LedgerView) => void;
}) {
  const { t } = useTranslation();
  const next = report.installments
    .filter((i) => i.remaining > 0)
    .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const late = !!next && next.dueDate.slice(0, 10) < todayInRome();
  return (
    <>
      <div className="ledger-overview-grid">
        <section className="ledger-panel ledger-due">
          <div className="ledger-panel-head">
            <h3>
              {next
                ? t("condoLedger.dueBy", { date: formatDate(next.dueDate) })
                : t("condoLedger.due")}
            </h3>
            {next ? (
              <span
                className={`ledger-badge ${late ? "ledger-badge-warning" : ""}`}
              >
                {t(late ? "condoLedger.late" : "condoLedger.upcoming")}
              </span>
            ) : null}
          </div>
          <div className="ledger-big-amount">
            {euro(next?.remaining ?? report.stillToPay)}
          </div>
          {next ? (
            <div className="ledger-row">
              <span className="ledger-voice">P</span>
              <div>
                <strong>{next.label}</strong>
                <small>{t("condoLedger.ownerPayment")}</small>
              </div>
              <strong>{euro(next.remaining)}</strong>
            </div>
          ) : (
            <p className="ledger-empty">
              {t(
                report.installments.length
                  ? "condoLedger.allPaid"
                  : "condoLedger.noPlan",
              )}
            </p>
          )}
          <div className="ledger-actions">
            {canWrite ? (
              <Button
                onClick={() =>
                  onNavigate(
                    next || report.installments.length ? "record" : "budget",
                  )
                }
              >
                {t(
                  next || report.installments.length
                    ? "condoBook.recordPayment"
                    : "condoLedger.addBudget",
                )}
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => onNavigate(canWrite ? "bank" : "pagamenti")}
            >
              {t(
                canWrite
                  ? "condoLedger.bankTitle"
                  : "condoLedger.allInstallments",
              )}
            </Button>
          </div>
        </section>
        <section className="ledger-panel">
          <div className="ledger-panel-head">
            <h3>{t("condoLedger.currentYear")}</h3>
            <span className="ledger-badge">{report.periodLabel}</span>
          </div>
          <div className="ledger-progress-label">
            <span>
              {t("condoBook.totals.paid")} <strong>{euro(report.paid)}</strong>
            </span>
            <span>
              {euro(
                (report.finalAmount ?? report.ordinary) +
                  report.extraordinary +
                  report.prior,
              )}
            </span>
          </div>
          <progress
            className="ledger-progress"
            aria-label={t("condoBook.totals.paid")}
            value={Math.max(0, report.paid)}
            max={Math.max(
              1,
              (report.finalAmount ?? report.ordinary) +
                report.extraordinary +
                report.prior,
            )}
          />
          <dl className="ledger-year-rows">
            {(
              ["ordinary", "extraordinary", "prior", "finalAmount"] as const
            ).map((key, i) => (
              <div key={key}>
                <dt>
                  <span className={`ledger-voice ledger-voice-${key}`}>
                    {["P", "S", "R", "C"][i]}
                  </span>
                  {t(`condoBook.totals.${key}`)}
                </dt>
                <dd>{report[key] == null ? "—" : euro(report[key])}</dd>
              </div>
            ))}
          </dl>
          <div className="ledger-year-footer">
            <span>{t("condoBook.totals.paid")}</span>
            <strong>{euro(report.paid)}</strong>
          </div>
          <button
            className="ledger-text-button"
            type="button"
            onClick={() => onNavigate("resoconti")}
          >
            {t("condoLedger.yearDetails")} →
          </button>
        </section>
      </div>
      <section className="ledger-panel">
        <div className="ledger-panel-head">
          <h3>{t("condoLedger.latestPayments")}</h3>
          <button
            className="ledger-text-button"
            onClick={() => onNavigate("pagamenti")}
          >
            {t("condoLedger.allPayments")} →
          </button>
        </div>
        <PaymentList report={report} limit={4} />
      </section>
      <section className="ledger-panel ledger-summary">
        <div>
          <small>{t("condoLedger.totalDue")}</small>
          <strong>
            {euro(
              (report.finalAmount ?? report.ordinary) +
                report.extraordinary +
                report.prior,
            )}
          </strong>
        </div>
        <div>
          <small>{t("condoBook.totals.paid")}</small>
          <strong>{euro(report.paid)}</strong>
        </div>
        <div>
          <small>{t("condoBook.totals.stillToPay")}</small>
          <strong>{euro(report.stillToPay)}</strong>
        </div>
      </section>
    </>
  );
}

export function LedgerStartChoice({
  onDocuments,
  onManual,
}: {
  onDocuments: () => void;
  onManual: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="ledger-onboarding">
      <h2>{t("condoLedger.startTitle")}</h2>
      <p>{t("condoLedger.startHint")}</p>
      <div className="ledger-choices">
        <button type="button" className="ledger-choice" onClick={onDocuments}>
          <strong>{t("condoLedger.uploadChoice")}</strong>
          <span>{t("condoLedger.uploadHint")}</span>
          <small>{t("condoLedger.optional")}</small>
        </button>
        <button type="button" className="ledger-choice" onClick={onManual}>
          <strong>{t("condoLedger.manualChoice")}</strong>
          <span>{t("condoLedger.manualHint")}</span>
          <small>{t("condoLedger.later")}</small>
        </button>
      </div>
    </section>
  );
}
