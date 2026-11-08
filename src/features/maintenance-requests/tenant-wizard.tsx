import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  MAINTENANCE_URGENCIES,
  type MaintenanceRequest,
  type MaintenanceUrgency,
} from './model';
import { useCreateMaintenanceRequest, useMaintenanceRequests } from './use-maintenance-requests';

const STEPS = ['what', 'urgency', 'note', 'photo', 'confirm'] as const;
type WizardStep = (typeof STEPS)[number];
type Phase = 'browse' | 'wizard' | 'sent';

/**
 * Phone wizard for the tenant: what is broken, how urgent, a note, an optional photo, then a clear confirm.
 * After send the request is "In attesa". This screen never approves and never pays.
 */
export function TenantMaintenanceRequestPage() {
  const { t } = useTranslation();
  const { leaseId = '' } = useParams();
  const list = useMaintenanceRequests(leaseId);
  const create = useCreateMaintenanceRequest(leaseId);
  const [phase, setPhase] = useState<Phase>('browse');
  const [step, setStep] = useState<WizardStep>('what');
  const [what, setWhat] = useState('');
  const [urgency, setUrgency] = useState<MaintenanceUrgency | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [sent, setSent] = useState<MaintenanceRequest | null>(null);

  const items = list.data ?? [];
  const writing = phase === 'wizard' || (phase === 'browse' && !list.isLoading && !list.isError && items.length === 0);

  function begin() {
    setWhat('');
    setUrgency(null);
    setNote('');
    setPhoto(null);
    setSent(null);
    setStep('what');
    setPhase('wizard');
  }

  if (list.isLoading && phase === 'browse') {
    return <p className="px-4 py-6 text-sm" data-testid="maintenance-loading">{t('maintenanceRequest.loading')}</p>;
  }
  if (list.isError && phase === 'browse') {
    return (
      <div className="px-4 py-6">
        <ErrorState title={t('maintenanceRequest.loadError')} error={list.error} onRetry={() => void list.refetch()} testId="maintenance-error" />
      </div>
    );
  }

  if (phase === 'sent' && sent) {
    return (
      <WizardFrame>
        <div data-testid="maintenance-waiting" role="status" className="min-w-0 space-y-3">
          <p className="text-sm text-foreground/70">{t('maintenanceRequest.waiting.kicker')}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{t('maintenanceRequest.waiting.title')}</h1>
          <p className="text-sm leading-6" data-testid="maintenance-tenant-status">{t('maintenanceRequest.status.pending')}</p>
          <p className="text-sm leading-6 text-foreground/80">{t('maintenanceRequest.waiting.body')}</p>
          <p className="break-words font-medium">{sent.what}</p>
        </div>
        <div className="sticky bottom-0 mt-8 bg-background py-3">
          <Button type="button" variant="outline" block size="lg" className="min-h-12" onClick={() => setPhase('browse')} data-testid="maintenance-see-requests">
            {t('maintenanceRequest.waiting.list')}
          </Button>
        </div>
      </WizardFrame>
    );
  }

  if (!writing) {
    return (
      <WizardFrame>
        <h1 className="text-2xl font-semibold tracking-tight">{t('maintenanceRequest.list.title')}</h1>
        <ul className="mt-4 min-w-0 space-y-3">
          {items.map((request) => (
            <li key={request.id} className="min-w-0 rounded-xl border border-border p-4" data-testid={`maintenance-tenant-request-${request.id}`}>
              <p className="break-words font-medium">{request.what}</p>
              <p className="mt-1 text-sm" data-testid="maintenance-tenant-status">{t(`maintenanceRequest.status.${request.status}`)}</p>
              {request.status === 'rejected' && request.reason ? (
                <p className="mt-2 break-words text-sm" data-testid="maintenance-reason">{request.reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="sticky bottom-0 mt-6 bg-background py-3">
          <Button type="button" block size="lg" className="min-h-12" onClick={begin} data-testid="maintenance-new">
            {t('maintenanceRequest.list.new')}
          </Button>
        </div>
      </WizardFrame>
    );
  }

  const index = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  const back = () => setStep(STEPS[Math.max(index - 1, 0)]);

  return (
    <WizardFrame>
      <p className="text-sm text-foreground/70">{t('maintenanceRequest.stepOf', { current: index + 1, total: STEPS.length })}</p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
      </div>
      <form
        className="mt-6 flex min-w-0 flex-1 flex-col"
        data-testid={`maintenance-step-${step}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (step === 'what' && what.trim() === '') return;
          if (step === 'urgency' && !urgency) return;
          if (step === 'note' && note.trim() === '') return;
          if (step !== 'confirm') {
            next();
            return;
          }
          if (!urgency || create.isPending) return;
          create.mutate(
            { what: what.trim(), urgency, note: note.trim(), photo },
            {
              onSuccess: (request) => {
                setSent(request);
                setPhase('sent');
              },
            },
          );
        }}
      >
        {step === 'what' ? (
          <div className="min-w-0 space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t('maintenanceRequest.what.title')}</h1>
            <p className="text-sm leading-6 text-foreground/70">{t('maintenanceRequest.what.hint')}</p>
            <Label htmlFor="maintenance-what">{t('maintenanceRequest.what.label')}</Label>
            <Input
              id="maintenance-what"
              value={what}
              onChange={(event) => setWhat(event.target.value)}
              placeholder={t('maintenanceRequest.what.placeholder')}
              autoComplete="off"
              className="min-h-12 w-full max-w-full"
              data-testid="maintenance-what"
            />
          </div>
        ) : null}
        {step === 'urgency' ? (
          <div className="min-w-0 space-y-3">
            <h1 id="maintenance-urgency-title" className="text-2xl font-semibold tracking-tight">{t('maintenanceRequest.urgency.title')}</h1>
            <p className="text-sm leading-6 text-foreground/70">{t('maintenanceRequest.urgency.hint')}</p>
            <div className="space-y-2" role="radiogroup" aria-labelledby="maintenance-urgency-title">
              {MAINTENANCE_URGENCIES.map((value) => (
                <label
                  key={value}
                  data-testid={`maintenance-urgency-${value}`}
                  className={cn(
                    'flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-4',
                    urgency === value ? 'border-primary ring-2 ring-primary' : 'border-border',
                  )}
                >
                  <input
                    type="radio"
                    name="maintenance-urgency"
                    value={value}
                    checked={urgency === value}
                    onChange={() => setUrgency(value)}
                    className="mt-1 size-4 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{t(`maintenanceRequest.urgency.${value}`)}</span>
                    <span className="block text-sm text-foreground/70">{t(`maintenanceRequest.urgency.detail.${value}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {step === 'note' ? (
          <div className="min-w-0 space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t('maintenanceRequest.note.title')}</h1>
            <p className="text-sm leading-6 text-foreground/70">{t('maintenanceRequest.note.hint')}</p>
            <Label htmlFor="maintenance-note">{t('maintenanceRequest.note.label')}</Label>
            <Textarea
              id="maintenance-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('maintenanceRequest.note.placeholder')}
              className="min-h-28 w-full max-w-full"
              data-testid="maintenance-note"
            />
          </div>
        ) : null}
        {step === 'photo' ? (
          <div className="min-w-0 space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t('maintenanceRequest.photo.title')}</h1>
            <p className="text-sm leading-6 text-foreground/70">{t('maintenanceRequest.photo.hint')}</p>
            <Label htmlFor="maintenance-photo">{t('maintenanceRequest.photo.label')}</Label>
            <Input
              id="maintenance-photo"
              type="file"
              accept="image/*"
              className="w-full max-w-full"
              data-testid="maintenance-photo"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            />
            <p className="break-words text-sm" data-testid="maintenance-photo-name">
              {photo ? t('maintenanceRequest.photo.chosen', { name: photo.name }) : t('maintenanceRequest.photo.none')}
            </p>
          </div>
        ) : null}
        {step === 'confirm' && urgency ? (
          <div className="min-w-0 space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t('maintenanceRequest.confirm.title')}</h1>
            <p className="text-sm leading-6 text-foreground/70">{t('maintenanceRequest.confirm.hint')}</p>
            <dl className="min-w-0 space-y-3 rounded-xl border border-border p-4 text-sm">
              <div>
                <dt className="text-foreground/70">{t('maintenanceRequest.confirm.what')}</dt>
                <dd className="break-words font-medium" data-testid="maintenance-confirm-what">{what.trim()}</dd>
              </div>
              <div>
                <dt className="text-foreground/70">{t('maintenanceRequest.confirm.urgency')}</dt>
                <dd className="font-medium" data-testid="maintenance-confirm-urgency">{t(`maintenanceRequest.urgency.${urgency}`)}</dd>
              </div>
              <div>
                <dt className="text-foreground/70">{t('maintenanceRequest.confirm.note')}</dt>
                <dd className="break-words font-medium" data-testid="maintenance-confirm-note">{note.trim()}</dd>
              </div>
              <div>
                <dt className="text-foreground/70">{t('maintenanceRequest.confirm.photo')}</dt>
                <dd className="break-words font-medium" data-testid="maintenance-confirm-photo">
                  {photo ? photo.name : t('maintenanceRequest.photo.none')}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
        <div className="sticky bottom-0 mt-auto space-y-2 bg-background py-3">
          <Button
            type="submit"
            block
            size="lg"
            className="min-h-12"
            loading={step === 'confirm' && create.isPending}
            disabled={
              (step === 'what' && what.trim() === '') ||
              (step === 'urgency' && !urgency) ||
              (step === 'note' && note.trim() === '') ||
              (step === 'confirm' && create.isPending)
            }
            data-testid={step === 'confirm' ? 'maintenance-submit' : 'maintenance-next'}
          >
            {step === 'confirm' ? t('maintenanceRequest.confirm.submit') : t('maintenanceRequest.next')}
          </Button>
          {index > 0 ? (
            <Button type="button" variant="ghost" block className="min-h-11" onClick={back} data-testid="maintenance-back">
              {t('maintenanceRequest.back')}
            </Button>
          ) : null}
        </div>
      </form>
    </WizardFrame>
  );
}

function WizardFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col overflow-x-hidden bg-background px-4 pt-6" data-testid="maintenance-wizard">
      {children}
    </div>
  );
}
