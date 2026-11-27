import { useFormContext, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLicensedFunctions } from '@/queries/use-marketplace';
import { WIZARD_LINK_CLASS } from '../../components/wizard-frame';
import { MARKETPLACE_PATH, marketplaceHref } from '../../lib/marketplace-paths';
import { functionOf, guidanceOf, requestPhase, type LicensedContext, type LicensedRequestValues } from '../licensed-request-model';
import { LicenseProblem } from './license-problem';

interface AskStepProps {
  context: LicensedContext;
  /** Goes back to the step where the property is chosen. */
  onChoose: () => void;
}

/**
 * Step «La richiesta» (E09/F02/US04/T03, PO-12, D21): CasaZen cannot switch a module of the license on, so it prepares the request the person makes to their channel
 * manager: a short text in simple words that names the function and the property (the server writes it in the language of the page), with a «Copia» button. The button of
 * the wizard, «Ho fatto la richiesta», records that the person asked (`POST /api/marketplace/functions/{moduleCode}/request`): the function is then Requested until the
 * license shows it. A function that is on already is told, with the way back to the Marketplace, and nothing is recorded.
 */
export function AskStep({ context, onChoose }: AskStepProps) {
  const { t } = useTranslation();
  const { control } = useFormContext<LicensedRequestValues>();
  const propertyId = useWatch({ control, name: 'propertyId' }) ?? '';
  const list = useLicensedFunctions(propertyId || undefined);
  const mine = functionOf(list.data, context.moduleCode);
  const phase = requestPhase(mine);
  const guidance = guidanceOf(mine);

  if (propertyId === '') {
    return (
      <Alert
        variant="info"
        data-testid="licensed-choose-first"
        action={
          <Button type="button" size="sm" className="min-h-11" onClick={onChoose}>
            {t('marketplace.licensed.chooseFirst.action')}
          </Button>
        }
      >
        {t('marketplace.licensed.chooseFirst.text')}
      </Alert>
    );
  }
  if (list.isPending) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="licensed-ask-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.licensed.ask.loading')}
      </div>
    );
  }
  if (list.isError) return <LicenseProblem error={list.error} onRetry={() => void list.refetch()} />;
  if (!mine) {
    return (
      <Alert variant="warning" data-testid="licensed-unknown-function">
        {t('marketplace.licensed.ask.unknownFunction')}
      </Alert>
    );
  }
  if (phase === 'active') {
    return (
      <Alert variant="success" data-testid="licensed-ask-already-active">
        <p>{t('marketplace.licensed.function.alreadyActive')}</p>
        <Link to={marketplaceHref(MARKETPLACE_PATH, propertyId)} className={WIZARD_LINK_CLASS} data-testid="licensed-back-to-marketplace">
          {t('marketplace.licensed.backToMarketplace')}
        </Link>
      </Alert>
    );
  }

  const copy = async () => {
    if (!guidance) return;
    try {
      await navigator.clipboard.writeText(guidance);
      toast.success(t('marketplace.licensed.ask.copied'));
    } catch {
      // The text is on the screen and can be selected: the person copies it by hand.
      toast.error(t('marketplace.licensed.ask.copyFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="licensed-ask-step">
      <p className="text-sm">{t('marketplace.licensed.ask.explain')}</p>
      {phase === 'requested' ? (
        <Alert variant="info" data-testid="licensed-ask-already-requested">
          {t('marketplace.licensed.ask.alreadyRequested')}
        </Alert>
      ) : null}
      {phase === 'toFix' ? (
        <Alert variant="warning" data-testid="licensed-ask-to-fix">
          {t('marketplace.licensed.ask.toFix')}
        </Alert>
      ) : null}
      {guidance ? (
        <div className="space-y-2">
          <Textarea readOnly rows={5} value={guidance} aria-label={t('marketplace.licensed.ask.textLabel')} data-testid="licensed-guidance" />
          <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal py-2" onClick={() => void copy()} iconRight={<Copy />} data-testid="licensed-copy">
            {t('marketplace.licensed.ask.copy')}
          </Button>
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">{t('marketplace.licensed.ask.after')}</p>
    </div>
  );
}
