import { useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, CircleCheck, Clock3 } from 'lucide-react';
import { getPublicSiteOrigin } from '@/config/public-site';
import { trackTour } from '@/lib/guided-demo/events';
import { sampleDay, sampleFlat, sampleLease, type TourArea } from '@/lib/guided-demo/scenario';
import { tourEntry } from '@/lib/guided-demo/session';
import { invitationDestination } from '@/lib/host-invite-path';
import { formatStayDate, nightsBetween, todayInRome } from '@/lib/stay-dates';
import type { SiteLegal } from '../site-config';
import { inviteHref, referralHref } from '../site-links';
import { PrimaryLink, SecondaryLink } from './site-blocks';

export function TourEntry({ area, secondary = false }: { area: TourArea; secondary?: boolean }) {
  const { t } = useTranslation();
  const Link = secondary ? SecondaryLink : PrimaryLink;
  return <Link href={tourEntry(area)} onClick={() => trackTour('demo_enter', area)}>{t(`site.tour.${area}Cta`)}</Link>;
}

function InvitationStep({ email, area }: { email: string | null; area: TourArea }) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const inviteInput = useRef<HTMLInputElement>(null);
  const href = inviteHref(email, t('site.invite.subject'));
  if (href) return (
    <>
      <p className="mb-3 text-ink-600">{t('site.tour.inviteText')}</p>
      <PrimaryLink href={href} onClick={() => trackTour('invitation_mail_open', area)}>{t('site.invite.cta')}</PrimaryLink>
    </>
  );

  return (
    <div className="space-y-3">
      <p className="text-ink-600">{t('site.tour.referralText')}</p>
      <PrimaryLink href={referralHref(t('site.invite.subject'), t('site.tour.referralBody'))}
        onClick={() => trackTour('referral_mail_open', area)}>{t('site.tour.referralCta')}</PrimaryLink>
      <details>
        <summary className="w-fit cursor-pointer rounded py-2 font-medium text-ink-700">{t('site.tour.haveInvite')}</summary>
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          const value = inviteInput.current?.value;
          const allowed = [window.location.origin, getPublicSiteOrigin()].filter((origin): origin is string => !!origin);
          const destination = typeof value === 'string' ? invitationDestination(value, allowed) : null;
          if (destination) window.location.assign(destination);
          else setError(true);
        }}>
          <p className="text-ink-600">{t('site.tour.inviteOnlyText')}</p>
          <label className="block text-sm font-semibold" htmlFor="tour-invite">{t('site.tour.inviteLabel')}</label>
          <input ref={inviteInput} id="tour-invite" type="url" autoComplete="off" required aria-invalid={error || undefined}
            aria-describedby={error ? 'tour-invite-error' : undefined} onChange={() => setError(false)}
            className="block min-h-11 w-full rounded-lg border border-ink-500 bg-white px-3" />
          {error && <p role="alert" id="tour-invite-error">{t('site.tour.inviteError')}</p>}
          <button className="min-h-11 rounded-full bg-ink-700 px-5 font-semibold text-white" type="submit">{t('site.tour.openInvite')}</button>
        </form>
      </details>
    </div>
  );
}

// The static HTML declares its own example day. After hydration the tour follows today's date in Rome.
const staticDay = () => '2026-11-18';
const subscribeDay = () => () => {};

export function PublicTour({ area, legal }: { area: TourArea; legal: SiteLegal }) {
  const { t, i18n } = useTranslation();
  const exampleDay = useSyncExternalStore(subscribeDay, todayInRome, staticDay);
  const short = area === 'short';
  const stay = sampleDay(exampleDay).arrivals.items[0];
  const lease = sampleLease(exampleDay);
  const day = (value: string) => formatStayDate(value, i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const dates = short
    ? [{ key: 'stayStart', date: stay.checkInDate }, { key: 'stayEnd', date: stay.checkOutDate }]
    : [{ key: 'leaseStart', date: lease.startDate }, { key: 'leaseEnd', date: lease.endDate }];
  const figures = short
    ? [{ key: 'guests', value: stay.numberOfGuests }, { key: 'nights', value: nightsBetween(stay.checkInDate, stay.checkOutDate) }]
    : [
        { key: 'rent', value: new Intl.NumberFormat(i18n.language, {
          style: 'currency', currency: sampleFlat.currency, currencyDisplay: 'code', maximumFractionDigits: 0,
        }).format(lease.monthlyRent) },
        { key: 'overdue', value: lease.overdueRentCount },
      ];
  const StateIcon = short ? Clock3 : CircleCheck;
  return (
    <section id="demo" aria-labelledby="tour-heading" className="min-w-0 scroll-mt-10 overflow-hidden rounded-2xl border border-ink-700/20 bg-white text-ink-800 shadow-sm sm:scroll-mt-0">
      <header className="bg-ink-800 px-4 py-4 text-white sm:px-6">
        <p className="text-sm font-medium text-ink-200">{t('site.tour.sampleDay', { day: day(exampleDay) })}</p>
        <h2 id="tour-heading" className="mt-1 font-display text-2xl font-semibold">{t(`site.tour.${area}Title`)}</h2>
      </header>
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div>
            <h3 className="text-xl font-semibold">{short ? stay.guestName : lease.property?.name}</h3>
            <p className="text-sm text-ink-600">{short ? stay.propertyName : t('site.tour.tenant', { name: `${lease.tenantFirstName} ${lease.tenantLastName}` })}</p>
          </div>
          <p className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold ${short ? 'bg-terra-100 text-terra-800' : 'bg-salvia-100 text-salvia-800'}`}>
            <StateIcon aria-hidden="true" className="size-4 shrink-0" />{t(short ? 'site.tour.checkInState' : 'site.tour.leaseState')}
          </p>
        </div>
        <dl className="grid grid-cols-2 divide-x divide-ink-700/20 border-y border-ink-700/15 py-3">
          {figures.map(({ key, value }) => <div key={key} className="min-w-0 pr-2 even:pr-0 even:pl-4">
            <dt className="text-sm font-medium text-ink-600">{t(`site.tour.figures.${key}`)}</dt>
            <dd className="mt-0.5 font-display text-2xl font-semibold tracking-tight lining-nums tabular-nums sm:text-3xl">{value}</dd>
          </div>)}
        </dl>
      </div>
      <details className="group" onToggle={event => { if (event.currentTarget.open) trackTour('demo_first_task', area); }}>
        <summary className="mx-4 mb-3 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 text-sm font-semibold text-ink-700 focus-visible:outline-2 focus-visible:outline-terra-700 sm:mx-6 [&::-webkit-details-marker]:hidden">
          {short ? t('site.tour.openStay', { guest: stay.guestName }) : t('site.tour.openProperty', { property: lease.property?.name })}
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-ink-700/15 px-4 py-4 sm:px-6">
          <dl className="grid grid-cols-2 gap-2">
            {dates.map(({ key, date }) => <div key={key} className="min-w-0">
              <dt className="text-sm text-ink-600">{t(`site.tour.dates.${key}`)}</dt>
              <dd className="font-medium"><time dateTime={date}>{day(date)}</time></dd>
            </div>)}
          </dl>
          {short && <p className="text-sm text-ink-700">{t('site.tour.checkInStep')}</p>}
          <div className="border-t border-ink-700/15 pt-4"><InvitationStep email={legal.email} area={area} /></div>
        </div>
      </details>
    </section>
  );
}
