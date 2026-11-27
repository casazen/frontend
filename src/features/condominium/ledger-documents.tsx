import {
  useStatementUpload,
  type StatementProposal,
} from "./ledger-document-api";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiClient } from "@/api/client";
import {
  CONDO_KEY,
  CONDO_BASE,
  type CondoBook,
  type CondoPeriod,
} from "@/api/condominium-accounting.api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getProblemMessage } from "@/lib/api-errors";
import { formatCurrency } from "@/lib/utils";
import { parseEuroAmount } from "@/lib/euro-amount";
export function DocumentPicker({
  kind,
  onKind,
  upload,
  book,
}: {
  kind: string;
  onKind: (kind: string) => void;
  upload: ReturnType<typeof useStatementUpload>;
  book: CondoBook;
}) {
  const { t } = useTranslation();
  return (
    <>
      <h3>{t("condoLedger.documentTitle")}</h3>
      <p>{t("condoLedger.documentHint")}</p>
      <div className="ledger-document-kinds">
        {["budget", "final", "plan"].map((k) => (
          <button
            type="button"
            key={k}
            aria-pressed={kind === k}
            disabled={upload.isPending}
            onClick={() => onKind(k)}
          >
            <span className="ledger-voice">
              {k === "budget" ? "P" : k === "final" ? "C" : "R"}
            </span>
            <strong>{t(`condoLedger.documents.${k}`)}</strong>
            <small>{t("condoLedger.optional")}</small>
          </button>
        ))}
      </div>
      {kind === "plan" ? (
        <InstallmentDocument book={book} />
      ) : (
        <Field label={t("condoBook.file")} hint={t("condoBook.fileHint")}>
          <Input
            type="file"
            accept=".pdf"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
        </Field>
      )}
      {upload.isPending ? (
        <p role="status">{t("condoLedger.reading")}</p>
      ) : null}
      {upload.isError ? (
        <p role="alert">
          {getProblemMessage(upload.error, t) ?? t("condoBook.saveError")}{" "}
          {t("condoLedger.manualFallback")}
        </p>
      ) : null}
    </>
  );
}
export function ProposalReview({
  proposal,
  confirm,
  pending,
}: {
  proposal: StatementProposal | null;
  confirm: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  if (!proposal) return null;
  return (
    <section className="ledger-proposal" aria-label={t("condoLedger.review")}>
      <h3>{t("condoBook.proposalReady", { year: proposal.label })}</h3>
      <p>
        {t(proposal.kind === "Budget" ? "condoBook.budget" : "condoBook.final")}{" "}
        ·{" "}
        {formatCurrency(proposal.ordinary ?? proposal.finalAmount ?? 0, "EUR")}{" "}
        · {formatCurrency(proposal.extraordinary ?? 0, "EUR")}
      </p>
      <blockquote>{proposal.excerpt}</blockquote>
      <ul>
        {proposal.notExtracted.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <Button disabled={pending} onClick={confirm}>
        {t("condoBook.confirmImport")}
      </Button>
    </section>
  );
}
interface PlanRow {
  dueDate: string;
  ordinary: string;
  extraordinary: string;
}
export function InstallmentDocument({ book }: { book: CondoBook }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [periodId, setPeriodId] = useState(book.periods[0]?.id ?? "");
  const [year, setYear] = useState("");
  const upload = useMutation({
    mutationFn: (file: File) => {
      const data = new FormData();
      data.append("file", file);
      return ApiClient.post<{
        installments: {
          dueDate: string;
          ordinary: number;
          extraordinary: number;
        }[];
        excerpt: string;
        notExtracted: string[];
      }>(`${CONDO_BASE}/${book.id}/installments/read`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: (data) => {
      setRows(
        data.installments.map((row) => ({
          dueDate: row.dueDate,
          ordinary: String(row.ordinary),
          extraordinary: String(row.extraordinary),
        })),
      );
    },
  });
  const parsed = rows.map((r) => ({
    dueDate: r.dueDate,
    ordinary: parseEuroAmount(r.ordinary),
    extraordinary: parseEuroAmount(r.extraordinary),
  }));
  const selected = book.periods.find((p) => p.id === periodId);
  const valid =
    rows.length > 0 &&
    rows.length <= 366 &&
    new Set(rows.map((r) => r.dueDate)).size === rows.length &&
    parsed.every(
      (r) =>
        /^\d{4}-\d{2}-\d{2}$/.test(r.dueDate) &&
        (!selected ||
          (r.dueDate >= selected.startDate.slice(0, 10) &&
            r.dueDate <= selected.endDate.slice(0, 10))) &&
        r.ordinary !== null &&
        r.extraordinary !== null &&
        r.ordinary + r.extraordinary > 0,
    ) &&
    parsed.reduce((sum, r) => sum + (r.ordinary ?? 0), 0) > 0;
  const save = useMutation({
    mutationFn: async () => {
      const period =
        periodId ||
        (
          await ApiClient.post<CondoPeriod>(
            `${CONDO_BASE}/${book.id}/periods`,
            { label: year.trim() },
          )
        ).id;
      return ApiClient.post<{ installmentsLeftAsIssued: boolean }>(
        `${CONDO_BASE}/${book.id}/periods/${period}/budget`,
        {
          ordinaryAmount: Number(
            parsed.reduce((sum, r) => sum + (r.ordinary ?? 0), 0).toFixed(2),
          ),
          extraordinary: parsed.some((r) => r.extraordinary)
            ? [
                {
                  amount: Number(
                    parsed
                      .reduce((sum, r) => sum + (r.extraordinary ?? 0), 0)
                      .toFixed(2),
                  ),
                },
              ]
            : [],
          cadence: "Custom",
          ordinaryNeedsReview: true,
          customInstallments: parsed,
        },
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
    },
  });
  function update(index: number, key: keyof PlanRow, value: string) {
    save.reset();
    setRows((old) =>
      old.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  }
  return (
    <fieldset disabled={save.isPending} className="space-y-4">
      <p>{t("condoLedger.planHint")}</p>
      <Field label={t("condoBook.file")} hint={t("condoBook.fileHint")}>
        <Input
          type="file"
          accept=".pdf"
          disabled={upload.isPending || save.isPending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              save.reset();
              upload.mutate(f);
            }
            e.target.value = "";
          }}
        />
      </Field>
      {upload.isPending ? (
        <p role="status">{t("condoLedger.reading")}</p>
      ) : null}
      {upload.data ? (
        <details>
          <summary>{t("condoLedger.sourceDocument")}</summary>
          <blockquote>{upload.data.excerpt}</blockquote>
          {upload.data.notExtracted.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </details>
      ) : null}
      {rows.length ? (
        <>
          <p>{t("condoLedger.reviewPlan")}</p>
          <Field label={t("condoBook.period")}>
            <select
              value={periodId}
              onChange={(e) => {
                save.reset();
                setPeriodId(e.target.value);
              }}
            >
              <option value="">{t("condoBook.newPeriod")}</option>
              {book.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          {!periodId ? (
            <Field label={t("condoBook.newPeriod")}>
              <Input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder={book.fiscalStartMonth === 1 ? "2027" : "2026/2027"}
              />
            </Field>
          ) : null}
          <div className="ledger-plan-rows">
            {rows.map((r, i) => (
              <div className="ledger-plan-row" key={i}>
                <Field label={`${t("condoLedger.planDate")} ${i + 1}`}>
                  <Input
                    type="date"
                    value={r.dueDate}
                    onChange={(e) => update(i, "dueDate", e.target.value)}
                  />
                </Field>
                <Field label={`${t("condoBook.columns.ordinary")} ${i + 1}`}>
                  <Input
                    inputMode="decimal"
                    value={r.ordinary}
                    onChange={(e) => update(i, "ordinary", e.target.value)}
                  />
                </Field>
                <Field
                  label={`${t("condoBook.columns.extraordinary")} ${i + 1}`}
                >
                  <Input
                    inputMode="decimal"
                    value={r.extraordinary}
                    onChange={(e) => update(i, "extraordinary", e.target.value)}
                  />
                </Field>
                <Button
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => {
                    save.reset();
                    setRows((old) => old.filter((_, index) => index !== i));
                  }}
                >
                  {t("condoLedger.remove")}
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              save.reset();
              setRows((old) => [
                ...old,
                { dueDate: "", ordinary: "", extraordinary: "0" },
              ]);
            }}
          >
            {t("condoLedger.addRow")}
          </Button>
          <p>
            {t("condoLedger.planTotal")}:{" "}
            {formatCurrency(
              parsed.reduce(
                (sum, r) => sum + (r.ordinary ?? 0) + (r.extraordinary ?? 0),
                0,
              ),
              "EUR",
            )}
          </p>
          <Button
            disabled={
              !valid ||
              (!periodId && !year.trim()) ||
              save.isPending ||
              save.isSuccess
            }
            onClick={() => save.mutate()}
          >
            {t("condoLedger.confirmPlan")}
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          onClick={() =>
            setRows([{ dueDate: "", ordinary: "", extraordinary: "0" }])
          }
        >
          {t("condoLedger.manualPlan")}
        </Button>
      )}
      {save.isSuccess ? <p role="status">{t(save.data?.installmentsLeftAsIssued ? "condoLedger.issuedKept" : "condoBook.saved")}</p> : null}
      {upload.isError || save.isError ? (
        <p role="alert">
          {getProblemMessage(upload.error ?? save.error, t) ??
            t("condoBook.saveError")}
        </p>
      ) : null}
    </fieldset>
  );
}
