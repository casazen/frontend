import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSupplierInbox } from '@/queries/use-supplier';
import {
  useCompleteServiceRequest,
  useRejectServiceRequest,
  useTakeServiceRequest,
} from '@/queries/use-service-requests';
import type { ServiceRequestSummary } from '@/types/service-request';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function SupplierInboxPage() {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useSupplierInbox();
  const takeMutation = useTakeServiceRequest();
  const completeMutation = useCompleteServiceRequest();
  const rejectMutation = useRejectServiceRequest();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const items = (data?.items ?? []) as ServiceRequestSummary[];

  const handleReject = () => {
    if (!rejectId || !rejectReason.trim()) return;
    rejectMutation.mutate(
      { id: rejectId, reason: rejectReason },
      { onSuccess: () => { setRejectId(null); setRejectReason(''); refetch(); } },
    );
  };

  return (
    <div className="space-y-6" data-testid="supplier-inbox-page">
      <PageHeader
        title={t('supplier.inboxTitle')}
        description={t('supplier.inboxDescription')}
      />

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t('supplier.loading')}</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t('supplier.noAssignments')}</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} data-testid={`inbox-item-${item.id}`}>
              <CardContent className="py-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.propertyName}</span>
                  <Badge variant="secondary">{t(`serviceRequest.categories.${item.category}`, { defaultValue: item.category })}</Badge>
                  <Badge>{t(`serviceRequest.status.${item.status}`, { defaultValue: item.status })}</Badge>
                </div>
                {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                <div className="flex flex-wrap gap-2">
                  {item.status === 'Richiesto' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => takeMutation.mutate(item.id, { onSuccess: () => refetch() })}
                        disabled={takeMutation.isPending}
                        data-testid={`take-${item.id}`}
                      >
                        {t('serviceRequest.take')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectId(item.id)}
                        data-testid={`reject-${item.id}`}
                      >
                        {t('serviceRequest.reject')}
                      </Button>
                    </>
                  )}
                  {(item.status === 'PresoInCarico' || item.status === 'InCorso') && (
                    <Button
                      size="sm"
                      onClick={() => completeMutation.mutate({ id: item.id }, { onSuccess: () => refetch() })}
                      disabled={completeMutation.isPending}
                      data-testid={`complete-${item.id}`}
                    >
                      {t('serviceRequest.complete')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={rejectId !== null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('serviceRequest.rejectTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">{t('serviceRequest.rejectReason')}</Label>
            <Textarea id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>{t('booking.form.cancel')}</Button>
            <Button onClick={handleReject} disabled={!rejectReason.trim()}>{t('serviceRequest.reject')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}