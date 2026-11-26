import { useGuestSupplierFiles } from './use-guest-supplier-files';
import { GuestSupplierFiles } from './guest-supplier-files';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import { isAxiosError } from 'axios';
import { GuestInvoiceForm } from '@/features/checkin/guest-invoice-form';
import { resolveGuestLocale, useGuestPageLocale } from '@/features/checkin/lib/guest-locale';
import { useTranslation } from 'react-i18next';

interface InvoiceState { issued: boolean; invoiceRequested: boolean; hasInvoiceData: boolean; hostManaged: boolean }


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
  const supplierFiles = useGuestSupplierFiles(endpoint);
  const docs = useQuery({
    queryKey: ['guest-portal-documents', endpoint],
    queryFn: ({ signal }) => ApiClient.get<DocumentSummary[]>(endpoint, undefined, { public: true, signal }),
    gcTime: 0,
    retry: false,
  });
  const invoiceEndpoint = `${endpoint}/invoice-data`;
  const invoice = useQuery({
    queryKey: ['guest-portal-invoice-data', invoiceEndpoint],
    queryFn: ({ signal }) => ApiClient.get<InvoiceState>(invoiceEndpoint, undefined, { public: true, signal }),
    gcTime: 0,
    retry: false,
  });
  useGuestPageLocale(resolveGuestLocale(language));
  const { t } = useTranslation();
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
      {(docs.isPending || invoice.isPending || supplierFiles.isPending) && <p role="status">{labels.loading}</p>}
      {(docs.isError || supplierFiles.isError || invoice.isError || pdf.isError || correction.isError) && <p role="alert">{labels.failed}</p>}
      {correction.isSuccess && <p role="status">{labels.requested}</p>}
      {invoice.data && !invoice.data.issued && <>
        {invoice.data.hostManaged && <p>{t('checkin.invoiceHostManaged')}</p>}
        <GuestInvoiceForm context={invoice.data} save={async (request) => {
            try {
              await ApiClient.put<void>(invoiceEndpoint, request, { public: true });
            } catch (error) {
              if (isAxiosError(error) && error.response?.status === 409)
                await Promise.all([invoice.refetch(), docs.refetch()]);
              throw error;
            }
            await invoice.refetch();
          }} />
      </>}
      {docs.data?.length === 0 && supplierFiles.data?.length === 0 && <p>{labels.empty}</p>}
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
      <GuestSupplierFiles endpoint={endpoint} language={language} orders={supplierFiles.data ?? []} />
    </section>
  );
}
