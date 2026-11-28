import "./condominium-ledger.css";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getProblemMessage } from "@/lib/api-errors";
import { Book } from "./components/condominium-book";
import { selectClass } from "./condominium-format";
import { useCondominiumManagementState } from "./use-condominium-management-state";

export function CondominiumManagement({ propertyId }: { propertyId?: string }) {
  const { t } = useTranslation();
  const {
    canWrite,
    properties,
    selectedProperty,
    setProperty,
    setBook,
    entry,
    setEntry,
    name,
    setName,
    month,
    setMonth,
    property,
    book,
    setup,
  } = useCondominiumManagementState(propertyId);

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
          initialView={entry === "documents" ? "documents" : entry === "manual" ? "budget" : "panoramica"}
        />
      ) : null}
    </section>
  );
}
