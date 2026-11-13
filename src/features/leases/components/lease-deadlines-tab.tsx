import { RegistrationPreparationDialog } from './registration-preparation-dialog';
import type { LeaseDetail } from '@/types';
import { useRliChecklist } from '@/queries/use-leases';
import { useRegistrationFlow } from '../hooks/use-registration-flow';
import { DelegaCaptureDialog } from './delega-capture-dialog';
import { LeaseDates } from './lease-dates';
import { QuesturaCommunicationPanel } from './questura-communication-panel';
import { RegistrationStatusPanel } from './registration-status-panel';
import { RliChecklist } from './rli-checklist';

/**
 * What the lease has to do with the authorities and by when: first the dates of the contract (LR-03c: registration, Questura, the end of
 * the period, the last day of notice, the rents), then the checklist of the registration (RLI) with its countdown, the Questura
 * communication for an extra-EU tenant and the registration itself. The panels are the ones the page always had; only their place changed.
 */
export function LeaseDeadlinesTab({ lease, showQuestura }: { lease: LeaseDetail; showQuestura: boolean }) {
  const { data: checklist } = useRliChecklist(lease.id);
  const flow = useRegistrationFlow(lease, checklist);
  const providerFilingAvailable = flow.providerFilingAvailable;

  return (
    <div className="space-y-8">
      <LeaseDates lease={lease} />
      <RliChecklist leaseId={lease.id} />
      {/* LT-07: extra-EU tenant, the 48-hour Questura communication is declared by the landlord. */}
      {showQuestura && <QuesturaCommunicationPanel leaseId={lease.id} leaseEndDate={lease.endDate} />}
      <RegistrationStatusPanel
        leaseId={lease.id}
        leaseStatus={lease.status}
        registration={lease.registration}
        registrationDeadline={lease.registrationDeadline}
        providerFilingAvailable={providerFilingAvailable}
        onSubmitToProvider={flow.openDelega}
        isSubmittingToProvider={flow.dialogProps.isSubmitting}
        onStartCheckout={flow.startCheckout}
        isStartingCheckout={flow.startingCheckout}
        viaService={lease.isConcordatoFacileSource === true}
      />
      {flow.providerFilingAvailable && <RegistrationPreparationDialog {...flow.preparationProps} />}
      {providerFilingAvailable && !lease.isConcordatoFacileSource && checklist && (
        <DelegaCaptureDialog
          {...flow.dialogProps}
          tosVersion={checklist.tosVersion}
          attestationText={checklist.attestationText}
        />
      )}
    </div>
  );
}
