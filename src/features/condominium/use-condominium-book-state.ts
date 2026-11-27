import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@/api/client";
import { CONDO_BASE, CONDO_KEY, type CondoBook, type CondoPeriod } from "@/api/condominium-accounting.api";
import { useStatementUpload, type StatementProposal } from "./ledger-document-api";
import type { LedgerView } from "./ledger-workspace";

/** The state of one book: the view on show, the period chosen or being created, and the statement uploaded and confirmed. */
export function useCondominiumBookState(book: CondoBook, initialView: LedgerView) {
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

  return {
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
  };
}
