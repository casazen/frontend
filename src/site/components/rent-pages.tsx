import {
  CalendarDays,
  Calculator,
  FileSignature,
  Globe,
  Handshake,
  Landmark,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SiteLegal } from '../site-config';
import { sitePageById } from '../site-pages';
import { BrowserFrame, ChannelsCatalogue, ChannelsStrip, ProductShowcase } from './home-showcase';
import { BulletList, CardGrid, FeatureCard, PageHeader, Section, SecondaryLink, type Tint } from './site-blocks';
import { InviteCta } from './site-pages-content';

interface RentGroup {
  key: string;
  icon: LucideIcon;
  tint: Tint;
  items: readonly string[];
}

/** The groups of the short-rental page: the texts are those of the features page (`site.features.*`), one source for both. */
const SHORT_GROUPS: readonly RentGroup[] = [
  { key: 'compliance', icon: ShieldCheck, tint: 'terra', items: ['complianceItem1', 'complianceItem2', 'complianceItem3', 'complianceItem4'] },
  { key: 'touristTax', icon: Landmark, tint: 'ametista', items: ['touristTaxItem1', 'touristTaxItem2', 'touristTaxItem3'] },
  { key: 'booking', icon: Globe, tint: 'ink', items: ['bookingItem1', 'bookingItem2', 'bookingItem3', 'bookingItem4'] },
  { key: 'calendar', icon: CalendarDays, tint: 'savoia', items: ['calendarItem1', 'calendarItem2'] },
  { key: 'suppliers', icon: Handshake, tint: 'salvia', items: ['suppliersItem1', 'suppliersItem2'] },
];

/** The long-rental groups: the contract, the rent, the deadlines and the tax regime. */
const LONG_GROUPS: readonly RentGroup[] = [
  { key: 'contracts', icon: FileSignature, tint: 'savoia', items: ['longRentItem1'] },
  { key: 'rent', icon: Wallet, tint: 'salvia', items: ['longRentItem2'] },
  { key: 'deadlines', icon: CalendarDays, tint: 'terra', items: ['longRentItem3'] },
  { key: 'tax', icon: Calculator, tint: 'ametista', items: ['fiscalItem1', 'fiscalItem2'] },
];

/** Short rental: channels, what CasaZen does, the app at work and the booking site of a host. */
export function ShortRentPage({ legal }: { legal: SiteLegal }) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('site.shortRent.title')} intro={t('site.shortRent.intro')}>
        <SecondaryLink href={sitePageById('longRent').path}>{t('site.shortRent.otherLink')}</SecondaryLink>
      </PageHeader>
      <ChannelsStrip />
      <Section title={t('site.shortRent.featuresTitle')} intro={t('site.shortRent.featuresIntro')}>
        <CardGrid>
          {SHORT_GROUPS.map((group) => (
            <FeatureCard
              key={group.key}
              title={t(`site.features.${group.key}Title`)}
              text={t(`site.features.${group.key}Intro`)}
              icon={group.icon}
              tint={group.tint}
              heading="h3"
              extra
            >
              <BulletList items={group.items.map((item) => t(`site.features.${item}`))} />
            </FeatureCard>
          ))}
        </CardGrid>
      </Section>
      <ProductShowcase only={['cockpit', 'alloggiati', 'cin', 'checkin']} />
      <ChannelsCatalogue />
      <Section title={t('site.shortRent.siteTitle')} intro={t('site.shortRent.siteIntro')} tone="cream">
        <div className="max-w-4xl">
          <BrowserFrame src="/site/host-site.webp" alt={t('site.home.examples.host.alt')} />
          <p className="mt-4 text-sm text-ink-500">{t('site.home.examples.caption')}</p>
        </div>
      </Section>
      <Section title={t('site.home.finalCta.title')} intro={t('site.home.finalCta.text')} tone="terra">
        <InviteCta legal={legal} />
      </Section>
    </>
  );
}

/** Long rental: contracts, rent, deadlines and tax regime, with the contract sheet of the app. */
export function LongRentPage({ legal }: { legal: SiteLegal }) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('site.longRent.title')} intro={t('site.longRent.intro')}>
        <SecondaryLink href={sitePageById('shortRent').path}>{t('site.longRent.otherLink')}</SecondaryLink>
      </PageHeader>
      <Section title={t('site.longRent.featuresTitle')} intro={t('site.longRent.featuresIntro')}>
        <CardGrid>
          {LONG_GROUPS.map((group) => (
            <FeatureCard
              key={group.key}
              title={t(`site.longRent.groups.${group.key}.title`)}
              text={t(`site.longRent.groups.${group.key}.text`)}
              icon={group.icon}
              tint={group.tint}
              heading="h3"
              extra
            >
              <BulletList items={group.items.map((item) => t(`site.features.${item}`))} />
            </FeatureCard>
          ))}
        </CardGrid>
      </Section>
      <Section title={t('site.longRent.screenTitle')} intro={t('site.longRent.screenIntro')} tone="cream">
        <div className="max-w-4xl">
          <BrowserFrame src="/site/lease.webp" alt={t('site.longRent.screenAlt')} />
          <p className="mt-4 text-sm text-ink-500">{t('site.home.showcase.caption')}</p>
        </div>
      </Section>
      <Section title={t('site.home.finalCta.title')} intro={t('site.home.finalCta.text')} tone="terra">
        <InviteCta legal={legal} />
      </Section>
    </>
  );
}
