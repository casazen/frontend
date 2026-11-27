import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { PlanCompare } from '../plan-compare';
import { PlanFocus } from '../plan-focus';

/**
 * What the plan page says about the open access (INC-21: it changes the level of the plan, never the payments or the modules) and about the
 * modules of Starter with the guided registration (INC-23).
 */
const portal = { open: vi.fn(), pending: false };
const subscription = { status: 'none', planTier: 'Starter' } as never;

function renderWith(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>{node}</MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function renderFocus(openAccess: boolean, pricesPending: boolean) {
  return renderWith(
    <PlanFocus subscription={subscription} tier="Starter" usage={{} as never} openAccess={openAccess} pricesPending={pricesPending} onOpenPlans={vi.fn()} portal={portal} />,
  );
}

function renderCompare(showModulesNote?: boolean) {
  const plansQuery = { isPending: false, isError: false, data: [], refetch: vi.fn() } as never;
  return renderWith(
    <PlanCompare
      detailsRef={{ current: null }}
      plansQuery={plansQuery}
      subscription={subscription}
      tier="Starter"
      usage={{} as never}
      portal={portal}
      onAlreadySubscribed={vi.fn()}
      showModulesNote={showModulesNote}
    />,
  );
}

describe('the plan page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  it.each([false, true])('OpenAccessNotice_PricesPending_%s_SaysWhatChangesAndLeavesThePaymentsAlone', (pricesPending) => {
    renderFocus(true, pricesPending);

    const notice = screen.getByTestId('account-billing-notice');
    expect(notice).toHaveTextContent(i18n.t(pricesPending ? 'accountBilling.plan.notice.openAccessPricesPending' : 'accountBilling.plan.notice.openAccess'));
    // The old words promised «nothing is charged» and «every function is unlocked»: neither is true (subscriptions, payments and modules are untouched).
    expect(notice.textContent).not.toMatch(/non addebitiamo nulla|tutte le funzioni sono sbloccate/i);
    expect(notice).toHaveTextContent('continua a essere addebitato');
    expect(notice).toHaveTextContent('moduli a pagamento restano quelli che hai acquistato');
  });

  it('OpenAccessNotice_English_SaysTheSame', async () => {
    await i18n.changeLanguage('en');
    renderFocus(true, false);

    const notice = screen.getByTestId('account-billing-notice');
    expect(notice.textContent).not.toMatch(/we charge nothing|every feature is unlocked/i);
    expect(notice).toHaveTextContent('still charged');
    expect(notice).toHaveTextContent('paid modules stay the ones you bought');
  });

  it('PlanCompare_GuidedRegistration_SaysThatStarterHasNoModulesAndWhichFeaturesStayLocked', () => {
    renderCompare(true);

    const note = screen.getByTestId('account-billing-modules-note');
    expect(note).toHaveTextContent('Starter non include nessun modulo');
    expect(note).toHaveTextContent('dal piano Pro in poi');
    for (const code of ['compliance', 'direct-booking', 'channels', 'operations']) {
      expect(note).toHaveTextContent(i18n.t(`commercial.addons.${code}.title`));
    }
    expect(note).toHaveTextContent('Stripe Connect');
  });

  it.each([undefined, false])('PlanCompare_NotGuidedRegistration_%s_SaysNothingAboutModules', (showModulesNote) => {
    renderCompare(showModulesNote);

    expect(screen.queryByTestId('account-billing-modules-note')).not.toBeInTheDocument();
  });
});
