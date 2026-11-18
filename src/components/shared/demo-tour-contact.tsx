import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supportConfig } from '@/config/support.config';
import { trackTour } from '@/lib/guided-demo/events';
import { isGuidedDemo } from '@/lib/guided-demo/session';
import type { TourArea } from '@/lib/guided-demo/scenario';
import { inviteHref, referralHref } from '@/site/site-links';

export function DemoTourContact({ area = 'short' }: { area?: TourArea }) {
  const { t } = useTranslation();
  const visible = isGuidedDemo();
  useEffect(() => {
    if (visible) trackTour('demo_first_task', area);
  }, [area, visible]);
  if (!visible) return null;
  const href = inviteHref(supportConfig.email, t('site.invite.subject'));
  return (
    <aside className="rounded-xl border bg-card p-4" aria-label={t('site.tour.contactTitle')}>
      <h2 className="font-semibold">{t('site.tour.contactTitle')}</h2>
      <p className="my-2 text-sm">{t(href ? 'site.tour.inviteText' : 'site.tour.referralText')}</p>
      <a className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
        href={href ?? referralHref(t('site.invite.subject'), t('site.tour.referralBody'))}
        onClick={() => trackTour(href ? 'invitation_mail_open' : 'referral_mail_open', area)}>
        {t(href ? 'site.invite.cta' : 'site.tour.referralCta')}
      </a>
    </aside>
  );
}
