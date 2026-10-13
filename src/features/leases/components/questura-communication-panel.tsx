import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Download, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { leasesApi } from '@/api/leases.api';
import { useDeclareQuesturaDeliveryDate, useRliChecklist } from '@/queries/use-leases';
import { getProblemMessage } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';
import { isStayDate } from '@/lib/stay-dates';
import {
  getQuesturaCommunicationState,
  QUESTURA_OFFICIAL_INFO_URL,
  QUESTURA_PANEL_ID,
  toDateOnly,
  type QuesturaCommunicationState,
} from '@/lib/questura-communication';
import { QuesturaCommunicationDialog } from './questura-communication-dialog';

interface QuesturaCommunicationPanelProps {
  leaseId: string;
  /** End of the lease (date-only value of the API): the delivery date cannot be later. */
  leaseEndDate: string;
}

const STATE_CLASS: Record<QuesturaCommunicationState, string> = {
  done: 'text-emerald-700 dark:text-emerald-400',
  todo: '',
  dueToday: 'font-semibold text-amber-700 dark:text-amber-400',
  overdue: 'font-semibold text-destructive',
};

const PENDING_STATUS_KEY: Record<Exclude<QuesturaCommunicationState, 'done'>, string> = {
  todo: 'leases.questura.statusTodo',
  dueToday: 'leases.questura.statusToday',
  overdue: 'leases.questura.statusOverdue',
};

/**
 * Communication to the public-security authority for an extra-EU tenant (art. 7 D.Lgs. 286/1998, LT-07, A7-08). The
 * API decides whether it applies (`questura` block of the RLI checklist) and computes the deadline: 48 hours from the
 * delivery of the property, the start date unless the landlord enters another one. CasaZen does not send it: the
 * landlord marks it as sent with its date (and optionally the receipt), and only then it counts as done.
 */
export function QuesturaCommunicationPanel({ leaseId, leaseEndDate }: QuesturaCommunicationPanelProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useRliChecklist(leaseId);
  const declareDelivery = useDeclareQuesturaDeliveryDate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Loaded without a Questura block: for the API no tenant is extra-EU (or the lease is rejected).
  if (data && !data.questura) return null;

  const questura = data?.questura ?? null;
  const endDate = toDateOnly(leaseEndDate);
  const deliveryValid = isStayDate(deliveryDate) && deliveryDate <= endDate;

  const startEditing = () => {
    if (!questura) return;
    setDeliveryDate(toDateOnly(questura.deliveryDate));
    setEditingDelivery(true);
  };

  const saveDelivery = (value: string | null) => {
    declareDelivery.mutate({ id: leaseId, deliveryDate: value }, { onSuccess: () => setEditingDelivery(false) });
  };

  const handleDownloadReceipt = async () => {
    setIsDownloading(true);
    try {
      const blob = await leasesApi.downloadQuesturaReceipt(leaseId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ricevuta-questura-${leaseId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      toast.error(getProblemMessage(downloadError, t) ?? t('leases.questura.receiptError'));
    } finally {
      setIsDownloading(false);
    }
  };

  const state = questura ? getQuesturaCommunicationState(questura) : null;

  return (
    <Card id={QUESTURA_PANEL_ID} data-testid="questura-panel">
      <CardHeader>
        <CardTitle>{t('leases.questura.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isLoading && <p>{t('leases.questura.loading')}</p>}
        {isError && (
          <p className="text-destructive" role="alert">
            {getProblemMessage(error, t) ?? t('leases.questura.error')}
          </p>
        )}
        {questura && state && (
          <>
            <p data-testid="questura-state" data-state={state} className={STATE_CLASS[state]}>
              {state === 'done' ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {t('leases.questura.statusDone', { date: formatDate(toDateOnly(questura.communicationDate!)) })}
                </span>
              ) : (
                t(PENDING_STATUS_KEY[state], { date: formatDate(toDateOnly(questura.deadline)) })
              )}
            </p>

            <div className="space-y-2">
              <p data-testid="questura-delivery-date">
                {t('leases.questura.deliveryDate', { date: formatDate(toDateOnly(questura.deliveryDate)) })}
              </p>
              {!questura.deliveryDateDeclared && (
                <p className="text-muted-foreground">{t('leases.questura.deliveryDateDefault')}</p>
              )}
              {state !== 'done' && !editingDelivery && (
                <Button type="button" variant="outline" size="sm" onClick={startEditing}>
                  {t('leases.questura.changeDeliveryDate')}
                </Button>
              )}
              {editingDelivery && (
                <div className="space-y-2 rounded-md border p-3" data-testid="questura-delivery-form">
                  <Label htmlFor={`questura-delivery-${leaseId}`}>{t('leases.questura.deliveryDateLabel')}</Label>
                  <Input
                    id={`questura-delivery-${leaseId}`}
                    type="date"
                    value={deliveryDate}
                    max={endDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                  {!deliveryValid && (
                    <p className="text-destructive" role="alert">
                      {t('leases.questura.deliveryDateInvalid', { end: formatDate(endDate) })}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!deliveryValid || declareDelivery.isPending}
                      onClick={() => saveDelivery(deliveryDate)}
                    >
                      {declareDelivery.isPending ? t('leases.questura.saving') : t('leases.questura.saveDeliveryDate')}
                    </Button>
                    {questura.deliveryDateDeclared && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={declareDelivery.isPending}
                        onClick={() => saveDelivery(null)}
                      >
                        {t('leases.questura.useStartDate')}
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingDelivery(false)}>
                      {t('leases.questura.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 text-muted-foreground" data-testid="questura-instructions">
              <p>{t('leases.questura.instructions')}</p>
              <p>{t('leases.questura.channel')}</p>
              <p>{t('leases.questura.sanction')}</p>
              <a
                href={QUESTURA_OFFICIAL_INFO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                {t('leases.questura.officialInfo')}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>

            {state === 'done' ? (
              questura.hasReceipt && (
                <Button type="button" variant="outline" disabled={isDownloading} onClick={handleDownloadReceipt}>
                  {isDownloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('leases.questura.downloading')}
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {t('leases.questura.downloadReceipt')}
                    </>
                  )}
                </Button>
              )
            ) : (
              <Button type="button" onClick={() => setDialogOpen(true)}>
                {t('leases.questura.markDone')}
              </Button>
            )}
          </>
        )}
      </CardContent>
      {questura && state !== 'done' && (
        <QuesturaCommunicationDialog leaseId={leaseId} open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </Card>
  );
}
