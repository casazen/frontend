import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, type AlertVariant } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import type { ApeCheckOutcome, PropertyDocumentDto, PropertyDocumentType } from '@/types';
import { DocumentPages } from '@/components/documents/document-pages';
import { getProblemMessage } from '@/lib/api-errors';
import { EMPTY_DOCUMENT, documentReady, prepareDocument, type DocumentSelection } from '@/lib/document-pdf';
import { useUploadPropertyDocument } from '@/queries/use-properties';
import { ApeIdentificationForm } from './ape-identification-form';

interface DocumentUploadDialogProps {
  propertyId: string;
  /** Type selected when the dialog opens (default: CIN certificate). */
  defaultDocumentType?: PropertyDocumentType;
  /** Only this type, with no type to choose (the lease form asks for the APE). */
  onlyType?: PropertyDocumentType;
  /**
   * Opened from outside, with no button of its own: for a page whose button goes away once the document is on file (the lease
   * form hides "Carica l'APE" as soon as the APE is there), the window must not go with it before its last step.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

const APE_CHECK_VARIANT: Record<ApeCheckOutcome, AlertVariant> = {
  Verified: 'success',
  Incomplete: 'warning',
  NotRecognized: 'warning',
  NotChecked: 'info',
  Expired: 'danger',
};

/**
 * What the reading of the APE just stored found. Code and class read (from the file, or the code from the register of the region
 * when the file did not show it): they are said, to check, and nothing has to be typed. Otherwise the fields, filled with what was
 * read, for what is missing.
 */
function ApeSaved({ propertyId, document, onDone }: { propertyId: string; document: PropertyDocumentDto; onDone: () => void }) {
  const { t } = useTranslation();
  const outcome = document.apeCheck ?? null;
  const fields = (document.apeUnreadFields ?? []).join(', ');
  if (document.apeCode && document.apeEnergyClass) {
    return (
      <div className="space-y-4" data-testid="ape-saved">
        <Alert variant="success" data-testid="ape-identified">
          {t(document.apeIdentificationSource === 'Registry' ? 'shared.documentUpload.apeReadRegistry' : 'shared.documentUpload.apeReadDocument', {
            code: document.apeCode,
            energyClass: document.apeEnergyClass,
          })}
        </Alert>
        <ApeIdentificationForm propertyId={propertyId} document={document} onDone={onDone} cancelLabel={t('shared.documentUpload.apeLater')} />
        <Button type="button" className="w-full" onClick={onDone} data-testid="ape-saved-done">
          {t('shared.documentUpload.apeDone')}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4" data-testid="ape-saved">
      <Alert variant={outcome ? APE_CHECK_VARIANT[outcome] : 'success'} data-testid={`ape-check-${outcome ?? 'none'}`}>
        {outcome === 'Incomplete' && fields
          ? t('shared.documentUpload.apeCheck.Incomplete', { fields })
          : t(`shared.documentUpload.apeCheck.${outcome && outcome !== 'Incomplete' ? outcome : 'Saved'}`)}
      </Alert>
      <ApeIdentificationForm
        propertyId={propertyId}
        document={document}
        initiallyEditing
        onDone={onDone}
        cancelLabel={t('shared.documentUpload.apeLater')}
      />
    </div>
  );
}

export function DocumentUploadDialog({ propertyId, defaultDocumentType = 'CinCertificate', onlyType, open: openFromOutside, onOpenChange }: DocumentUploadDialogProps) {
  const { t } = useTranslation();
  const initialType = onlyType ?? defaultDocumentType;
  const [openHere, setOpenHere] = useState(false);
  const controlled = openFromOutside !== undefined;
  const open = controlled ? openFromOutside : openHere;
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOpenHere(next));
  const [selection, setSelection] = useState<DocumentSelection>(EMPTY_DOCUMENT);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [documentType, setDocumentType] = useState<PropertyDocumentType>(initialType);
  // The APE just stored: the dialog stays open on its code and class.
  const [savedApe, setSavedApe] = useState<PropertyDocumentDto | null>(null);

  const uploadMutation = useUploadPropertyDocument();
  const busy = preparing || uploadMutation.isPending;

  const documentTypes = getDocumentTypeLabels(t);

  const reset = useCallback(() => {
    setSelection(EMPTY_DOCUMENT);
    setError('');
    setDocumentType(initialType);
    setSavedApe(null);
  }, [initialType]);

  const close = () => {
    setOpen(false);
    reset();
  };

  const handleSubmit = async () => {
    if (!documentReady(selection)) return;
    setPreparing(true); setError('');
    try {
      const file = await prepareDocument(selection, 10 * 1024 * 1024);
      const document = await uploadMutation.mutateAsync({ propertyId, file, documentType });
      if (documentType === 'Ape' && document) {
        setSelection(EMPTY_DOCUMENT);
        setSavedApe(document);
      } else {
        close();
      }
    } catch (error) {
      // Said here too, not only in a toast: the person is looking at this window, and it keeps the pages chosen to try again.
      setError(
        error instanceof Error && error.message.startsWith('documentPages.')
          ? t(error.message)
          : getProblemMessage(error, t) ?? t('toast.documentUploadFailed'),
      );
    } finally { setPreparing(false); }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (next) setOpen(true);
        else close();
      }}
    >
      {controlled ? null : (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            {t('shared.documentUpload.uploadDocument')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {savedApe
              ? t('shared.documentUpload.apeDataTitle')
              : onlyType === 'Ape'
                ? t('shared.documentUpload.uploadApe')
                : t('shared.documentUpload.uploadDocument')}
          </DialogTitle>
          {savedApe ? (
            <DialogDescription>
              {/* "Type them as printed" only when something is left to type. */}
              {savedApe.apeCode && savedApe.apeEnergyClass
                ? t('shared.documentUpload.apeDataReadDescription')
                : t('shared.documentUpload.apeDataDescription')}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {savedApe ? (
          <ApeSaved propertyId={propertyId} document={savedApe} onDone={close} />
        ) : (
          <div className="space-y-4">
            {onlyType ? null : (
              <div className="space-y-2">
                <Label htmlFor="documentType">{t('shared.documentUpload.documentType')}</Label>
                <select
                  id="documentType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={documentType}
                  disabled={busy}
                  onChange={(e) => { setDocumentType(e.target.value as PropertyDocumentType); setSelection(EMPTY_DOCUMENT); }}
                >
                  {documentTypes.map((dt) => (
                    <option key={dt.value} value={dt.value}>
                      {dt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <DocumentPages
              value={selection}
              onChange={(next) => { setSelection(next); setError(''); }}
              disabled={busy}
              allowOffice={documentType !== 'Ape'}
              maxPdfMb={10}
            />
            {error ? <p role="alert" className="text-sm text-destructive" data-testid="document-upload-error">{error}</p> : null}
            {documentType === 'Ape' ? <p className="text-sm text-muted-foreground">{t('shared.documentUpload.apeScanNotice')}</p> : null}
            <Button
              className="w-full"
              disabled={!documentReady(selection) || busy}
              onClick={handleSubmit}
            >
              {busy ? t('shared.documentUpload.uploading') : t('shared.documentUpload.upload')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
