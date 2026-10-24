import { useTranslation } from 'react-i18next';
import { FocusBlock } from '@/components/shared/calm';
import type { LongRentNow } from '@/types';
import { leaseTenantName } from '../lib/lease-list-format';
import { describeLeaseStep } from '../lib/lease-next-step';

const LEASES_PATH = '/app/long-rent/leases';

/**
 * «Adesso»: the one block of the overview that is colored. It is the step of the landlord that cannot wait, as the server picked
 * it among all the leases (`now`): which lease and whose tenant, what to do, whose turn it is, by when, and the one button that
 * does it. With no step to take it says so, and its button leads to the leases.
 */
export function NowBlock({ now, today }: { now: LongRentNow | null; today: string }) {
  const { t, i18n } = useTranslation();

  if (!now) {
    return (
      <FocusBlock
        tone="success"
        kicker={t('longRentOverview.now.kicker')}
        title={t('longRentOverview.now.nothing.title')}
        body={t('longRentOverview.now.nothing.body')}
        primary={{ label: t('longRentOverview.now.nothing.action'), href: LEASES_PATH, testId: 'long-rent-now-action' }}
        data-testid="long-rent-now"
      />
    );
  }

  const step = describeLeaseStep(now.leaseId, now.step, { t, language: i18n.language, today });
  const tenant = leaseTenantName({ tenantFirstName: now.tenantFirstName, tenantLastName: now.tenantLastName }, t);

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
      primary={{ label: step.action, href: step.to, testId: 'long-rent-now-action' }}
      secondary={
        step.leavesTheSheet ? { label: t('longRentOverview.now.openLease'), href: step.leaseTo, testId: 'long-rent-now-lease' } : undefined
      }
      data-testid="long-rent-now"
    />
  );
}
