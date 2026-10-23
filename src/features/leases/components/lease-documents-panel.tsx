import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaseDocumentsApi, type LeaseDocumentKind } from '@/api/lease-documents.api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ErrorState } from '@/components/shared/error-state';
import { saveBlobAs } from '@/lib/file-download';
import { DocumentPages } from '@/components/documents/document-pages';
import { EMPTY_DOCUMENT, documentReady, prepareDocument, type DocumentSelection } from '@/lib/document-pdf';
import { formatDateTime } from '@/lib/utils';

const KINDS: LeaseDocumentKind[] = ['Contract', 'Attestation', 'Registration', 'Other'];

/** Lease-owned originals: no property document API or propertyId is accepted here. */
export function LeaseDocumentsPanel({ leaseId, canUpload = false }: { leaseId: string; canUpload?: boolean }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const formId = useId();
  const [kind, setKind] = useState<LeaseDocumentKind>('Contract');
  const [selection, setSelection] = useState<DocumentSelection>(EMPTY_DOCUMENT);
  const [preparing, setPreparing] = useState(false);
  const [validation, setValidation] = useState('');
  const [saved, setSaved] = useState(false);
  const documents = useQuery({ queryKey: ['lease-documents', leaseId], queryFn: () => leaseDocumentsApi.list(leaseId) });
  const upload = useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: LeaseDocumentKind }) => leaseDocumentsApi.upload(leaseId, file, kind),
    onSuccess: async () => {
      setSelection(EMPTY_DOCUMENT); setSaved(true);
      await client.invalidateQueries({ queryKey: ['lease-documents', leaseId] });
    },
  });
  const download = useMutation({
    mutationFn: async ({ id, fileName }: { id: string; fileName: string }) => {
      const blob = await leaseDocumentsApi.download(leaseId, id); saveBlobAs(blob, fileName);
    },
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!documentReady(selection) || upload.isPending || preparing) return;
    setPreparing(true); setValidation(''); setSaved(false);
    try {
      const file = await prepareDocument(selection, 20 * 1024 * 1024);
      await upload.mutateAsync({ file, kind });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('documentPages.')) setValidation(t(error.message));
    } finally { setPreparing(false); }
  };
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-labelledby={formId} data-testid="lease-documents-panel">
      <h2 id={formId} className="text-lg font-semibold">{t('cfDocuments.documentsTitle')}</h2>
      {documents.isPending ? <p role="status">{t('cfDocuments.loading')}</p> : null}
      {documents.isError ? <ErrorState title={t('cfDocuments.documentsError')} error={documents.error} onRetry={() => void documents.refetch()} /> : null}
      {documents.data?.length === 0 ? <p>{t('cfDocuments.empty')}</p> : null}
      <ul className="space-y-3">
        {documents.data?.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0"><p className="break-all">{document.fileName}</p><p className="text-sm text-muted-foreground">{t(`cfDocuments.kinds.${document.kind}`)} · {formatDateTime(document.uploadedAt)}</p></div>
          <Button type="button" variant="outline" disabled={download.isPending} onClick={() => download.mutate(document)}>{t('cfDocuments.download')}</Button>
        </li>)}
      </ul>
      {download.isError ? <ErrorState title={t('cfDocuments.downloadError')} error={download.error} /> : null}
      {canUpload ? <form onSubmit={submit} className="space-y-3">
        <div className="space-y-2"><Label htmlFor={`${formId}-kind`}>{t('cfDocuments.kind')}</Label>
          <select id={`${formId}-kind`} className="block w-full rounded-md border p-2" value={kind} onChange={(event) => setKind(event.target.value as LeaseDocumentKind)} disabled={upload.isPending || preparing}>
            {KINDS.map((value) => <option key={value} value={value}>{t(`cfDocuments.kinds.${value}`)}</option>)}
          </select>
        </div>
        <DocumentPages value={selection} onChange={(next) => { setSelection(next); setSaved(false); setValidation(''); upload.reset(); }} disabled={preparing || upload.isPending} />
        {validation ? <p role="alert">{validation}</p> : null}
        {upload.isError ? <ErrorState title={t('cfDocuments.uploadError')} error={upload.error} /> : null}
        {saved ? <p role="status">{t('cfDocuments.saved')}</p> : null}
        <Button type="submit" disabled={!documentReady(selection) || preparing || upload.isPending}>{t(preparing || upload.isPending ? 'cfDocuments.uploading' : 'cfDocuments.upload')}</Button>
      </form> : <Link className="inline-block underline" to={`/app/long-rent/documents/upload?leaseId=${encodeURIComponent(leaseId)}`}>{t('cfDocuments.title')}</Link>}
    </section>
  );
}
