import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, CalendarClock, FileCheck2, FileText, KeyRound, Wallet, type LucideIcon } from 'lucide-react';
import { propertiesApi } from '@/api/properties.api';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { latestApeDocument } from '@/lib/ape-documents';
import { toDateOnly } from '@/lib/questura-communication';
import { getRliRegistrationState } from '@/lib/rli-registration-state';
import { formatStayDate, parseStayDate, todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import { useLeaseDocuments } from '@/queries/use-lease-documents';
import { useRliChecklist } from '@/queries/use-leases';
import { useRentLedger } from '@/queries/use-rent';
import type { LeaseDetail, LongRentRules, RentLedger, RliChecklist } from '@/types';
import { leasePropertyLine } from '../lib/lease-list-format';
import { isConcordatoLease, newestDocument, showsBenefits } from '../lib/lease-benefits';
import { ManualRegistrationDialog } from '../components/manual-registration-dialog';
import { RegisteredBenefits } from '../components/registered-benefits';
import { addMonths } from './wizard-model';

const LEASES_PATH = '/app/long-rent/leases';

interface Row {
  text: string;
  icon: LucideIcon;
}

interface RowsInput {
  lease: LeaseDetail;
  checklist: RliChecklist | undefined;
  ledger: RentLedger | undefined;
  rules: LongRentRules | undefined;
  apeMissing: boolean;
  /** A canone concordato not registered yet whose attestation is not among its documents: told as a thing left to do (once it is registered the benefits block tells it). */
  attestationMissing: boolean;
  t: TFunction;
  language: string;
}

/** «tra 18 giorni», «oggi», «scaduta da 3 giorni»: the days left to the deadline, as the server counts them. */
function dueText(days: number | null | undefined, t: TFunction): string {
  if (days === null || days === undefined) return '';
  if (days < 0) return t('leaseWizard.done.due.overdue', { count: -days });
  if (days === 0) return t('leaseWizard.done.due.today');
  return t('leaseWizard.done.due.inDays', { count: days });
}

/** «4 anni», «30 mesi»: a length of months as people say it. */
function lengthText(months: number, t: TFunction): string {
  return months % 12 === 0 ? t('leaseWizard.dates.years', { count: months / 12 }) : t('leaseWizard.dates.months', { count: months });
}

/**
 * Who does what now, in a few rows, with the dates and the amounts the server gives: the deadline of the registration, the first rent,
 * the end of the period and the last day for the notice. The only figures the interface works out are the last day for the notice and
 * the length of a renewal, from the months the server states (`rules`): nothing of law is written here.
 */
function doneRows({ lease, checklist, ledger, rules, apeMissing, attestationMissing, t, language }: RowsInput): Row[] {
  const day = (value: string | null | undefined) => formatStayDate(parseStayDate(value), language);
  const rows: Row[] = [];
  const registration = getRliRegistrationState(lease.status, lease.registration);

  if (registration === 'registered') {
    const date = day(lease.registration?.registrationDate);
    rows.push({ text: date ? t('leaseWizard.done.registered', { date }) : t('leaseWizard.done.registeredNoDate'), icon: FileCheck2 });
  } else if (registration === 'inProgress') {
    rows.push({ text: t('leases.rli.inProgressHint'), icon: FileCheck2 });
  } else if (lease.isConcordatoFacileSource === true) {
    // A contract the guided service prepared is registered by the service (CF-END): what is left to the person is the declaration.
    const deadline = day(lease.registrationDeadline);
    rows.push({ text: deadline ? t('leaseRound.service.row', { date: deadline }) : t('leaseRound.service.rowUnknown'), icon: FileCheck2 });
  } else {
    const deadline = day(lease.registrationDeadline);
    const when = dueText(checklist?.daysRemaining, t);
    rows.push({
      text: !deadline
        ? t('leaseWizard.done.registerUnknown')
        : when
          ? t('leaseWizard.done.register', { date: deadline, when })
          : t('leaseWizard.done.registerNoWhen', { date: deadline }),
      icon: FileCheck2,
    });
  }

  if (attestationMissing) rows.push({ text: t('leaseRound.attestation.doneRow'), icon: FileText });

  const questura = checklist?.questura;
  if (questura) {
    rows.push({
      text: questura.communicationDate
        ? t('leaseWizard.done.questuraDone', { date: day(questura.communicationDate) })
        : t('leaseWizard.done.questura', { date: formatStayDate(toDateOnly(questura.deadline), language) }),
      icon: KeyRound,
    });
  }

  const nextRent = ledger?.schedule?.isActive ? ledger.installments.find((rent) => rent.status === 'Scheduled' || rent.status === 'Failed') : undefined;
  rows.push({
    text: nextRent
      ? t('leaseWizard.done.rentFirst', { amount: formatCurrency(nextRent.amount, nextRent.currency), date: day(nextRent.dueDate) })
      : t('leaseWizard.done.rentNone'),
    icon: Wallet,
  });

  const end = parseStayDate(lease.endDate);
  const today = todayInRome();
  if (end) {
    rows.push(
      end < today
        ? { text: t('leaseWizard.done.endPast', { date: day(end) }), icon: CalendarClock }
        : { text: t('leaseWizard.done.end', { date: day(end) }), icon: CalendarClock },
    );
    const renewal = rules?.renewalMonths[lease.contractType];
    if (rules && renewal && end >= today) {
      const notice = addMonths(end, -rules.noticeMonths);
      rows.push({
        text:
          notice >= today
            ? t('leaseWizard.done.notice', { date: day(notice), length: lengthText(renewal, t) })
            : t('leaseWizard.done.renews', { length: lengthText(renewal, t) }),
        icon: CalendarCheck,
      });
    }
  }

  if (apeMissing) rows.push({ text: t('leaseWizard.done.apeMissing'), icon: FileText });
  return rows;
}

/**
 * The last screen of «Crea contratto» (LR-06b): «Cosa succede ora». One screen for every contract, whose rows follow what is true of
 * it (registered or not, a tenant that needs the Questura, a rent plan or none, a contract that is already over). A contract brought
 * in and not registered says so, with the button to declare the registration, so a registration that failed is never lost. A registered
 * canone concordato has, between the rows and the buttons, the follow-up of its registration (`RegisteredBenefits`, CF-END).
 */
export function LeaseDone({ lease, rules }: { lease: LeaseDetail; rules: LongRentRules | undefined }) {
  const { t, i18n } = useTranslation();
  const imported = lease.origin === 'Imported';
  const checklist = useRliChecklist(lease.id);
  const ledger = useRentLedger(lease.id, lease.status);
  // A contract brought in may have no APE: it is a thing to do, never a stop (the property is read as the first step reads it).
  const documents = useQuery({
    queryKey: ['properties', lease.propertyId, 'documents'],
    queryFn: () => propertiesApi.getDocuments(lease.propertyId),
    enabled: imported,
  });
  // A canone concordato asks for its attestation: not registered yet, a missing one is a row of what is left to do; registered, the
  // follow-up block below tells it (and reads the documents itself).
  const concordato = isConcordatoLease(lease);
  const benefits = showsBenefits(lease);
  const leaseDocuments = useLeaseDocuments(lease.id, concordato && !benefits);
  const [declareOpen, setDeclareOpen] = useState(false);

  if (checklist.isLoading || ledger.isLoading) return <LoadingScreen message={t('leases.detailLoading')} className="h-auto flex-1" />;

  const registration = getRliRegistrationState(lease.status, lease.registration);
  const rows = doneRows({
    lease,
    checklist: checklist.data,
    ledger: ledger.data,
    rules,
    apeMissing: imported && documents.isSuccess && !latestApeDocument(documents.data),
    attestationMissing: concordato && !benefits && leaseDocuments.isSuccess && !newestDocument(leaseDocuments.data, 'Attestation'),
    t,
    language: i18n.language,
  });

  return (
    <div className="space-y-6" data-testid="lease-done">
      {imported && (registration === 'toRegister' || registration === 'failed') ? (
        <Alert
          variant="warning"
          title={t('leaseWizard.done.notRegistered.title')}
          className="mx-auto max-w-xl"
          data-testid="lease-done-not-registered"
          action={
            <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => setDeclareOpen(true)} data-testid="lease-done-declare">
              {t('leaseWizard.done.notRegistered.action')}
            </Button>
          }
        >
          {lease.isConcordatoFacileSource === true ? t('leaseRound.service.doneText') : t('leaseWizard.done.notRegistered.text')}
        </Alert>
      ) : null}

      <WizardDone
        title={t(`leaseWizard.done.title.${imported ? 'Imported' : 'Created'}`)}
        description={leasePropertyLine(lease, t)}
        whatNext={rows}
        primary={{ label: t('leaseWizard.goToLease'), to: `${LEASES_PATH}/${lease.id}` }}
        secondary={{ label: t('leaseWizard.done.another'), to: `${LEASES_PATH}/new` }}
      >
        {benefits ? <RegisteredBenefits lease={lease} /> : null}
      </WizardDone>

      <ManualRegistrationDialog leaseId={lease.id} open={declareOpen} onOpenChange={setDeclareOpen} />
    </div>
  );
}
