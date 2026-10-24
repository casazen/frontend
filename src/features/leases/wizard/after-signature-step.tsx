import { useState, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import { getQuesturaCommunicationState, toDateOnly } from '@/lib/questura-communication';
import { getRliRegistrationState } from '@/lib/rli-registration-state';
import { formatStayDate, parseStayDate, todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import { useExportRli, useRliAdvisory, useRliChecklist } from '@/queries/use-leases';
import { useRentLedger } from '@/queries/use-rent';
import type { CedolareAdvisory, LeaseDetail, QuesturaCommunicationStatus, RliChecklist } from '@/types';
import { ManualRegistrationDialog } from '../components/manual-registration-dialog';
import { QuesturaCommunicationPanel } from '../components/questura-communication-panel';
import { RentSchedulePanel } from '../components/rent-schedule-panel';
import { WIZARD_BUTTON } from './lease-wizard-frame';

type Panel = 'questura' | 'rent' | null;

const QUESTURA_STATUS_KEY = {
  done: 'leases.questura.statusDone',
  todo: 'leases.questura.statusTodo',
  dueToday: 'leases.questura.statusToday',
  overdue: 'leases.questura.statusOverdue',
} as const;

/** «Entro il 12 novembre 2026 · mancano 18 giorni»: the deadline is the server's, and so is the count of the days left. */
function registrationWhen(lease: LeaseDetail, checklist: RliChecklist | undefined, t: TFunction, language: string): string {
  const date = formatStayDate(parseStayDate(lease.registrationDeadline), language);
  if (!date) return t('leaseWizard.after.registration.whenUnknown');
  const days = checklist?.daysRemaining;
  if (days === null || days === undefined) return t('leaseWizard.after.registration.when', { date });
  if (days < 0) return t('leaseWizard.after.registration.whenOverdue', { date, count: -days });
  if (days === 0) return t('leaseWizard.after.registration.whenToday', { date });
  return t('leaseWizard.after.registration.whenLeft', { date, count: days });
}

/** What the registration costs, from the tax advice of the lease and told as an estimate; nothing when the advice is not there. */
function registrationCosts(advisory: CedolareAdvisory | undefined, t: TFunction): string | null {
  if (advisory?.taxRegime === 'CedolareSecca') return t('leaseWizard.after.registration.costs.cedolare');
  if (advisory?.taxRegime === 'Ordinario') {
    return t('leaseWizard.after.registration.costs.ordinary', { amount: formatCurrency(advisory.ordinary.registro.firstYearEur) });
  }
  return null;
}

function questuraStatus(questura: QuesturaCommunicationStatus, t: TFunction, language: string): string {
  const state = getQuesturaCommunicationState(questura);
  const date = formatStayDate(toDateOnly(state === 'done' ? (questura.communicationDate ?? questura.deadline) : questura.deadline), language);
  return t(QUESTURA_STATUS_KEY[state], { date });
}

function ActivityRow({
  title,
  status,
  actionLabel,
  onAction,
  testId,
}: {
  title: string;
  status: string;
  actionLabel: string;
  onAction: () => void;
  testId: string;
}) {
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid={testId}>
      <div className="min-w-0 space-y-0.5">
        <p className="break-words font-medium">{title}</p>
        <p className="break-words text-sm text-foreground/70">{status}</p>
      </div>
      <Button type="button" variant="outline" className={`${WIZARD_BUTTON} sm:shrink-0`} onClick={onAction}>
        {actionLabel}
      </Button>
    </li>
  );
}

/**
 * Step ⑧ «Dopo la firma» (LR-06b): the registration is the one block in evidence (the deadline and the days left, what it costs as an
 * estimate, the summary of the data to register with, and the declaration with the receipt); under it one row for each other thing
 * that comes with a signed contract: the keys and the Questura (an extra-EU tenant only) and the plan of the rents. The rows open the
 * panels the lease sheet already has. Everything is read from the lease: a signed lease is not a draft any more.
 */
export function AfterSignatureStep({ lease, declareFirst }: { lease: LeaseDetail; declareFirst: boolean }) {
  const { t, i18n } = useTranslation();
  const checklist = useRliChecklist(lease.id);
  const advisory = useRliAdvisory(lease.id);
  const ledger = useRentLedger(lease.id, lease.status);
  const exportRli = useExportRli();
  const registration = getRliRegistrationState(lease.status, lease.registration);
  const toRegister = registration === 'toRegister' || registration === 'failed';
  // The answer «già registrato» of the import opens the declaration at once, once the contract is in.
  const [declareOpen, setDeclareOpen] = useState(declareFirst && toRegister);
  const [panel, setPanel] = useState<Panel>(null);

  const questura = checklist.data?.questura ?? null;
  const schedule = ledger.data?.schedule ?? null;
  const nextRent = ledger.data?.installments.find((rent) => rent.status === 'Scheduled' || rent.status === 'Failed' || rent.status === 'Processing');
  const started = parseStayDate(lease.startDate) <= todayInRome();
  const costs = registrationCosts(advisory.data, t);

  const downloadSummary = async () => {
    try {
      saveBlobAs(await exportRli.mutateAsync(lease.id), `rli-prefill-${lease.id}.pdf`);
      toast.success(t('leases.rli.exportOk'));
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('leases.rli.exportError'));
    }
  };

  let registrationBlock: ReactNode = null;
  if (registration === 'registered') {
    const date = formatStayDate(parseStayDate(lease.registration?.registrationDate), i18n.language);
    const code = lease.registration?.registrationCode;
    registrationBlock = (
      <Alert variant="success" data-testid="lease-after-registered">
        {date && code ? t('leaseWizard.after.registration.registeredOn', { date, code }) : t('leaseWizard.after.registration.registered')}
      </Alert>
    );
  } else if (registration === 'inProgress') {
    registrationBlock = (
      <Alert variant="info" data-testid="lease-after-in-progress">
        {t('leases.rli.inProgressHint')}
      </Alert>
    );
  } else if (toRegister) {
    const daysLeft = checklist.data?.daysRemaining;
    registrationBlock = (
      <FocusBlock
        data-testid="lease-after-registration"
        tone={typeof daysLeft === 'number' && daysLeft < 0 ? 'danger' : 'neutral'}
        kicker={t('leaseWizard.after.registration.kicker')}
        title={t('leaseWizard.after.registration.title')}
        body={
          <>
            <p>{t('leaseWizard.after.registration.body')}</p>
            {costs ? (
              <p className="mt-2" data-testid="lease-after-costs">
                {costs}
              </p>
            ) : null}
          </>
        }
        who={t('leaseWizard.after.registration.who')}
        when={registrationWhen(lease, checklist.data, t, i18n.language)}
        primary={{ label: t('leaseWizard.after.registration.mark'), onClick: () => setDeclareOpen(true), testId: 'lease-after-mark-registered' }}
        secondary={{
          label: t('leaseWizard.after.registration.download'),
          onClick: () => void downloadSummary(),
          loading: exportRli.isPending,
          testId: 'lease-after-download-summary',
        }}
      />
    );
  }

  return (
    <div className="space-y-8" data-testid="lease-after-step">
      {registrationBlock}

      <PlainSection title={t('leaseWizard.after.rows.title')}>
        <ul role="list" className="divide-y divide-border">
          {questura ? (
            <ActivityRow
              testId="lease-after-row-questura"
              title={t('leaseWizard.after.rows.questura.title')}
              status={questuraStatus(questura, t, i18n.language)}
              actionLabel={t('leaseWizard.after.rows.open')}
              onAction={() => setPanel('questura')}
            />
          ) : null}
          <ActivityRow
            testId="lease-after-row-rent"
            title={t('leaseWizard.after.rows.rent.title')}
            status={
              schedule?.isActive
                ? [
                    t('rent.summary', { cadence: t(`rent.cadence.${schedule.cadence}`), amount: formatCurrency(schedule.amount, schedule.currency), day: schedule.billingDayOfMonth }),
                    nextRent
                      ? t('leaseWizard.after.rows.rent.next', {
                          amount: formatCurrency(nextRent.amount, nextRent.currency),
                          date: formatStayDate(parseStayDate(nextRent.dueDate), i18n.language),
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' ')
                : t(started ? 'leaseWizard.after.rows.rent.noneRunning' : 'leaseWizard.after.rows.rent.none')
            }
            actionLabel={t(schedule?.isActive ? 'leaseWizard.after.rows.rent.view' : 'leaseWizard.after.rows.rent.set')}
            onAction={() => setPanel('rent')}
          />
        </ul>
      </PlainSection>

      {/* Always mounted, not inside the blocks above: a window that lives in a branch is lost when the branch changes. */}
      <ManualRegistrationDialog leaseId={lease.id} open={declareOpen} onOpenChange={setDeclareOpen} />

      <Dialog open={panel === 'questura'} onOpenChange={(open) => !open && setPanel(null)}>
        <DialogContent className="sm:max-w-2xl" aria-describedby={undefined} data-testid="lease-after-questura-dialog">
          <DialogHeader>
            <DialogTitle>{t('leaseWizard.after.rows.questura.title')}</DialogTitle>
          </DialogHeader>
          <QuesturaCommunicationPanel leaseId={lease.id} leaseEndDate={lease.endDate} />
        </DialogContent>
      </Dialog>

      <Dialog open={panel === 'rent'} onOpenChange={(open) => !open && setPanel(null)}>
        <DialogContent className="sm:max-w-2xl" aria-describedby={undefined} data-testid="lease-after-rent-dialog">
          <DialogHeader>
            <DialogTitle>{t('leaseWizard.after.rows.rent.title')}</DialogTitle>
          </DialogHeader>
          <RentSchedulePanel
            leaseId={lease.id}
            leaseStatus={lease.status}
            term={{ startDate: lease.startDate, endDate: lease.endDate }}
            onConfigured={() => setPanel(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
