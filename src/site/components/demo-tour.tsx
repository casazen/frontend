import { useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { isDemoMode } from '@/config/demo.config';
import { getPublicSiteOrigin } from '@/config/public-site';
import { trackTour } from '@/lib/guided-demo/events';
import { sampleDay, sampleLease, type TourArea } from '@/lib/guided-demo/scenario';
import { tourEntry } from '@/lib/guided-demo/session';
import { invitationDestination } from '@/lib/host-invite-path';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
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
  if (isDemoMode) return null;
  const short = area === 'short';
  const stay = sampleDay(exampleDay).arrivals.items[0];
  const lease = sampleLease(exampleDay);
  const day = (value: string) => formatStayDate(value, i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const dates = short ? [day(stay.checkInDate), day(stay.checkOutDate)] : [day(lease.startDate), day(lease.endDate)];
  return (
    <section id="demo" className="scroll-mt-36 bg-cream-50 px-5 py-10 text-ink-800" aria-labelledby="tour-heading">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-ink-600">{t('site.tour.sampleDay', { day: day(exampleDay) })}</p>
        <h2 id="tour-heading" className="mt-2 font-display text-3xl font-semibold">{t(`site.tour.${area}Title`)}</h2>
        <details className="mt-5 rounded-2xl border border-ink-700/20 bg-white shadow-sm"
          onToggle={event => { if (event.currentTarget.open) trackTour('demo_first_task', area); }}>
          <summary className="cursor-pointer rounded-2xl p-5 font-semibold focus-visible:outline-2 focus-visible:outline-terra-700">
            {short ? t('site.tour.openStay', { guest: stay.guestName, property: stay.propertyName }) : t('site.tour.openProperty', { property: lease.property?.name })}
          </summary>
          <div className="space-y-4 border-t border-ink-700/15 p-5">
            <p className="text-ink-600">{dates.join(' – ')}</p>
            <h3 className="text-xl font-semibold">{t(short ? 'site.tour.checkInState' : 'site.tour.leaseState')}</h3>
            <p>{short ? t('site.tour.checkInStep') : t('site.tour.rentState', { rent: lease.monthlyRent })}</p>
            <div className="border-t border-ink-700/15 pt-4"><InvitationStep email={legal.email} area={area} /></div>
          </div>
        </details>
      </div>
    </section>
  );
}
