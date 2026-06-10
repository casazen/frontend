import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { formatDate } from '@/lib/utils';
import {
  useCheckInContext,
  useSubmitGuestCheckIn,
  useUploadCheckInDocument,
} from '@/queries/use-checkin';
import { GuestDataForm } from './components/guest-data-form';
import { DocumentUpload } from './components/document-upload';
import type { GuestCheckInFormValues } from './schemas/checkin.schema';
import { CheckCircle2 } from 'lucide-react';

export function CheckInPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { data: context, isLoading, isError } = useCheckInContext(token);
  const submitGuestData = useSubmitGuestCheckIn(token);
  const uploadDocument = useUploadCheckInDocument(token);

  const handleSubmit = async (values: GuestCheckInFormValues) => {
    await submitGuestData.mutateAsync({
      ...values,
      documentExpiryDate: values.documentExpiryDate || null,
      address: values.address ?? '',
      city: values.city ?? '',
      postalCode: values.postalCode ?? '',
      country: values.country ?? '',
    });
  };

  if (isLoading) {
    return <LoadingScreen message="Caricamento check-in…" />;
  }

  if (isError || !context) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Link non valido</CardTitle>
            <CardDescription>
              Il link di check-in non è valido o è scaduto. Contatta il gestore della struttura.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4" data-testid="checkin-page">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Check-in ospite</h1>
          <p className="text-muted-foreground">{context.propertyName}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(context.checkInDate)} – {formatDate(context.checkOutDate)}
          </p>
        </div>

        {context.dataComplete && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800" data-testid="checkin-complete-banner">
                Check-in completato. Grazie!
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dati anagrafici</CardTitle>
            <CardDescription>
              Compila i campi richiesti dalla normativa Alloggiati Web (Art. 109 TULPS).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuestDataForm
              guest={context.guest}
              onSubmit={handleSubmit}
              isSubmitting={submitGuestData.isPending}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documento</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUpload
              existingUrl={context.guest.documentScanUrl}
              onUpload={async (file) => {
                await uploadDocument.mutateAsync(file);
              }}
              isUploading={uploadDocument.isPending}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
