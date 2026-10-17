import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FocusBlock, type CalmAction, type CalmTone } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { useSupplierDashboardLink, useSupplierOnboardingLink } from '@/queries/use-supplier-payments';
import { isRetryableConnectError } from '@/types/connect.types';
import { resolveSupplierPaymentsState, type SupplierPaymentsAccount } from '@/types/supplier-payments';
import { requirementGroups, type StripeMark } from './payments-model';

/** What Stripe still asks for, in words and not in its own field names. Nothing when it asks for nothing. */
function Requirements({ fields }: { fields: readonly string[] }) {
  const { t } = useTranslation();
  const groups = requirementGroups(fields);
  if (groups.length === 0) return null;

  const words = {
    person: t('supplier.payments.focus.requirements.person'),
    business: t('supplier.payments.focus.requirements.business'),
    bank: t('supplier.payments.focus.requirements.bank'),
    terms: t('supplier.payments.focus.requirements.terms'),
    other: t('supplier.payments.focus.requirements.other'),
  };

  return (
    <>
      <p className="mt-2 font-medium">{t('supplier.payments.focus.requirements.intro')}</p>
      <ul role="list" className="mt-1 list-disc space-y-0.5 pl-5" data-testid="supplier-payments-requirements">
        {groups.map((group) => (
          <li key={group}>{words[group]}</li>
        ))}
      </ul>
    </>
  );
}

interface ActionErrorProps {
  error: unknown;
  /** Said when the server gave nothing better. */
  fallback: string;
  onRetry: () => void;
  retrying: boolean;
  testId: string;
}

/** A failed call to Stripe's side. The account is never changed by a failure: the page says what went wrong, with "Riprova" when trying again may help. */
function ActionError({ error, fallback, onRetry, retrying, testId }: ActionErrorProps) {
  const { t } = useTranslation();

  return (
    <Alert
      variant="danger"
      data-testid={testId}
      action={
        isRetryableConnectError(error) ? (
          <Button type="button" variant="outline" size="sm" loading={retrying} onClick={onRetry}>
            {t('supplier.retry')}
          </Button>
        ) : undefined
      }
    >
      {getProblemMessage(error, t) ?? fallback}
    </Alert>
  );
}

interface PaymentsFocusProps {
  account: SupplierPaymentsAccount;
  /** What Stripe sent the supplier back with, if anything: it changes the words, not what the account is. */
  mark: StripeMark | null;
  /** Stripe is being asked again (the button that asks is busy). */
  checking: boolean;
  onCheckAgain: () => void;
}

/**
 * The one highlighted block of the page: where the account stands and the one thing to do about it. No account: connect it.
 * Something left to send: go on where the supplier stopped. Everything sent: Stripe is checking, ask again. Able to take payments:
 * the dashboard of the account on Stripe. Back from Stripe the words say how it went (connected, still being checked, not finished);
 * after an expired link they say so and the button asks for a new one (never opened by itself). The bank details are never typed here:
 * they stay with Stripe.
 */
export function PaymentsFocus({ account, mark, checking, onCheckAgain }: PaymentsFocusProps) {
  const { t } = useTranslation();
  const onboarding = useSupplierOnboardingLink();
  const dashboard = useSupplierDashboardLink();
  const state = resolveSupplierPaymentsState(account);
  const returned = mark === 'return';
  const expired = mark === 'refresh' && (state === 'notConnected' || state === 'toComplete');

  const connect = (label: string): CalmAction => ({
    label,
    onClick: () => onboarding.mutate(),
    loading: onboarding.isPending,
    testId: 'supplier-payments-connect',
  });

  let tone: CalmTone;
  let title: string;
  let body: ReactNode;
  let primary: CalmAction;

  if (state === 'active') {
    tone = 'success';
    title = returned ? t('supplier.payments.focus.active.returnedTitle') : t('supplier.payments.focus.active.title');
    body = (
      <>
        <p>{returned ? t('supplier.payments.focus.active.returnedBody') : t('supplier.payments.focus.active.body')}</p>
        <Requirements fields={account.requirementsDue} />
      </>
    );
    primary = {
      label: t('supplier.payments.focus.active.action'),
      onClick: () => dashboard.mutate(),
      loading: dashboard.isPending,
      testId: 'supplier-payments-dashboard',
    };
  } else if (state === 'verifying') {
    tone = 'info';
    title = t('supplier.payments.focus.verifying.title');
    body = <p>{t('supplier.payments.focus.verifying.body')}</p>;
    primary = {
      label: t('supplier.payments.focus.verifying.action'),
      onClick: onCheckAgain,
      loading: checking,
      testId: 'supplier-payments-recheck',
    };
  } else if (state === 'toComplete') {
    tone = 'warning';
    title = expired ? t('supplier.payments.focus.expired.title') : t('supplier.payments.focus.toComplete.title');
    body = (
      <>
        {expired ? <p>{t('supplier.payments.focus.expired.body')}</p> : null}
        {account.requirementsDue.length > 0 ? (
          <Requirements fields={account.requirementsDue} />
        ) : expired ? null : (
          <p>{t('supplier.payments.focus.toComplete.body')}</p>
        )}
      </>
    );
    primary = connect(t('supplier.payments.focus.toComplete.action'));
  } else {
    tone = expired ? 'warning' : 'neutral';
    title = expired ? t('supplier.payments.focus.expired.title') : t('supplier.payments.focus.notConnected.title');
    body = <p>{expired ? t('supplier.payments.focus.expired.body') : t('supplier.payments.focus.notConnected.body')}</p>;
    primary = connect(t('supplier.payments.focus.notConnected.action'));
  }

  const kicker = returned
    ? t('supplier.payments.focus.kicker.return')
    : expired
      ? t('supplier.payments.focus.kicker.refresh')
      : t('supplier.payments.focus.kicker.default');

  return (
    <div className="min-w-0 space-y-3">
      <FocusBlock data-testid="supplier-payments-focus" data-state={state} tone={tone} kicker={kicker} title={title} body={body} primary={primary} />
      {onboarding.isError ? (
        <ActionError
          testId="supplier-payments-onboarding-error"
          error={onboarding.error}
          fallback={t('supplier.payments.errors.onboarding')}
          retrying={onboarding.isPending}
          onRetry={() => onboarding.mutate()}
        />
      ) : null}
      {dashboard.isError ? (
        <ActionError
          testId="supplier-payments-dashboard-error"
          error={dashboard.error}
          fallback={t('supplier.payments.errors.dashboard')}
          retrying={dashboard.isPending}
          onRetry={() => dashboard.mutate()}
        />
      ) : null}
    </div>
  );
}
