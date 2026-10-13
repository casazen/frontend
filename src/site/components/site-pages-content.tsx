import { useTranslation } from 'react-i18next';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { sitePageById } from '../site-pages';
import type { SiteLegal } from '../site-config';
import { signupHref, SUPPLIER_REGISTER_PATH } from '../site-links';
import { BulletList, CardGrid, FeatureCard, PageHeader, PrimaryLink, SecondaryLink, Section } from './site-blocks';

/**
 * Content of the pages of the public site (SEO-VETRINA). Every claim matches a feature that exists today (inventory of
 * 2026-10-13): no channel-manager API, no automatic Alloggiati Web transmission, no Ross1000/CIR in the product, no team,
 * mobile app or AI features, which are not available.
 */

export function HomePage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-indigo-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-700">{t('site.home.hero.eyebrow')}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{t('site.home.hero.title')}</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">{t('site.home.hero.subtitle')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryLink href={signupHref('home', 'hero')}>{t('site.home.hero.ctaSignup')}</PrimaryLink>
            <SecondaryLink href={sitePageById('features').path}>{t('site.home.hero.ctaFeatures')}</SecondaryLink>
          </div>
        </div>
      </section>

      <Section title={t('site.home.compliance.title')} intro={t('site.home.compliance.intro')}>
        <CardGrid>
          <FeatureCard title={t('site.home.compliance.cinTitle')} text={t('site.home.compliance.cinText')} />
          <FeatureCard title={t('site.home.compliance.alloggiatiTitle')} text={t('site.home.compliance.alloggiatiText')} />
          <FeatureCard title={t('site.home.compliance.checkinTitle')} text={t('site.home.compliance.checkinText')} />
          <FeatureCard title={t('site.home.compliance.touristTaxTitle')} text={t('site.home.compliance.touristTaxText')} />
          <FeatureCard title={t('site.home.compliance.wizardTitle')} text={t('site.home.compliance.wizardText')} />
        </CardGrid>
      </Section>

      <Section title={t('site.home.booking.title')} intro={t('site.home.booking.text')} muted>
        <p className="text-slate-600">{t('site.home.booking.domain')}</p>
      </Section>

      <Section title={t('site.home.operations.title')}>
        <CardGrid>
          <FeatureCard title={t('site.home.operations.calendarTitle')} text={t('site.home.operations.calendarText')} />
          <FeatureCard title={t('site.home.operations.suppliersTitle')} text={t('site.home.operations.suppliersText')} />
          <FeatureCard title={t('site.home.operations.fiscalTitle')} text={t('site.home.operations.fiscalText')} />
          <FeatureCard title={t('site.home.operations.longRentTitle')} text={t('site.home.operations.longRentText')} />
        </CardGrid>
      </Section>

      <Section title={t('site.home.guides.title')} intro={t('site.home.guides.text')} muted>
        <SecondaryLink href={SEO_HUB_PATH}>{t('site.home.guides.cta')}</SecondaryLink>
      </Section>

      <Section title={t('site.home.suppliersTeaser.title')} intro={t('site.home.suppliersTeaser.text')}>
        <SecondaryLink href={sitePageById('suppliers').path}>{t('site.home.suppliersTeaser.cta')}</SecondaryLink>
      </Section>

      <Section title={t('site.home.finalCta.title')} intro={t('site.home.finalCta.text')} muted>
        <PrimaryLink href={signupHref('home', 'final')}>{t('site.home.finalCta.cta')}</PrimaryLink>
      </Section>
    </>
  );
}

/** The groups of the features page: title key and item keys (`site.features.*`). */
const FEATURE_GROUPS: { title: string; items: string[] }[] = [
  {
    title: 'site.features.complianceTitle',
    items: [
      'site.features.complianceItem1',
      'site.features.complianceItem2',
      'site.features.complianceItem3',
      'site.features.complianceItem4',
    ],
  },
  {
    title: 'site.features.touristTaxTitle',
    items: ['site.features.touristTaxItem1', 'site.features.touristTaxItem2', 'site.features.touristTaxItem3'],
  },
  {
    title: 'site.features.bookingTitle',
    items: [
      'site.features.bookingItem1',
      'site.features.bookingItem2',
      'site.features.bookingItem3',
      'site.features.bookingItem4',
    ],
  },
  { title: 'site.features.calendarTitle', items: ['site.features.calendarItem1', 'site.features.calendarItem2'] },
  { title: 'site.features.suppliersTitle', items: ['site.features.suppliersItem1', 'site.features.suppliersItem2'] },
  { title: 'site.features.fiscalTitle', items: ['site.features.fiscalItem1', 'site.features.fiscalItem2'] },
  {
    title: 'site.features.longRentTitle',
    items: ['site.features.longRentItem1', 'site.features.longRentItem2', 'site.features.longRentItem3'],
  },
];

export function FeaturesPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('site.features.title')} intro={t('site.features.intro')} />
      <div className="mx-auto max-w-6xl px-4 py-14">
        <CardGrid>
          {FEATURE_GROUPS.map((group) => (
            <FeatureCard key={group.title} title={t(group.title)}>
              <BulletList items={group.items.map((key) => t(key))} />
            </FeatureCard>
          ))}
        </CardGrid>
      </div>
      <Section title={t('site.home.finalCta.title')} intro={t('site.home.finalCta.text')} muted>
        <PrimaryLink href={signupHref('features', 'final')}>{t('site.features.cta')}</PrimaryLink>
      </Section>
    </>
  );
}

const PLANS = ['starter', 'pro', 'scale'] as const;

const INCLUDED_KEYS = [1, 2, 3, 4, 5, 6, 7].map((index) => `site.pricing.included${index}`);

export function PricingPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('site.pricing.title')} intro={t('site.pricing.intro')} />
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan} className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="text-xl font-semibold">{t(`site.pricing.${plan}Name`)}</h3>
              <p className="mt-2 text-lg font-medium text-indigo-700">{t(`site.pricing.${plan}Limit`)}</p>
              <p className="mt-2 text-sm text-slate-600">{t(`site.pricing.${plan}Text`)}</p>
              <p className="mt-4 text-sm text-slate-600">{t(`site.pricing.${plan}Note`)}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-slate-600">{t('site.pricing.priceNote')}</p>
      </div>
      <Section title={t('site.pricing.includedTitle')} muted>
        <BulletList
          items={INCLUDED_KEYS.map((key) => t(key))}
        />
        <div className="mt-8">
          <PrimaryLink href={signupHref('pricing', 'final')}>{t('site.pricing.cta')}</PrimaryLink>
        </div>
      </Section>
    </>
  );
}

const SUPPLIER_STEPS = ['step1', 'step2', 'step3'] as const;

const SUPPLIER_CATEGORY_KEYS = [
  'categoryCleaning',
  'categoryMaintenance',
  'categoryPlumbing',
  'categoryLaundry',
  'categoryLinen',
  'categoryCheckIn',
  'categoryGardening',
  'categoryEvents',
  'categoryRental',
  'categoryExcursions',
] as const;

export function SuppliersPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('site.suppliers.title')} intro={t('site.suppliers.subtitle')}>
        <PrimaryLink href={SUPPLIER_REGISTER_PATH}>{t('site.suppliers.cta')}</PrimaryLink>
      </PageHeader>
      <Section title={t('site.suppliers.howTitle')}>
        <ol className="grid gap-4 md:grid-cols-3">
          {SUPPLIER_STEPS.map((step, index) => (
            <li key={step} className="rounded-lg border border-slate-200 bg-white p-5">
              <span className="text-sm font-semibold text-indigo-700">{index + 1}</span>
              <p className="mt-2 text-slate-700">{t(`site.suppliers.${step}`)}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section title={t('site.suppliers.featuresTitle')} muted>
        <CardGrid>
          <FeatureCard title={t('site.suppliers.inboxTitle')} text={t('site.suppliers.inboxText')} />
          <FeatureCard title={t('site.suppliers.availabilityTitle')} text={t('site.suppliers.availabilityText')} />
          <FeatureCard title={t('site.suppliers.showcaseTitle')} text={t('site.suppliers.showcaseText')} />
        </CardGrid>
      </Section>
      <Section title={t('site.suppliers.categoriesTitle')}>
        <ul className="flex flex-wrap gap-2">
          {SUPPLIER_CATEGORY_KEYS.map((key) => (
            <li key={key} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700">
              {t(`site.suppliers.${key}`)}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <PrimaryLink href={SUPPLIER_REGISTER_PATH}>{t('site.suppliers.cta')}</PrimaryLink>
        </div>
      </Section>
    </>
  );
}

export function AboutPage({ legal }: { legal: SiteLegal }) {
  const { t } = useTranslation();
  const rows: { label: string; value: string | null }[] = [
    { label: t('site.about.nameLabel'), value: legal.name },
    { label: t('site.about.vatIdLabel'), value: legal.vatId },
    { label: t('site.about.addressLabel'), value: legal.address },
  ];
  return (
    <>
      <PageHeader title={t('site.about.title')} intro={t('site.about.intro')} />
      <Section title={t('site.about.contactsTitle')} intro={t('site.about.approach')}>
        <dl className="grid gap-4 sm:grid-cols-2">
          {legal.email && (
            <div>
              <dt className="text-sm font-semibold">{t('site.about.emailLabel')}</dt>
              <dd className="mt-1">
                <a href={`mailto:${legal.email}`} className="text-indigo-700 hover:underline">
                  {legal.email}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </Section>
      <Section title={t('site.about.companyTitle')} muted>
        <dl className="grid gap-4 sm:grid-cols-3">
          {rows
            .filter((row) => row.value)
            .map((row) => (
              <div key={row.label}>
                <dt className="text-sm font-semibold">{row.label}</dt>
                <dd className="mt-1 text-slate-700">{row.value}</dd>
              </div>
            ))}
        </dl>
      </Section>
    </>
  );
}
