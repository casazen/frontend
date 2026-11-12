import { useEffect, useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import type { MarketplaceActivationStatus, Property } from '@/types';
import { CHANNELS_PAGE_PATH } from '../../lib/marketplace-paths';
import { WIZARD_LINK_CLASS } from '../../components/wizard-frame';
import { problemCodeOf, propertyAvailability, type ActivationContext, type ActivationWizardValues } from '../activation-wizard-model';

/** The words of a status: the ones of the cards of the marketplace (a request that waits and an activation that is not finished are both «In attesa»). */
const STATUS_TEXT: Readonly<Record<MarketplaceActivationStatus, string | null>> = {
  Active: 'marketplace.status.Active',
  Pending: 'marketplace.status.Pending',
  Requested: 'marketplace.status.Pending',
  ToFix: 'marketplace.status.ToFix',
  Deactivated: null,
};

const BADGE_VARIANT: Readonly<Record<MarketplaceActivationStatus, 'success' | 'warning' | 'destructive' | 'outline'>> = {
  Active: 'success',
  Pending: 'warning',
  Requested: 'warning',
  ToFix: 'destructive',
  Deactivated: 'outline',
};

function addressOf(property: Property): string {
  return [property.address, property.city].filter(Boolean).join(', ');
}

/** What stops the step as a whole: the connection to the channel manager is missing, the portal is not for this person, or a plan could not be read. */
function PlanProblem({ context }: { context: ActivationContext }) {
  const { t } = useTranslation();
  const code = problemCodeOf(context.planError);
  const name = context.channelName ?? t('marketplace.activation.thisChannel');

  if (code === 'marketplace_octorate_not_connected') {
    return (
      <Alert variant="warning" title={t('marketplace.activation.property.notConnected.title')} data-testid="activation-not-connected">
        <p>{t('marketplace.activation.property.notConnected.text', { name })}</p>
        <Link to={CHANNELS_PAGE_PATH} className={WIZARD_LINK_CLASS} data-testid="activation-connect-link">
          {t('marketplace.activation.property.notConnected.link')}
        </Link>
      </Alert>
    );
  }
  if (code === 'marketplace_portal_unknown') {
    return (
      <Alert variant="warning" data-testid="activation-portal-unknown">
        {t('marketplace.activation.property.portalUnknown')}
      </Alert>
    );
  }

  return (
    <Alert
      variant="danger"
      data-testid="activation-plan-error"
      action={
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={context.onRetry}>
          {t('marketplace.activation.property.retry')}
        </Button>
      }
    >
      {t('marketplace.activation.property.planError', { name })}
    </Alert>
  );
}

interface PropertyStepProps {
  context: ActivationContext;
}

/**
 * Step «Immobili» (E09/F02/US04/T01): the host's properties that have a confirmed listing on the channel manager (the plan of the portal says it),
 * one or more of them. Each chosen property is activated in its turn. A property with no confirmed listing is told with one sentence and the way
 * to fix it (the Channels page, where the connect wizard starts): it is the only place this step lets the person go to, and the draft stays.
 * A host whose channel manager is not connected at all is told so in one sentence, with the same way.
 */
export function PropertyStep({ context }: PropertyStepProps) {
  const { t } = useTranslation();
  const { control, setValue, getValues, formState } = useFormContext<ActivationWizardValues>();
  const chosen = useWatch({ control, name: 'propertyIds' }) ?? [];
  const { properties, plans, channelName } = context;
  const name = channelName ?? t('marketplace.activation.thisChannel');

  // A property whose plan was not read has nothing to say yet: it is in neither list.
  const linked: Property[] = [];
  const notLinked: Property[] = [];
  for (const property of properties) {
    const plan = plans.get(property.id);
    if (plan) (propertyAvailability(plan) === 'ready' ? linked : notLinked).push(property);
  }

  const linkedIds = new Set(linked.map((property) => property.id));

  // A property that cannot be chosen (its plan says it is not linked, or it is no longer in the list: an address or a draft that is older than the list) is taken out of
  // the choice once the plans are read, so that the person is never asked to uncheck what they cannot see.
  const staleChoice = context.propertiesStatus === 'ready' && !context.plansPending ? chosen.filter((id) => !linkedIds.has(id)) : [];
  const staleKey = staleChoice.join('|');
  useEffect(() => {
    if (staleKey === '') return;
    const stale = staleKey.split('|');
    setValue(
      'propertyIds',
      getValues('propertyIds').filter((id) => !stale.includes(id)),
      { shouldDirty: true },
    );
  }, [staleKey, setValue, getValues]);

  // With one property that can be chosen and none chosen yet, CasaZen chooses it (UX-04: fill in what it knows). Once: the person may take it away.
  const preselected = useRef(false);
  const onlyChoice = linked.length === 1 && chosen.length === 0 ? linked[0].id : null;
  useEffect(() => {
    if (onlyChoice === null || preselected.current) return;
    preselected.current = true;
    setValue('propertyIds', [onlyChoice], { shouldDirty: true });
  }, [onlyChoice, setValue]);

  if (context.propertiesStatus === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="activation-properties-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.activation.property.loading')}
      </div>
    );
  }
  if (context.propertiesStatus === 'error') {
    return (
      <Alert
        variant="danger"
        data-testid="activation-properties-error"
        action={
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={context.onRetry}>
            {t('marketplace.activation.property.retry')}
          </Button>
        }
      >
        {t('marketplace.activation.property.loadError')}
      </Alert>
    );
  }
  if (properties.length === 0) {
    return (
      <Alert variant="info" data-testid="activation-no-properties">
        {t('marketplace.activation.property.none', { name })}
      </Alert>
    );
  }
  if (context.planError) return <PlanProblem context={context} />;

  const cannotStart = [...plans.values()].some((plan) => !plan.creatable);
  const validChoice = chosen.filter((id) => linkedIds.has(id));

  const toggle = (propertyId: string, on: boolean) => {
    const next = on ? [...chosen.filter((id) => id !== propertyId), propertyId] : chosen.filter((id) => id !== propertyId);
    setValue('propertyIds', next, { shouldDirty: true, shouldTouch: true });
  };

  return (
    <div className="flex flex-col gap-4" data-testid="activation-property-step">
      {context.plansPending && plans.size === 0 ? (
        <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="activation-plans-loading">
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          {t('marketplace.activation.property.loading')}
        </div>
      ) : null}

      {cannotStart ? (
        <Alert variant="warning" data-testid="activation-not-creatable">
          {t('marketplace.activation.property.notCreatable', { name })}
        </Alert>
      ) : null}

      {linked.length > 0 ? (
        <ChoiceGroup legend={t('marketplace.activation.property.legend')} minCardWidth={16}>
          {linked.map((property) => {
            const status = plans.get(property.id)?.activationStatus ?? null;
            const statusText = status ? STATUS_TEXT[status] : null;
            return (
              <ChoiceCard
                key={property.id}
                type="checkbox"
                name="activation-property"
                value={property.id}
                checked={chosen.includes(property.id)}
                onChange={(event) => toggle(property.id, event.target.checked)}
                title={property.name}
                description={
                  <>
                    <span className="block">{addressOf(property)}</span>
                    {status && statusText ? (
                      <Badge variant={BADGE_VARIANT[status]} className="mt-2 w-fit" data-testid={`activation-property-${property.id}-status`}>
                        {t(statusText)}
                      </Badge>
                    ) : null}
                  </>
                }
                data-testid={`activation-property-${property.id}`}
              />
            );
          })}
        </ChoiceGroup>
      ) : null}

      {linked.length > 0 ? (
        <p className="text-sm text-muted-foreground" role="status" data-testid="activation-property-count">
          {t('marketplace.activation.property.selected', { count: validChoice.length })}
        </p>
      ) : null}

      {notLinked.length > 0 ? (
        <section className="min-w-0 space-y-2 rounded-lg bg-muted p-4" aria-labelledby="activation-not-linked-title" data-testid="activation-not-linked">
          <h3 id="activation-not-linked-title" className="text-sm font-semibold">
            {t('marketplace.activation.property.notLinked.title')}
          </h3>
          <ul className="space-y-1 text-sm" role="list">
            {notLinked.map((property) => (
              <li key={property.id} className="break-words" data-testid={`activation-not-linked-${property.id}`}>
                <span className="font-medium">{property.name}</span> {t('marketplace.activation.property.notLinked.item')}
              </li>
            ))}
          </ul>
          <Link to={CHANNELS_PAGE_PATH} className={WIZARD_LINK_CLASS} data-testid="activation-link-properties">
            {t('marketplace.activation.property.notLinked.link')}
          </Link>
        </section>
      ) : null}

      <FormFieldError error={formState.errors.propertyIds as { message?: string } | undefined} />
    </div>
  );
}
