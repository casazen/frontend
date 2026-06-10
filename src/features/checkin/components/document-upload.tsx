import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Upload } from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

interface DocumentUploadProps {
  onUpload: (file: File) => Promise<void>;
  existingUrl?: string | null;
  isUploading?: boolean;
}

export function DocumentUpload({ onUpload, existingUrl, isUploading }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato non supportato. Usa JPG, PNG, WebP o PDF.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Il file supera la dimensione massima di 5 MB.');
      return;
    }

    await onUpload(file);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4" data-testid="document-upload">
      <div>
        <Label htmlFor="documentScan">Documento d&apos;identità</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Carica una scansione o foto del documento (max 5 MB).
        </p>
      </div>

      {existingUrl && (
        <p className="text-sm text-green-700" data-testid="document-upload-success">
          Documento già caricato.
        </p>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          id="documentScan"
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={handleFileChange}
          data-testid="document-upload-input"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {isUploading ? 'Caricamento…' : 'Seleziona file'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
