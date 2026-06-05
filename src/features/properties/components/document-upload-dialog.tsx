import { useCallback, useRef, useState } from 'react';
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

const DOCUMENT_TYPES: { value: PropertyDocumentType; label: string }[] = [
  { value: 'CinCertificate', label: 'Certificato CIN' },
  { value: 'FloorPlan', label: 'Planimetria' },
  { value: 'InsurancePolicy', label: 'Polizza assicurativa' },
  { value: 'PropertyLicense', label: 'Licenza struttura' },
  { value: 'SafetyCompliance', label: 'Conformità sicurezza' },
  { value: 'Ape', label: 'APE' },
  { value: 'Other', label: 'Altro' },
];

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png';

interface DocumentUploadDialogProps {
  propertyId: string;
}

export function DocumentUploadDialog({ propertyId }: DocumentUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<PropertyDocumentType>('CinCertificate');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadPropertyDocument();

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
          Carica documento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carica documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="documentType">Tipo documento</Label>
            <select
              id="documentType"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as PropertyDocumentType)}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
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
              Trascina un file qui o clicca per selezionare
            </p>
            <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG — max 10 MB</p>
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
            {uploadMutation.isPending ? 'Caricamento...' : 'Carica'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
