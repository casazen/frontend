import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';

interface DocumentSummary {
  id: string;
  number: string;
  kind: string;
  total: number;
  currency: string;
}

export function GuestPortalDocuments({ path, language, labels }: {
  path: string;
  language: string;
  labels: { loading: string; failed: string; empty: string; download: string; correction: string; requested: string };
}) {
  const endpoint = `${path}/documents`;
  const docs = useQuery({
    queryKey: ['guest-portal-documents', endpoint],
    queryFn: ({ signal }) => ApiClient.get<DocumentSummary[]>(endpoint, undefined, { public: true, signal }),
    gcTime: 0,
    retry: false,
  });
  const pdf = useMutation({
    mutationFn: async (document: DocumentSummary) => {
      const response = await axios.get<Blob>(`${endpoint}/${document.id}/pdf`, { public: true, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${document.number.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const correction = useMutation({
    mutationFn: (id: string) => ApiClient.post<void>(`${endpoint}/${id}/correction-request`, undefined, { public: true }),
  });
  return (
    <section className="stay-card stay-content">
      {docs.isPending && <p role="status">{labels.loading}</p>}
      {(docs.isError || pdf.isError || correction.isError) && <p role="alert">{labels.failed}</p>}
      {correction.isSuccess && <p role="status">{labels.requested}</p>}
      {docs.data?.length === 0 && <p>{labels.empty}</p>}
      {docs.data?.map((document) => (
        <div key={document.id} className="stay-document">
          <span>{document.number} · {new Intl.NumberFormat(language, { style: 'currency', currency: document.currency }).format(document.total)}</span>
          {document.kind === 'Invoice' && (
            <button type="button" disabled={correction.isPending}
              onClick={() => correction.mutate(document.id)}>{labels.correction}</button>
          )}
          <button disabled={pdf.isPending} onClick={() => pdf.mutate(document)}>{labels.download}</button>
        </div>
      ))}
    </section>
  );
}
