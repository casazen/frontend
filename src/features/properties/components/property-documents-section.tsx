import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PropertyDocumentDto } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { Download, FileText, Trash2 } from 'lucide-react';
import { DocumentUploadDialog } from './document-upload-dialog';
import { useDeletePropertyDocument } from '@/queries/use-properties';

interface PropertyDocumentsSectionProps {
  propertyId: string;
  documents: PropertyDocumentDto[];
}

export function PropertyDocumentsSection({ propertyId, documents }: PropertyDocumentsSectionProps) {
  const deleteMutation = useDeletePropertyDocument();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Documenti</CardTitle>
        <DocumentUploadDialog propertyId={propertyId} />
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun documento caricato.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.fileType.toUpperCase()} · {formatDateTime(doc.uploadedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" asChild>
                    <a href={doc.downloadUrl} download={doc.fileName} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Scarica</span>
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate({ propertyId, docId: doc.id })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="sr-only">Elimina</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
