import type { UseQueryResult } from '@tanstack/react-query';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Building2, UserRound } from 'lucide-react';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { SkeletonLine } from '@/components/ui/skeleton';
import type { ChannelAccountHolder, ChannelCommissionRuleSet, PortalAccountHolder, Property } from '@/types';
import type { BillingWizardValues } from '../billing-wizard-schema';
import { AccountHolderTable } from './account-holder-table';
import { CommissionPercents } from './commission-percents';

type Read<T> = Pick<UseQueryResult<T>, 'data' | 'isPending' | 'isError' | 'error' | 'refetch'>;

interface ChannelsStepProps {
  ownerInvoicing: boolean;
  properties: Read<Property[]>;
  holders: Read<ChannelAccountHolder[]>;
  rules: Read<ChannelCommissionRuleSet>;
}

const HOLDERS: ReadonlyArray<{ value: PortalAccountHolder; icon: typeof Building2 }> = [
  { value: 'Owner', icon: UserRound },
  { value: 'Agency', icon: Building2 },
];

export function ChannelsStep({ ownerInvoicing, properties, holders, rules }: ChannelsStepProps) {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<BillingWizardValues>();
  const holder = useWatch({ control, name: 'portalAccountHolder' });
  const recharge = useWatch({ control, name: 'rechargePortalCommissions' });

  return (
    <>
      <p className="text-sm text-foreground/80">{t('billingWizard.channels.intro')}</p>

      {ownerInvoicing ? (
        <>
          <div className="flex flex-col gap-3">
            <ChoiceGroup legend={t('billingWizard.channels.holder.legend')} legendVisible minCardWidth={16}>
              {HOLDERS.map(({ value, icon }) => (
                <ChoiceCard
                  key={value}
                  name="billing-account-holder"
                  value={value}
                  checked={holder === value}
                  onChange={() => setValue('portalAccountHolder', value, { shouldDirty: true })}
                  icon={icon}
                  title={
                    <>
                      {t(`billingWizard.channels.holder.${value}.title`)}
                      {value === 'Owner' ? <span className="ml-2 text-xs font-normal text-foreground/70">({t('billingWizard.channels.holder.suggested')})</span> : null}
                    </>
                  }
                  description={
                    <span className="flex flex-col gap-1">
                      <span>{t(`billingWizard.channels.holder.${value}.invoice`)}</span>
                      <span>{t(`billingWizard.channels.holder.${value}.td17`)}</span>
                      <span>{t(`billingWizard.channels.holder.${value}.recharge`)}</span>
                    </span>
                  }
                  data-testid={`billing-holder-${value}`}
                />
              ))}
            </ChoiceGroup>
            <p className="text-sm text-foreground/70">{t('billingWizard.channels.holder.hint')}</p>
          </div>

          {holder === 'Agency' ? (
            <ChoiceGroup legend={t('billingWizard.channels.recharge.legend')} legendVisible minCardWidth={16}>
              <ChoiceCard
                type="checkbox"
                checked={recharge}
                onChange={(event) => setValue('rechargePortalCommissions', event.target.checked, { shouldDirty: true })}
                title={t('billingWizard.channels.recharge.title')}
                description={t('billingWizard.channels.recharge.description')}
                data-testid="billing-recharge"
              />
            </ChoiceGroup>
          ) : null}

          {properties.isPending || holders.isPending ? (
            <SkeletonLine lines={3} lineClassName="h-10" label={t('billingWizard.channels.exceptions.loading')} />
          ) : properties.isError || holders.isError ? (
            <ErrorState
              title={t('billingWizard.channels.exceptions.loadError')}
              error={holders.error ?? properties.error}
              onRetry={() => {
                void properties.refetch();
                void holders.refetch();
              }}
              testId="billing-holders-error"
            />
          ) : (
            <AccountHolderTable properties={Array.isArray(properties.data) ? properties.data : []} overrides={holders.data ?? []} />
          )}
        </>
      ) : (
        <Alert variant="info" data-testid="billing-holders-unavailable">
          {t('billingWizard.channels.holder.unavailable')}
        </Alert>
      )}

      {rules.isPending ? (
        <SkeletonLine lines={2} lineClassName="h-10" label={t('billingWizard.channels.commissions.loading')} />
      ) : rules.isError || !rules.data ? (
        <ErrorState title={t('billingWizard.channels.commissions.loadError')} error={rules.error} onRetry={() => void rules.refetch()} testId="billing-commissions-error" />
      ) : (
        <CommissionPercents set={rules.data} />
      )}
    </>
  );
}
