import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { LeasePeriodConflict } from '@/types';
import { PERIOD_CONFLICT_CHECK, conflictingLeasePath } from './period-conflict';
import { needMessage } from './wizard-messages';

/**
 * The warning of the wizard (LR-OVERLAP): another lease of the same property covers some of the same days. It is told as soon as the
 * property and both dates are there, with the link to that lease; it blocks nothing here — the review and the steps that make the lease a
 * contract do (409 `lease_period_overlaps`). The sentence is the one of the review check `lease_overlap`, the only place its words are.
 * The server sends the id and the days, never a name.
 */
export function PeriodConflictNotice({ conflict }: { conflict: LeasePeriodConflict }) {
  const { t, i18n } = useTranslation();
  return (
    <Alert
      variant="warning"
      data-testid="lease-period-conflict"
      action={
        <Button asChild variant="outline" size="sm">
          <Link to={conflictingLeasePath(conflict.conflictingLeaseId)}>{t('leaseWizard.periodConflict.open')}</Link>
        </Button>
      }
    >
      {needMessage(t, i18n, { code: PERIOD_CONFLICT_CHECK, params: { ...conflict } })}
    </Alert>
  );
}
