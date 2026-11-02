import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import type { CfSyncState } from '@/types/concordatofacile.types';
import type { LeaseReading } from '@/types';
import { ReadingBanner } from '../wizard/reading-marks';
import { emptyFlow } from '../wizard/wizard-model';
import { wizardPath } from '../wizard/wizard-path';
import { PracticeLine } from './practice-status';

/**
 * The contract ConcordatoFacile delivered, uploaded to its draft (CF-IMPORT): the state of the practice (CF-DONE: the sheet of a lease of
 * the service always shows it), where the reading of the file stands (the same words as the wizard of a contract the owner uploads,
 * NL-DOCS: being read, read, or not readable and why) and the one button that goes on, «Completa e importa il contratto». It opens the
 * wizard of the draft on the first step with something missing, where the final import uses the PDF already uploaded; when the reading
 * failed or found nothing, from the parties, by hand. The draft is the one the caller showed (`useCfDeliveredContract`): the contract is
 * already in it.
 *
 * Nobody has to press it when the file is read well: the server imports the contract as signed by itself once the practice says it is
 * signed (`syncState`, from `useCfCompletion`), and then this block is gone. Until then it says what it waits for (the practice) or, when
 * the reading missed something the import needs, that only what is missing is asked.
 */
export function CfImportPanel({ leaseId, reading, syncState }: { leaseId: string; reading: LeaseReading; syncState?: CfSyncState }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const titleId = useId();
  const { flags } = useFeatureFlags();
  const [opening, setOpening] = useState(false);
  // While the contract is being read the button waits (CF-FLOW, NL-DOCS-FU8): the wizard would open before there is anything to check.
  const stillReading = reading.state === 'Reading';
  // The contract goes on by itself when the practice confirms the signature: the button is then only the way to do it by hand.
  const waitsForThePractice = syncState === 'WaitingForSignature';
  let description = t('cfDocuments.import.description');
  if (waitsForThePractice) description = t('cfDocuments.import.waitingForSignature');
  if (syncState === 'ContractNeedsData') description = t('cfDocuments.import.needsData');

  const open = async () => {
    if (opening) return;
    setOpening(true);
    navigate(await wizardPath(leaseId, reading.state === 'Done'));
  };

  return (
    <section aria-labelledby={titleId} data-testid="cf-import-panel" className="space-y-3 rounded-lg bg-primary/5 p-4 ring-1 ring-primary/30">
      <h2 id={titleId} className="text-lg font-semibold">
        {t('cfDocuments.import.title')}
      </h2>
      {flags.concordatoFacile ? <PracticeLine leaseId={leaseId} /> : null}
      <p className="text-sm" data-testid="cf-import-description">
        {description}
      </p>
      {/* Waiting for the practice there is nothing to check yet: the invitation to check and complete is for when the data are asked. */}
      <ReadingBanner reading={reading} flow={emptyFlow('Imported')} held={waitsForThePractice} />
      <Button
        type="button"
        variant={waitsForThePractice ? 'outline' : 'default'}
        loading={opening}
        disabled={stillReading}
        onClick={() => void open()}
        data-testid="cf-import-open"
      >
        {stillReading ? t('guidedContract.reading') : t('cfDocuments.import.action')}
      </Button>
    </section>
  );
}
