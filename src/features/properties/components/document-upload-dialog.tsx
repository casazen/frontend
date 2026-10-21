import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import type { PropertyDocumentType } from '@/types';
import { DocumentPages } from '@/components/documents/document-pages';
import { EMPTY_DOCUMENT, documentReady, prepareDocument, type DocumentSelection } from '@/lib/document-pdf';
import { useUploadPropertyDocument } from '@/queries/use-properties';

interface DocumentUploadDialogProps {
  propertyId: string;
  /** Type selected when the dialog opens (default: CIN certificate). */
  defaultDocumentType?: PropertyDocumentType;
}

function getDocumentTypeLabels(t: ReturnType<typeof useTranslation>['t']): { value: PropertyDocumentType; label: string }[] {
  return [
    { value: 'CinCertificate', label: t('shared.documentUpload.types.cinCertificate') },
    { value: 'FloorPlan', label: t('shared.documentUpload.types.floorPlan') },
    { value: 'InsurancePolicy', label: t('shared.documentUpload.types.insurancePolicy') },
    { value: 'PropertyLicense', label: t('shared.documentUpload.types.propertyLicense') },
    { value: 'SafetyCompliance', label: t('shared.documentUpload.types.safetyCompliance') },
    { value: 'Ape', label: t('shared.documentUpload.types.ape') },
    { value: 'Other', label: t('shared.documentUpload.types.other') },
  ];
}

export function DocumentUploadDialog({ propertyId, defaultDocumentType = 'CinCertificate' }: DocumentUploadDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<DocumentSelection>(EMPTY_DOCUMENT);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [documentType, setDocumentType] = useState<PropertyDocumentType>(defaultDocumentType);

  const uploadMutation = useUploadPropertyDocument();

  const documentTypes = getDocumentTypeLabels(t);

  const reset = useCallback(() => {
    setSelection(EMPTY_DOCUMENT);
    setError('');
    setDocumentType(defaultDocumentType);

  }, [defaultDocumentType]);

  const handleSubmit = async () => {
    if (!documentReady(selection)) return;
    setPreparing(true); setError('');
    try {
      const file = await prepareDocument(selection, 10 * 1024 * 1024);
      await uploadMutation.mutateAsync({ propertyId, file, documentType });
      reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('documentPages.')) setError(t(error.message));
    } finally { setPreparing(false); }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (preparing || uploadMutation.isPending) return;
        setOpen(next);
        if (!next && !preparing && !uploadMutation.isPending) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          {t('shared.documentUpload.uploadDocument')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('shared.documentUpload.uploadDocument')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="documentType">{t('shared.documentUpload.documentType')}</Label>
            <select
              id="documentType"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={documentType}
              disabled={preparing || uploadMutation.isPending}
              onChange={(e) => { setDocumentType(e.target.value as PropertyDocumentType); setSelection(EMPTY_DOCUMENT); }}
            >
              {documentTypes.map((dt) => (
                <option key={dt.value} value={dt.value}>
                  {dt.label}
                </option>
              ))}
            </select>
          </div>
          <DocumentPages value={selection} onChange={setSelection} disabled={preparing || uploadMutation.isPending} allowOffice={documentType !== 'Ape'} maxPdfMb={10} />
          {error ? <p role="alert">{error}</p> : null}
          {documentType === 'Ape' ? <p className="text-sm text-muted-foreground">{t('shared.documentUpload.apeScanNotice')}</p> : null}
          <Button
            className="w-full"
            disabled={!documentReady(selection) || preparing || uploadMutation.isPending}
            onClick={handleSubmit}
          >
            {preparing || uploadMutation.isPending ? t('shared.documentUpload.uploading') : t('shared.documentUpload.upload')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
