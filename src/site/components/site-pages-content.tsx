import {
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  Calculator,
  ClipboardList,
  Globe,
  Handshake,
  House,
  Inbox,
  Info,
  KeyRound,
  Landmark,
  ListChecks,
  Mail,
  ShieldCheck,
  Smartphone,
  Store,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CasaZenRing } from '@/components/brand/casazen-mark';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { sitePageById } from '../site-pages';
import type { SiteLegal } from '../site-config';
import { inviteHref } from '../site-links';
import { HomeSearch } from './home-search';
import { HeroArt, ThemeSwatches } from './site-art';
import {
  BulletList,
  CardGrid,
  CheckList,
  Compare,
  Eyebrow,
  Faq,
  FactsStrip,
  FeatureCard,
  IconTile,
  PageHeader,
  PrimaryLink,
  SecondaryLink,
  Section,
  Steps,
  type Tint,
} from './site-blocks';

/**
 * Content of the pages of the public site (SEO-VETRINA). Every claim matches a feature that exists today (inventory of
 * 2026-10-13): no channel-manager API, no automatic Alloggiati Web transmission, no Ross1000/CIR in the product, no team,
 * mobile app or AI features, which are not available. The figures of the strip under the hero are facts of the product, not
 * statistics: there are no customers, ratings or testimonials to quote, and none is invented.
 *
 * CasaZen is on private invitation (product owner, 2026-10-13): there is no sign-up button, no prices and no plans. The call
 * to action is "ask for an invitation", an e-mail to the configured contact address (`InviteCta`).
 *
 * The look is the brand's (the ink and the terracotta of the logo, the accents of the areas of the app for the tiles); the
 * icons and the illustrations are decoration, they add no text and no claim. The copy is in `site.*` of it.json and en.json.
 */

/** "Ask for an invitation": an e-mail link when the contact address is configured, otherwise only the notice. */
function InviteCta({ legal, variant = 'primary' }: { legal: SiteLegal; variant?: 'primary' | 'secondary' }) {
  const { t } = useTranslation();
  const href = inviteHref(legal.email, t('site.invite.subject'));
  if (!href) return <p className="text-ink-500">{t('site.invite.notice')}</p>;
  const Link = variant === 'primary' ? PrimaryLink : SecondaryLink;
  return <Link href={href}>{t('site.invite.cta')}</Link>;
}

/** The five checks of the "Adempimenti" section: their texts (`site.home.compliance.*`), icon and accent. */
const COMPLIANCE: { key: string; icon: LucideIcon; tint: Tint }[] = [
  { key: 'cin', icon: ShieldCheck, tint: 'terra' },
  { key: 'alloggiati', icon: ClipboardList, tint: 'savoia' },
  { key: 'checkin', icon: Smartphone, tint: 'salvia' },
  { key: 'touristTax', icon: Landmark, tint: 'ametista' },
  { key: 'wizard', icon: ListChecks, tint: 'ink' },
];

/** The four cards of "Il lavoro di tutti i giorni": the accents are the ones of the areas of the app. */
const OPERATIONS: { key: string; icon: LucideIcon; tint: Tint }[] = [
  { key: 'calendar', icon: CalendarDays, tint: 'terra' },
  { key: 'suppliers', icon: Handshake, tint: 'salvia' },
  { key: 'fiscal', icon: Calculator, tint: 'ametista' },
  { key: 'longRent', icon: KeyRound, tint: 'savoia' },
];

/** Who the site speaks to: the key of the texts (`site.home.audience.*`), icon and accent. */
const AUDIENCE: { key: string; icon: LucideIcon; tint: Tint }[] = [
  { key: 'host', icon: House, tint: 'terra' },
  { key: 'manager', icon: Building2, tint: 'ink' },
  { key: 'landlord', icon: KeyRound, tint: 'savoia' },
  { key: 'supplier', icon: Handshake, tint: 'salvia' },
];

const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

export function HomePage({ legal }: { legal: SiteLegal }) {
  const { t } = useTranslation();
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-terra-50 via-cream-50 to-cream-50">
        <CasaZenRing size={640} className="pointer-events-none absolute -left-44 -top-60 opacity-[0.06]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div>
            <Eyebrow>{t('site.home.hero.eyebrow')}</Eyebrow>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink-800 sm:text-5xl">
              <span className="block">{t('site.home.hero.title1')}</span>
              <span className="block">{t('site.home.hero.title2')}</span>
              <span className="block text-terra-700">{t('site.home.hero.title3')}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-500">{t('site.home.hero.subtitle')}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <InviteCta legal={legal} />
              <SecondaryLink href="#come-funziona">{t('site.home.hero.ctaHow')}</SecondaryLink>
            </div>
            {legal.email && <p className="mt-5 text-sm text-ink-500">{t('site.invite.notice')}</p>}
          </div>
          <HeroArt />
        </div>
      </section>

      <FactsStrip
        items={range(4).map((n) => ({
          value: t(`site.home.facts.item${n}Value`),
          label: t(`site.home.facts.item${n}Label`),
        }))}
      />

      <HomeSearch />

      <Section title={t('site.home.contrast.title')} intro={t('site.home.contrast.intro')} tone="cream">
        <Compare
          beforeTitle={t('site.home.contrast.beforeTitle')}
          before={range(4).map((n) => t(`site.home.contrast.before${n}`))}
          afterTitle={t('site.home.contrast.afterTitle')}
          after={range(4).map((n) => t(`site.home.contrast.after${n}`))}
        />
      </Section>

      <div id="come-funziona">
        <Section title={t('site.home.how.title')} intro={t('site.home.how.intro')}>
          <Steps
            items={range(3).map((n) => ({
              title: t(`site.home.how.step${n}Title`),
              text: t(`site.home.how.step${n}Text`),
            }))}
          />
        </Section>
      </div>

      <Section title={t('site.home.compliance.title')} intro={t('site.home.compliance.intro')} tone="cream">
        <CardGrid count={5}>
          {COMPLIANCE.map(({ key, icon, tint }) => (
            <FeatureCard
              key={key}
              icon={icon}
              tint={tint}
              title={t(`site.home.compliance.${key}Title`)}
              text={t(`site.home.compliance.${key}Text`)}
            />
          ))}
        </CardGrid>
      </Section>

      <section className="relative overflow-hidden bg-ink-700">
        <CasaZenRing size={460} color="#ff9b6b" className="pointer-events-none absolute -left-32 -bottom-40 opacity-[0.1]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t('site.home.booking.title')}</h2>
            <p className="mt-4 text-base leading-relaxed text-ink-100 sm:text-lg">{t('site.home.booking.text')}</p>
            <div className="mt-6">
              <CheckList items={range(4).map((n) => t(`site.home.booking.point${n}`))} onDark />
            </div>
            <p className="mt-6 text-ink-200">{t('site.home.booking.domain')}</p>
          </div>
          <ThemeSwatches />
        </div>
      </section>

      <Section title={t('site.home.operations.title')} intro={t('site.home.operations.intro')}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {OPERATIONS.map(({ key, icon, tint }) => (
            <FeatureCard
              key={key}
              icon={icon}
              tint={tint}
              title={t(`site.home.operations.${key}Title`)}
              text={t(`site.home.operations.${key}Text`)}
            />
          ))}
        </div>
      </Section>

      <Section title={t('site.home.audience.title')} intro={t('site.home.audience.intro')} tone="cream">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map(({ key, icon, tint }) => (
            <FeatureCard
              key={key}
              icon={icon}
              tint={tint}
              title={t(`site.home.audience.${key}Title`)}
              text={t(`site.home.audience.${key}Text`)}
              extra
            >
              {key === 'supplier' ? (
                <a
                  href={sitePageById('suppliers').path}
                  className="mt-4 inline-block text-[0.95rem] font-semibold text-terra-700 underline underline-offset-4 hover:text-terra-800"
                >
                  {t('site.home.audience.supplierCta')}
                </a>
              ) : null}
            </FeatureCard>
          ))}
        </div>
      </Section>

      <Section title={t('site.home.guides.title')} intro={t('site.home.guides.text')} icon={BookOpen} tint="terra">
        <SecondaryLink href={SEO_HUB_PATH}>{t('site.home.guides.cta')}</SecondaryLink>
      </Section>

      <Section title={t('site.home.faq.title')} intro={t('site.home.faq.intro')} tone="cream">
        <Faq
          items={range(8).map((n) => ({
            question: t(`site.home.faq.q${n}`),
            answer: t(`site.home.faq.a${n}`),
          }))}
        />
      </Section>

      <Section title={t('site.home.finalCta.title')} intro={t('site.home.finalCta.text')} tone="terra">
        <InviteCta legal={legal} />
      </Section>
    </>
  );
}

/** The groups of the features page: title key, intro key, item keys (`site.features.*`), icon and accent. */
const FEATURE_GROUPS: { title: string; intro: string; items: string[]; icon: LucideIcon; tint: Tint }[] = [
  {
    title: 'site.features.complianceTitle',
    intro: 'site.features.complianceIntro',
    icon: ShieldCheck,
    tint: 'terra',
    items: [
      'site.features.complianceItem1',
      'site.features.complianceItem2',
      'site.features.complianceItem3',
      'site.features.complianceItem4',
    ],
  },
  {
    title: 'site.features.touristTaxTitle',
    intro: 'site.features.touristTaxIntro',
    icon: Landmark,
    tint: 'ametista',
    items: ['site.features.touristTaxItem1', 'site.features.touristTaxItem2', 'site.features.touristTaxItem3'],
  },
  {
    title: 'site.features.bookingTitle',
    intro: 'site.features.bookingIntro',
    icon: Globe,
    tint: 'ink',
    items: [
      'site.features.bookingItem1',
      'site.features.bookingItem2',
      'site.features.bookingItem3',
      'site.features.bookingItem4',
    ],
  },
  {
    title: 'site.features.calendarTitle',
    intro: 'site.features.calendarIntro',
    icon: CalendarDays,
    tint: 'savoia',
    items: ['site.features.calendarItem1', 'site.features.calendarItem2'],
  },
  {
    title: 'site.features.suppliersTitle',
    intro: 'site.features.suppliersIntro',
    icon: Handshake,
    tint: 'salvia',
    items: ['site.features.suppliersItem1', 'site.features.suppliersItem2'],
  },
  {
    title: 'site.features.fiscalTitle',
    intro: 'site.features.fiscalIntro',
    icon: Calculator,
    tint: 'terra',
    items: ['site.features.fiscalItem1', 'site.features.fiscalItem2'],
  },
  {
    title: 'site.features.longRentTitle',
    intro: 'site.features.longRentIntro',
    icon: KeyRound,
    tint: 'savoia',
    items: ['site.features.longRentItem1', 'site.features.longRentItem2', 'site.features.longRentItem3'],
  },
];

export function FeaturesPage({ legal }: { legal: SiteLegal }) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('site.features.title')} intro={t('site.features.intro')} />
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
        <CardGrid>
          {FEATURE_GROUPS.map((group) => (
            <FeatureCard
              key={group.title}
              title={t(group.title)}
              text={t(group.intro)}
              icon={group.icon}
              tint={group.tint}
              heading="h2"
              extra
            >
              <BulletList items={group.items.map((key) => t(key))} />
            </FeatureCard>
          ))}
        </CardGrid>
        <div className="mt-10 rounded-3xl border border-terra-200 bg-terra-50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <IconTile icon={Info} tint="terra" />
            <h2 className="text-xl font-semibold text-ink-800">{t('site.features.noteTitle')}</h2>
          </div>
          <BulletList items={[t('site.features.note1'), t('site.features.note2'), t('site.features.note3')]} />
        </div>
      </div>
      <Section title={t('site.home.finalCta.title')} intro={t('site.home.finalCta.text')} tone="terra">
        <InviteCta legal={legal} />
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

/** The chips of the categories take the accents in turn. */
const CATEGORY_CHIP = [
  'bg-terra-100 text-terra-800',
  'bg-salvia-100 text-salvia-800',
  'bg-savoia-100 text-savoia-800',
  'bg-ametista-100 text-ametista-800',
  'bg-ink-100 text-ink-700',
];

export function SuppliersPage({ legal }: { legal: SiteLegal }) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('site.suppliers.title')} intro={t('site.suppliers.subtitle')}>
        <InviteCta legal={legal} />
      </PageHeader>
      <Section title={t('site.suppliers.howTitle')}>
        <Steps items={SUPPLIER_STEPS.map((step) => ({ text: t(`site.suppliers.${step}`) }))} />
      </Section>
      <Section title={t('site.suppliers.featuresTitle')} tone="salvia">
        <CardGrid count={3}>
          <FeatureCard icon={Inbox} tint="terra" title={t('site.suppliers.inboxTitle')} text={t('site.suppliers.inboxText')} />
          <FeatureCard
            icon={CalendarClock}
            tint="salvia"
            title={t('site.suppliers.availabilityTitle')}
            text={t('site.suppliers.availabilityText')}
          />
          <FeatureCard icon={Store} tint="savoia" title={t('site.suppliers.showcaseTitle')} text={t('site.suppliers.showcaseText')} />
        </CardGrid>
      </Section>
      <Section title={t('site.suppliers.faqTitle')} tone="cream">
        <Faq
          items={range(4).map((n) => ({
            question: t(`site.suppliers.q${n}`),
            answer: t(`site.suppliers.a${n}`),
          }))}
        />
      </Section>
      <Section title={t('site.suppliers.categoriesTitle')}>
        <ul className="flex flex-wrap gap-2.5">
          {SUPPLIER_CATEGORY_KEYS.map((key, index) => (
            <li key={key} className={`rounded-full px-4 py-1.5 text-sm font-medium ${CATEGORY_CHIP[index % CATEGORY_CHIP.length]}`}>
              {t(`site.suppliers.${key}`)}
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <InviteCta legal={legal} />
        </div>
      </Section>
    </>
  );
}

/** The three principles of the about page (`site.about.principle{n}Title|Text`): icon and accent. */
const PRINCIPLES: { icon: LucideIcon; tint: Tint }[] = [
  { icon: Landmark, tint: 'terra' },
  { icon: Wallet, tint: 'salvia' },
  { icon: ListChecks, tint: 'ametista' },
];

export function AboutPage({ legal }: { legal: SiteLegal }) {
  const { t } = useTranslation();
  const rows: { label: string; value: string | null }[] = [
    { label: t('site.about.nameLabel'), value: legal.name },
    { label: t('site.about.vatIdLabel'), value: legal.vatId },
    { label: t('site.about.addressLabel'), value: legal.address },
  ];
  const company = rows.filter((row) => row.value);
  return (
    <>
      <PageHeader title={t('site.about.title')} intro={t('site.about.intro')} />
      <Section title={t('site.about.principlesTitle')} intro={t('site.about.approach')}>
        <CardGrid count={3}>
          {PRINCIPLES.map(({ icon, tint }, index) => (
            <FeatureCard
              key={index}
              icon={icon}
              tint={tint}
              title={t(`site.about.principle${index + 1}Title`)}
              text={t(`site.about.principle${index + 1}Text`)}
            />
          ))}
        </CardGrid>
      </Section>
      <Section title={t('site.about.contactsTitle')} tone="cream">
        {legal.email ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex items-center gap-4 rounded-3xl border border-ink-700/10 bg-white p-6 shadow-soft">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-terra-100 text-terra-800">
                <Mail className="size-5" strokeWidth={1.9} />
              </span>
              <dl className="min-w-0">
                <div>
                  <dt className="text-sm font-semibold text-ink-800">{t('site.about.emailLabel')}</dt>
                  <dd className="mt-1 break-words">
                    <a href={`mailto:${legal.email}`} className="font-medium text-terra-700 underline underline-offset-4 hover:text-terra-800">
                      {legal.email}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <p className="text-ink-500">{t('site.invite.notice')}</p>
        )}
      </Section>
      {company.length > 0 && (
        <Section title={t('site.about.companyTitle')}>
          <dl className="grid gap-5 sm:grid-cols-3">
            {company.map((row) => (
              <div key={row.label} className="rounded-3xl border border-ink-700/10 bg-white p-6 shadow-soft">
                <dt className="text-sm font-semibold text-ink-500">{row.label}</dt>
                <dd className="mt-1 break-words text-lg font-medium text-ink-800">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
    </>
  );
}
