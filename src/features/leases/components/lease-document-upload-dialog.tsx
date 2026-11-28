import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { leaseDocumentsApi, type LeaseDocumentKind } from '@/api/lease-documents.api';
import { DocumentPages } from '@/components/documents/document-pages';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { EMPTY_DOCUMENT, documentReady, prepareDocument, type DocumentSelection } from '@/lib/document-pdf';
import { leaseDocumentsKey } from '@/queries/use-lease-documents';

const MAX_BYTES = 20 * 1024 * 1024;

interface LeaseDocumentUploadDialogProps {
  leaseId: string;
  kind: LeaseDocumentKind;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaseDocumentUploadDialog({ leaseId, kind, title, open, onOpenChange }: LeaseDocumentUploadDialogProps) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [selection, setSelection] = useState<DocumentSelection>(EMPTY_DOCUMENT);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState('');
  const [failure, setFailure] = useState<unknown>(null);

  function handleOpenChange(next: boolean) {
    if (working) return;
    if (!next) {
      setSelection(EMPTY_DOCUMENT);
      setProblem('');
      setFailure(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    if (!documentReady(selection) || working) return;
    setWorking(true);
    setProblem('');
    setFailure(null);
    try {
      const file = await prepareDocument(selection, MAX_BYTES);
      await leaseDocumentsApi.upload(leaseId, file, kind);
      await client.invalidateQueries({ queryKey: leaseDocumentsKey(leaseId) });
      toast.success(t('cfDocuments.saved'));
      setSelection(EMPTY_DOCUMENT);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('documentPages.')) setProblem(t(error.message));
      else setFailure(error);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl" aria-describedby={undefined} data-testid="lease-document-upload-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <DocumentPages
            value={selection}
            onChange={(next) => {
              setSelection(next);
              setProblem('');
              setFailure(null);
            }}
            disabled={working}
          />
          {problem ? (
            <p role="alert" className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]">
              {problem}
            </p>
          ) : null}
          {failure ? <Alert variant="danger">{getProblemMessage(failure, t) ?? t('cfDocuments.uploadError')}</Alert> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={working}>
            {t('shared.cancel')}
          </Button>
          <Button type="button" onClick={() => void submit()} loading={working} disabled={!documentReady(selection)} data-testid="lease-document-upload-submit">
            {t(working ? 'cfDocuments.uploading' : 'cfDocuments.upload')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
