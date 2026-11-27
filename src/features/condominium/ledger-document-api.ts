import { useMutation } from "@tanstack/react-query";
import { ApiClient } from "@/api/client";
import { CONDO_BASE } from "@/api/condominium-accounting.api";
export interface StatementProposal {
  id: string;
  label: string;
  kind: string;
  ordinary: number | null;
  extraordinary: number | null;
  finalAmount: number | null;
  excerpt: string;
  notExtracted: string[];
}
export function useStatementUpload(
  book: string,
  onSuccess: (proposal: StatementProposal | null) => void,
) {
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return ApiClient.post<StatementProposal>(
        `${CONDO_BASE}/${book}/statements/read`,
        body,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
    },
    onMutate: () => onSuccess(null),
    onSuccess,
  });
}
