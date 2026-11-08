import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { canDecideMaintenance, canPayMaintenance, type MaintenanceRequest } from './model';
import { useDecideMaintenanceRequest, useMaintenanceRequests, usePayMaintenanceRequest } from './use-maintenance-requests';

/**
 * The landlord or the agency reads each request, approves or rejects it with a reason, and pays only after approval.
 * A pending request has no pay button. A rejection shows why, in Italian.
 */
export function LandlordMaintenancePage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const list = useMaintenanceRequests(id);
  const decide = useDecideMaintenanceRequest(id);
  const pay = usePayMaintenanceRequest(id);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (list.isLoading) {
    return <p className="text-sm" data-testid="maintenance-loading">{t('maintenanceRequest.loading')}</p>;
  }
  if (list.isError) {
    return <ErrorState title={t('maintenanceRequest.loadError')} error={list.error} onRetry={() => void list.refetch()} testId="maintenance-error" />;
  }

  const items = list.data ?? [];
  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden" data-testid="maintenance-landlord">
      <header className="min-w-0 space-y-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{t('maintenanceRequest.landlord.title')}</h1>
        <p className="text-sm leading-6 text-foreground/70">{t('maintenanceRequest.landlord.hint')}</p>
      </header>
      {items.length === 0 ? <p className="text-sm text-foreground/70">{t('maintenanceRequest.landlord.empty')}</p> : null}
      <ul className="min-w-0 space-y-3">
        {items.map((request) => (
          <li key={request.id}>
            <RequestCard
              request={request}
              rejecting={rejectingId === request.id}
              reason={rejectingId === request.id ? reason : ''}
              busy={decide.isPending || pay.isPending}
              onReason={setReason}
              onStartReject={() => {
                setRejectingId(request.id);
                setReason('');
              }}
              onCancelReject={() => {
                setRejectingId(null);
                setReason('');
              }}
              onApprove={() => {
                setRejectingId(null);
                decide.mutate({ requestId: request.id, decision: { decision: 'approved' } });
              }}
              onReject={() => {
                const text = reason.trim();
                if (!text) return;
                decide.mutate(
                  { requestId: request.id, decision: { decision: 'rejected', reason: text } },
                  {
                    onSuccess: () => {
                      setRejectingId(null);
                      setReason('');
                    },
                  },
                );
              }}
              onPay={() => pay.mutate(request.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequestCard({
  request,
  rejecting,
  reason,
  busy,
  onReason,
  onStartReject,
  onCancelReject,
  onApprove,
  onReject,
  onPay,
}: {
  request: MaintenanceRequest;
  rejecting: boolean;
  reason: string;
  busy: boolean;
  onReason: (value: string) => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onApprove: () => void;
  onReject: () => void;
  onPay: () => void;
}) {
  const { t } = useTranslation();
  const pending = canDecideMaintenance('landlord', request.status);
  const payable = canPayMaintenance('landlord', request.status);

  return (
    <article className="min-w-0 max-w-full rounded-xl border border-border p-4" data-testid={`maintenance-request-${request.id}`}>
      <p className="break-words text-base font-medium">{request.what}</p>
      <p className="mt-1 text-sm" data-testid="maintenance-status">{t(`maintenanceRequest.status.${request.status}`)}</p>
      <p className="mt-2 text-sm text-foreground/80">{t(`maintenanceRequest.urgency.${request.urgency}`)}</p>
      {request.note ? <p className="mt-2 break-words text-sm">{request.note}</p> : null}
      {request.photoName ? (
        <p className="mt-2 break-words text-sm text-foreground/70">{t('maintenanceRequest.landlord.photo', { name: request.photoName })}</p>
      ) : null}
      {request.status === 'rejected' && request.reason ? (
        <p className="mt-3 break-words text-sm" data-testid="maintenance-reason">
          {t('maintenanceRequest.landlord.rejectedNote', { reason: request.reason })}
        </p>
      ) : null}
      {request.status === 'pending' ? <p className="mt-3 text-sm text-foreground/70">{t('maintenanceRequest.landlord.pendingNote')}</p> : null}
      {request.status === 'approved' ? <p className="mt-3 text-sm">{t('maintenanceRequest.landlord.approvedNote')}</p> : null}
      {request.status === 'paid' ? <p className="mt-3 text-sm">{t('maintenanceRequest.landlord.paidNote')}</p> : null}
      {pending && !rejecting ? (
        <div className="mt-4 flex flex-col gap-2">
          <Button type="button" block size="lg" className="min-h-12" disabled={busy} onClick={onApprove} data-testid="maintenance-approve">
            {t('maintenanceRequest.landlord.approve')}
          </Button>
          <Button type="button" variant="outline" block size="lg" className="min-h-12" disabled={busy} onClick={onStartReject} data-testid="maintenance-reject">
            {t('maintenanceRequest.landlord.reject')}
          </Button>
        </div>
      ) : null}
      {pending && rejecting ? (
        <form
          className="mt-4 min-w-0 space-y-2"
          data-testid="maintenance-reject-form"
          onSubmit={(event) => {
            event.preventDefault();
            onReject();
          }}
        >
          <Label htmlFor={`maintenance-reject-reason-${request.id}`}>{t('maintenanceRequest.landlord.reasonLabel')}</Label>
          <Textarea
            id={`maintenance-reject-reason-${request.id}`}
            value={reason}
            onChange={(event) => onReason(event.target.value)}
            placeholder={t('maintenanceRequest.landlord.reasonPlaceholder')}
            className="min-h-24 w-full max-w-full"
            data-testid="maintenance-reject-reason"
          />
          <Button type="submit" variant="destructive" block size="lg" className="min-h-12" disabled={busy || reason.trim() === ''} data-testid="maintenance-reject-confirm">
            {t('maintenanceRequest.landlord.confirmReject')}
          </Button>
          <Button type="button" variant="ghost" block className="min-h-11" onClick={onCancelReject}>
            {t('maintenanceRequest.landlord.cancelReject')}
          </Button>
        </form>
      ) : null}
      {payable ? (
        <div className="mt-4">
          <Button type="button" block size="lg" className="min-h-12" disabled={busy} onClick={onPay} data-testid="maintenance-pay">
            {t('maintenanceRequest.landlord.pay')}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
