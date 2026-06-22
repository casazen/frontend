import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { useSupplierInbox } from '@/queries/use-supplier';

export function SupplierInboxPage() {
  const { data, isLoading } = useSupplierInbox();

  return (
    <div className="space-y-6" data-testid="supplier-inbox-page">
      <PageHeader
        title="Inbox incarichi"
        description="Richieste di servizio dai host (disponibile dalla wave 2 marketplace)"
      />

      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {isLoading ? 'Caricamento...' : data?.total === 0 ? 'Nessun incarico aperto' : `${data?.total} incarichi`}
        </CardContent>
      </Card>
    </div>
  );
}
