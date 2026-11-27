import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCheck, CircleCheck, CircleX, Clock3, SlidersHorizontal, Wrench } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { canDecideMaintenance, canPayMaintenance, MAINTENANCE_STATUSES, type MaintenanceRequest, type MaintenanceRequestStatus } from './model';
import { useDecideMaintenanceRequest, useMaintenanceRequests, usePayMaintenanceRequest } from './use-maintenance-requests';

const STATUS_VIEW = {
  pending: { icon: Clock3, tone: 'bg-warning-soft text-warning-foreground' },
  approved: { icon: CircleCheck, tone: 'bg-info-soft text-info-foreground' },
  rejected: { icon: CircleX, tone: 'bg-danger-soft text-danger-foreground' },
  paid: { icon: CheckCheck, tone: 'bg-success-soft text-success-foreground' },
} as const;

export function LandlordMaintenanceList({ leaseId, heading = false }: { leaseId: string; heading?: boolean }) {
  const { t } = useTranslation();
  const list = useMaintenanceRequests(leaseId);
  const decide = useDecideMaintenanceRequest(leaseId);
  const pay = usePayMaintenanceRequest(leaseId);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [status, setStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
  const [reason, setReason] = useState('');

  if (list.isLoading) {
    return <p className="text-sm" data-testid="maintenance-loading">{t('maintenanceRequest.loading')}</p>;
  }
  if (list.isError) {
    return <ErrorState title={t('maintenanceRequest.loadError')} error={list.error} onRetry={() => void list.refetch()} testId="maintenance-error" />;
  }

  const items = list.data ?? [];
  const visible = status === 'all' ? items : items.filter(item => item.status === status);
  return (
    <div className="min-w-0 max-w-full space-y-4" data-testid="maintenance-landlord">
      {heading ? (
        <header className="min-w-0 space-y-2 border-b border-border pb-4">
          <Wrench aria-hidden="true" className="size-8 rounded-lg bg-primary-soft p-1.5 text-primary-text" />
          <h1 className="break-words text-2xl font-semibold tracking-tight">{t('maintenanceRequest.landlord.title')}</h1>
          <p className="text-sm leading-6 text-foreground/70">{t('maintenanceRequest.landlord.hint')}</p>
        </header>
      ) : null}
      {items.length === 0 ? <p className="text-sm text-foreground/70">{t('maintenanceRequest.landlord.empty')}</p> : null}
      {(items.length > 1 || status !== 'all') && (
        <label className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-medium">
          <SlidersHorizontal className="size-4 text-primary-text" aria-hidden="true" />
          {t('longRentRequests.list.columns.status')}
          <Select wrapperClassName="w-auto max-w-full" value={status} onChange={event => {
            const next = MAINTENANCE_STATUSES.find(value => value === event.target.value);
            setStatus(next ?? 'all');
          }}>
            <option value="all">{t('longRentRequests.list.tabs.all')}</option>
            {MAINTENANCE_STATUSES.map(value => <option key={value} value={value}>{t(`maintenanceRequest.status.${value}`)}</option>)}
          </Select>
        </label>
      )}
      {items.length > 0 && visible.length === 0 && <p role="status">{t('longRentRequests.list.noResults.title')}</p>}
      <ul className="grid min-w-0 gap-4 xl:grid-cols-2">
        {visible.map((request) => (
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
                decide.mutate({ requestId: request.id, decision: { decision: 'Approved' } });
              }}
              onReject={() => {
                const text = reason.trim();
                if (!text) return;
                decide.mutate(
                  { requestId: request.id, decision: { decision: 'Rejected', reason: text } },
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

export function LandlordMaintenancePage() {
  const { id = '' } = useParams();
  return <LandlordMaintenanceList leaseId={id} heading />;
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
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const rejectButton = useRef<HTMLButtonElement>(null);
  const wasRejecting = useRef(false);
  useEffect(() => {
    if (rejecting) reasonField.current?.focus();
    else if (wasRejecting.current) rejectButton.current?.focus();
    wasRejecting.current = rejecting;
  }, [rejecting]);

  const statusView = STATUS_VIEW[request.status];
  const StatusIcon = statusView.icon;
  const pending = canDecideMaintenance('landlord', request.status);
  const payable = canPayMaintenance('landlord', request.status);

  return (
    <article className="min-w-0 h-full max-w-full rounded-2xl border border-border bg-card p-4 sm:p-5" data-testid={`maintenance-request-${request.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 break-words text-lg font-semibold">{request.what}</h3>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusView.tone}`} data-testid="maintenance-status">
          <StatusIcon aria-hidden="true" className="size-4" />{t(`maintenanceRequest.status.${request.status}`)}
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground/80">{t(`maintenanceRequest.urgency.${request.urgency}`)}</p>
      {request.note ? <p className="mt-2 break-words text-sm">{request.note}</p> : null}
      {request.photoName ? (
        <p className="mt-2 flex items-center gap-2 break-words text-sm text-foreground/70"><Camera aria-hidden="true" className="size-4 shrink-0" />{t('maintenanceRequest.landlord.photo', { name: request.photoName })}</p>
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
        <div className="mt-4 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
          <Button type="button" block size="lg" className="min-h-12" disabled={busy} onClick={onApprove} data-testid="maintenance-approve">
            {t('maintenanceRequest.landlord.approve')}
          </Button>
          <Button type="button" variant="outline" block size="lg" className="min-h-12" disabled={busy} ref={rejectButton} onClick={onStartReject} data-testid="maintenance-reject">
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
            ref={reasonField}
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
