import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { LeaseReading } from '@/types';
import { ReadingBanner } from '../wizard/reading-marks';
import { emptyFlow } from '../wizard/wizard-model';
import { wizardPath } from '../wizard/wizard-path';

/**
 * The contract ConcordatoFacile delivered, uploaded to its draft (CF-IMPORT): where the reading of it stands (the same words as the
 * wizard of a contract the owner uploads, NL-DOCS: being read, read, or not readable and why) and the one button that goes on,
 * «Completa e importa il contratto». It opens the wizard of the draft on the first step with something missing, where the final import
 * uses the PDF already uploaded; when the reading failed or found nothing, from the parties, by hand. The draft is the one the caller
 * showed (`useCfDeliveredContract`): the contract is already in it.
 */
export function CfImportPanel({ leaseId, reading }: { leaseId: string; reading: LeaseReading }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const titleId = useId();
  const [opening, setOpening] = useState(false);
  // While the contract is being read the button waits (CF-FLOW, NL-DOCS-FU8): the wizard would open before there is anything to check.
  const stillReading = reading.state === 'Reading';

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
      <p className="text-sm">{t('cfDocuments.import.description')}</p>
      <ReadingBanner reading={reading} flow={emptyFlow('Imported')} />
      <Button type="button" loading={opening} disabled={stillReading} onClick={() => void open()} data-testid="cf-import-open">
        {stillReading ? t('guidedContract.reading') : t('cfDocuments.import.action')}
      </Button>
    </section>
  );
}
