import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Inbox, Plus } from 'lucide-react';
import { ServicePageHeader } from '@/features/supplier/components/service-page-header';
import { FocusBlock } from '@/components/shared/calm';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useSupplierActivation } from '@/queries/supplier/use-profile';
import { useSupplierDashboard, useSupplierToday } from '@/queries/supplier/use-inbox';
import { useCurrentUser } from '@/queries/use-users';
import { HOME_DAYS, jobsToDoToday } from './home/home-model';
import { NextStepSection } from './home/next-step-section';
import { NumbersSection } from './home/numbers-section';
import { TodaySection } from './home/today-section';
import { TodoSection } from './home/todo-section';
import { INBOX_PATH } from './requests/request-model';
import { useRequestActions } from './requests/use-request-actions';
import { NEW_SERVICE_PATH } from './services/lib/service-paths';

/** Two columns from a wide screen, as the Home of Affitti brevi: the day on the left (60 %), what waits on the right. */
const TWO_COLUMNS = 'grid gap-8 xl:has-[>:nth-child(2)]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start';

/**
 * An active supplier whose accepted Terms of Service are not the current version (SU-05, A4-31): says what happens and links the
 * acceptance. It stays out of the way while the status loads or fails. It is a thing to do, so it is the one block «Cosa fare ora»
 * of the page, as in the other areas, not a banner that reads as an error (UX round 2026-11). It never shows together with the
 * notice of the activation: that one is for a supplier who is not active yet.
 */
function TosReacceptanceNotice() {
  const { t } = useTranslation();
  const { data: activation } = useSupplierActivation();
  const tos = activation?.tos;
  if (activation?.status !== 'Active' || !tos?.reacceptanceRequired) return null;

  return (
    <FocusBlock
      tone="warning"
      title={t('supplier.activation.reaccept.banner')}
      body={tos.blocksActions ? t('supplier.activation.reaccept.bannerBlocking') : t('supplier.activation.reaccept.bannerSoft')}
      primary={{ label: t('supplier.activation.reaccept.bannerAction'), href: '/app/supplier/activation' }}
      data-testid="supplier-tos-reacceptance-banner"
    />
  );
}

/** A supplier who has not finished the activation is not visible to the hosts yet: the page says so and leads back to it. A suspended one has the banner of the shell. */
function ActivationNotice() {
  const { t } = useTranslation();
  const { data: dashboard } = useSupplierDashboard();
  if (dashboard?.status !== 'Pending') return null;

  return (
    <FocusBlock
      tone="warning"
      title={t('supplier.completeActivationHint')}
      primary={{ label: t('supplier.goToActivation'), href: '/app/supplier/activation' }}
      data-testid="supplier-activation-notice"
    />
  );
}

/**
 * The home of the supplier, "Oggi": one highlighted block (the requests to answer and the jobs of the next days), then what waits
 * ("Da fare"), three numbers and the next step of the profile. Each part loads, fails and tries again on its own: one that fails does
 * not hide the others.
 */
export function SupplierDashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const today = useSupplierToday(HOME_DAYS);
  // When the server refuses an action because the request changed meanwhile (the customer cancelled), the page reads it again.
  const actions = useRequestActions(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
    }, [queryClient]),
  );

  const name = user?.firstName?.trim();
  const day = formatStayDate(today.data?.date ?? todayInRome(), locale, { weekday: 'long', day: 'numeric', month: 'long' });
  let description = day;
  if (today.data) {
    const jobs = jobsToDoToday(today.data);
    if (jobs > 0) description = t('supplier.home.purpose.line', { day, what: t('supplier.home.purpose.jobsToday', { count: jobs }) });
  }

  return (
    <div className="min-w-0 space-y-6 md:space-y-8" data-testid="supplier-home">
      <ServicePageHeader
        icon={CalendarCheck}
        title={name ? t('supplier.home.greeting', { name }) : t('supplier.home.greetingAnonymous')}
        description={description}
        secondary={[
          { label: t('supplier.home.menu.requests'), icon: Inbox, to: INBOX_PATH },
          { label: t('supplier.home.menu.newService'), icon: Plus, to: NEW_SERVICE_PATH },
        ]}
        mobilePrimary="none"
      />
      <div className="space-y-3 empty:hidden">
        <TosReacceptanceNotice />
        <ActivationNotice />
      </div>
      <div className={TWO_COLUMNS}>
        <TodaySection actions={actions} />
        <TodoSection />
      </div>
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <NumbersSection />
        <NextStepSection />
      </div>
    </div>
  );
}
