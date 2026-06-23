import { useCallback, useRef, useState } from 'react';
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
import { useUploadPropertyDocument } from '@/queries/use-properties';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png';

interface DocumentUploadDialogProps {
  propertyId: string;
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

export function DocumentUploadDialog({ propertyId }: DocumentUploadDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<PropertyDocumentType>('CinCertificate');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadPropertyDocument();

  const documentTypes = getDocumentTypeLabels(t);

  const reset = useCallback(() => {
    setFile(null);
    setDocumentType('CinCertificate');
    setDragOver(false);
  }, []);

  const handleFile = (selected: File | null) => {
    if (selected) setFile(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleSubmit = async () => {
    if (!file) return;
    try {
      await uploadMutation.mutateAsync({ propertyId, file, documentType });
      reset();
      setOpen(false);
    } catch {
      // Toast handled by mutation; keep dialog open
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          {t('shared.documentUpload.uploadDocument')}
        </Button>
      </DialogTrigger>
      <DialogContent>
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
              onChange={(e) => setDocumentType(e.target.value as PropertyDocumentType)}
            >
              {documentTypes.map((dt) => (
                <option key={dt.value} value={dt.value}>
                  {dt.label}
                </option>
              ))}
            </select>
          </div>
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {t('shared.documentUpload.dragDropText')}
            </p>
            <p className="text-xs text-muted-foreground">{t('shared.documentUpload.fileFormats')}</p>
            {file && <p className="text-sm font-medium">{file.name}</p>}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            className="w-full"
            disabled={!file || uploadMutation.isPending}
            onClick={handleSubmit}
          >
            {uploadMutation.isPending ? t('shared.documentUpload.uploading') : t('shared.documentUpload.upload')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
