import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock, ListChecks } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { useLicensedFunctions, useRefreshLicensedFunctions } from '@/queries/use-marketplace';
import { WIZARD_LINK_CLASS } from '../../components/wizard-frame';
import { MARKETPLACE_MINE_PATH, marketplaceHref } from '../../lib/marketplace-paths';
import { functionOf, requestPhase, type LicensedContext, type RequestPhase } from '../licensed-request-model';

const TITLE_TEXT: Readonly<Record<RequestPhase, string>> = {
  requested: 'marketplace.licensed.requested.title.requested',
  active: 'marketplace.licensed.requested.title.active',
  toFix: 'marketplace.licensed.requested.title.toFix',
  notRequested: 'marketplace.licensed.requested.title.none',
};

const STATUS_TEXT: Readonly<Record<RequestPhase, string>> = {
  requested: 'marketplace.licensed.status.requested',
  active: 'marketplace.licensed.status.active',
  toFix: 'marketplace.licensed.status.toFix',
  notRequested: 'marketplace.licensed.status.notActive',
};

interface RequestedStepProps {
  context: LicensedContext;
  propertyId: string;
  exitPath: string;
}

export function RequestedStep({ context, propertyId, exitPath }: RequestedStepProps) {
  const { t } = useTranslation();
  const list = useLicensedFunctions(propertyId || undefined);
  const refresh = useRefreshLicensedFunctions();
  const mine = functionOf(list.data, context.moduleCode);
  const phase = requestPhase(mine);
  const name = mine?.name ?? context.entry?.name ?? t('marketplace.licensed.thisFunction');
  const checked = refresh.isSuccess && !refresh.isPending;
  const refused = refresh.isError ? (getProblemMessage(refresh.error, t) ?? t('marketplace.licensed.requested.checkFailed')) : null;
  const over = propertyId === '';

  return (
    <div data-testid="licensed-requested">
      <WizardDone
        title={over ? t('marketplace.licensed.requested.title.over') : t(TITLE_TEXT[phase])}
        description={name}
        lead={over ? t('marketplace.licensed.requested.over', { name }) : phase === 'requested' ? t('marketplace.licensed.requested.lead') : undefined}
        whatNext={[
          { text: t('marketplace.licensed.requested.whatNext.daily'), icon: CalendarClock },
          { text: t('marketplace.licensed.requested.whatNext.checkNow'), icon: ListChecks },
        ]}
        primary={{ label: t('marketplace.licensed.requested.done'), to: exitPath }}
        secondary={{ label: t('marketplace.licensed.requested.later'), to: exitPath }}
      >
        <div className="min-w-0 space-y-4 rounded-lg border p-4" data-testid="licensed-requested-status">
          {over ? null : (
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{t('marketplace.licensed.requested.statusLabel')}</span>
              <Badge variant={phase === 'active' ? 'success' : phase === 'toFix' ? 'destructive' : 'warning'} data-testid="licensed-requested-badge" data-phase={phase}>
                {t(STATUS_TEXT[phase])}
              </Badge>
            </div>
          )}

          {propertyId ? (
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-11 whitespace-normal py-2"
              loading={refresh.isPending}
              onClick={() => refresh.mutate(propertyId)}
              data-testid="licensed-check-now"
            >
              {t('marketplace.licensed.requested.checkNow')}
            </Button>
          ) : null}
          {checked && phase === 'active' ? (
            <Alert variant="success" data-testid="licensed-check-active">
              {t('marketplace.licensed.requested.nowActive')}
            </Alert>
          ) : null}
          {checked && phase !== 'active' ? (
            <p className="text-sm text-muted-foreground" role="status" data-testid="licensed-check-not-yet">
              {t('marketplace.licensed.requested.notYet')}
            </p>
          ) : null}
          {refused ? (
            <Alert variant="danger" data-testid="licensed-check-error">
              {refused}
            </Alert>
          ) : null}

          <p className="text-sm" data-testid="licensed-next-step">
            {t('marketplace.licensed.requested.nextStep')}{' '}
            <Link to={marketplaceHref(MARKETPLACE_MINE_PATH, propertyId || undefined)} className={WIZARD_LINK_CLASS} data-testid="licensed-see-active">
              {t('marketplace.licensed.requested.seeActive')}
            </Link>
          </p>
        </div>
      </WizardDone>
    </div>
  );
}
