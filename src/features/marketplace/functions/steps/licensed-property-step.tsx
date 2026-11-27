import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { useLicensedFunctions } from '@/queries/use-marketplace';
import type { Property } from '@/types';
import type { LicensedContext, LicensedRequestValues } from '../licensed-request-model';
import { LicenseProblem } from './license-problem';
import { useDefaultProperty } from './use-default-property';

function addressOf(property: Property): string {
  return [property.address, property.city].filter(Boolean).join(', ');
}

interface LicensedPropertyStepProps {
  context: LicensedContext;
}

/**
 * Step «Immobile» (E09/F02/US04/T03): a function is licensed for one property, and the request names exactly one. The properties of the host are the choice; the one
 * that is chosen is read for its license at once, so a property with no confirmed listing on the channel manager is told in one sentence and with the way to fix it
 * (the Channels page) as soon as it is chosen, never as a raw error on the last button.
 */
export function LicensedPropertyStep({ context }: LicensedPropertyStepProps) {
  const { t } = useTranslation();
  const { control, setValue, formState } = useFormContext<LicensedRequestValues>();
  const chosen = useWatch({ control, name: 'propertyId' }) ?? '';
  useDefaultProperty(context.properties, chosen);
  const list = useLicensedFunctions(chosen || undefined);

  if (context.propertiesStatus === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="licensed-properties-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.licensed.property.loading')}
      </div>
    );
  }
  if (context.propertiesStatus === 'error') {
    return (
      <Alert
        variant="danger"
        data-testid="licensed-properties-error"
        action={
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={context.onRetry}>
            {t('marketplace.licensed.problem.retry')}
          </Button>
        }
      >
        {t('marketplace.licensed.property.loadError')}
      </Alert>
    );
  }
  if (context.properties.length === 0) {
    return (
      <Alert variant="info" data-testid="licensed-no-properties">
        {t('marketplace.licensed.property.none')}
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="licensed-property-step">
      <ChoiceGroup legend={t('marketplace.licensed.property.legend')} minCardWidth={16}>
        {context.properties.map((property) => (
          <ChoiceCard
            key={property.id}
            name="licensed-property"
            value={property.id}
            checked={chosen === property.id}
            onChange={() => setValue('propertyId', property.id, { shouldDirty: true, shouldTouch: true })}
            title={property.name}
            description={addressOf(property)}
            data-testid={`licensed-property-${property.id}`}
          />
        ))}
      </ChoiceGroup>
      {chosen && list.isError ? <LicenseProblem error={list.error} onRetry={() => void list.refetch()} /> : null}
      <FormFieldError error={formState.errors.propertyId} />
    </div>
  );
}
