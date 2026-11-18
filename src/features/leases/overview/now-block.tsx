import { useTranslation } from 'react-i18next';
import { useWorkspace } from '@/hooks/use-workspace';
import { LONG_RENT_PROPERTIES_PATH } from '@/features/properties/long-rent/paths';
import { FocusBlock } from '@/components/shared/calm';
import type { LongRentNow } from '@/types';
import { leaseTenantName } from '../lib/lease-list-format';
import { describeLeaseStep } from '../lib/lease-next-step';

const DEADLINES_PATH = '/app/long-rent/deadlines';

/**
 * «Adesso»: the one block of the overview that is colored. It is the step of the landlord that cannot wait, as the server picked
 * it among all the leases (`now`): which lease and whose tenant, what to do, whose turn it is, by when, and the one button that
 * does it. With no step to take it says so, and its button leads to the leases.
 */
export function NowBlock({ now, today }: { now: LongRentNow | null; today: string }) {
  const { t, i18n } = useTranslation();

  const { hasPermission } = useWorkspace();
  if (!now) {
    const canReadProperty = hasPermission('long-rent', 'property.read');
    return (
      <FocusBlock
        tone="success"
        kicker={t('longRentOverview.now.kicker')}
        title={t('longRentOverview.now.nothing.title')}
        body={t('longRentOverview.now.nothing.body')}
        primary={{ label: t(canReadProperty ? 'longRentOverview.contracts.openProperties' : 'nav.longRentDeadlines'), href: canReadProperty ? LONG_RENT_PROPERTIES_PATH : DEADLINES_PATH, testId: 'long-rent-now-action' }}
        data-testid="long-rent-now"
      />
    );
  }

  const step = describeLeaseStep(now.leaseId, now.step, { t, language: i18n.language, today });
  const tenant = leaseTenantName({ tenantFirstName: now.tenantFirstName, tenantLastName: now.tenantLastName }, t);

  const readOnly = !hasPermission('long-rent', 'lease.create');
  return (
    <FocusBlock
      tone={step.tone}
      kicker={t('longRentOverview.now.kicker')}
      title={step.title}
      body={
        <>
          <span className="block font-medium">{`${tenant} · ${now.propertyName}`}</span>
          {step.detail ? <span className="mt-1 block">{step.detail}</span> : null}
        </>
      }
      who={step.who}
      when={step.when ?? undefined}
      primary={{ label: readOnly ? t('longRentOverview.now.openLease') : step.action, href: readOnly ? step.leaseTo : step.to, testId: 'long-rent-now-action' }}
      secondary={
        !readOnly && step.leavesTheSheet ? { label: t('longRentOverview.now.openLease'), href: step.leaseTo, testId: 'long-rent-now-lease' } : undefined
      }
      data-testid="long-rent-now"
    />
  );
}
