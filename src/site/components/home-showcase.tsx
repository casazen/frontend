import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INTEGRATION_GROUPS, type IntegrationEntry, type IntegrationGroup, type IntegrationGroupId } from '../integrations-catalog';
import { Section } from './site-blocks';

/** The best known sales channels, in the order they are shown right under the first screen of the home page. */
const MAIN_CHANNELS = ['Booking.com', 'Airbnb', 'Vrbo', 'Expedia', 'Agoda', 'Hotels.com', 'HomeToGo', 'Holidu'] as const;

const OTA = INTEGRATION_GROUPS.find((group) => group.id === 'ota')?.entries ?? [];

/** Number of channels and tools of the whole catalogue, rounded down to the hundred ("oltre 300"). */
const CATALOGUE_SIZE = INTEGRATION_GROUPS.reduce((total, group) => total + group.entries.length, 0);
const CATALOGUE_ROUNDED = Math.floor(CATALOGUE_SIZE / 100) * 100;

/** Logos shown at once in a category: the rest opens in "Mostra tutti". */
const VISIBLE_LOGOS = 12;

function LogoTile({ entry, size = 'md' }: { entry: IntegrationEntry & { logo: string }; size?: 'md' | 'lg' }) {
  return (
    <li
      className={`flex items-center justify-center rounded-2xl border p-4 shadow-soft ${size === 'lg' ? 'h-24' : 'h-20'} ${
        entry.onDark ? 'border-ink-700 bg-ink-700' : 'border-ink-700/10 bg-white'
      }`}
    >
      <img src={entry.logo} alt={entry.name} title={entry.name} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
    </li>
  );
}

function hasLogo(entry: IntegrationEntry): entry is IntegrationEntry & { logo: string } {
  return Boolean(entry.logo);
}

/** The panel of one category: the first logos, then "Mostra tutti" with the rest of the logos and the names without a logo. */
function CategoryPanel({ group, active }: { group: IntegrationGroup; active: boolean }) {
  const { t } = useTranslation();
  const logos = group.entries.filter(hasLogo);
  const names = group.entries.filter((entry) => !entry.logo);
  const first = logos.slice(0, VISIBLE_LOGOS);
  const rest = logos.slice(VISIBLE_LOGOS);
  return (
    <div role="tabpanel" id={`channels-${group.id}`} aria-labelledby={`channels-tab-${group.id}`} hidden={!active}>
      <p className="mb-5 max-w-3xl text-ink-500">{t(`site.home.channels.groups.${group.id}.intro`)}</p>
      {first.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {first.map((entry) => (
            <LogoTile key={entry.name} entry={entry} />
          ))}
        </ul>
      )}
      {(rest.length > 0 || names.length > 0) && (
        <details className="group mt-5">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-ink-700/20 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 hover:border-terra-500 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">{t('site.home.channels.showAll', { count: group.entries.length })}</span>
            <span className="hidden group-open:inline">{t('site.home.channels.showLess')}</span>
            <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          {rest.length > 0 && (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {rest.map((entry) => (
                <LogoTile key={entry.name} entry={entry} />
              ))}
            </ul>
          )}
          {names.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {names.map((entry) => (
                <li key={entry.name} className="rounded-full bg-ink-100 px-3.5 py-1.5 text-sm font-medium text-ink-700">
                  {entry.name}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </div>
  );
}

/**
 * The main sales channels as logos, right under the first screen of the home page (and of the short-rental page): what CasaZen
 * connects to, at a glance. The whole catalogue is `ChannelsCatalogue`. The copy is in `site.home.channels.*`.
 */
export function ChannelsStrip() {
  const { t } = useTranslation();
  return (
    <section className="border-y border-ink-700/10 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
        <p className="text-center font-display text-xl font-semibold text-ink-800 sm:text-2xl">{t('site.home.channels.title')}</p>
        <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {MAIN_CHANNELS.map((name) => {
            const entry = OTA.find((candidate) => candidate.name === name);
            return entry && hasLogo(entry) ? <LogoTile key={name} entry={entry} /> : null;
          })}
        </ul>
        <p className="mt-6 text-center text-sm text-ink-500">
          {t('site.home.channels.more', { count: CATALOGUE_ROUNDED })}{' '}
          <a href="#integrazioni" className="font-semibold text-terra-700 underline underline-offset-4 hover:text-terra-800">
            {t('site.home.channels.seeAll')}
          </a>
        </p>
      </div>
    </section>
  );
}

/**
 * The whole catalogue of sales channels and tools by category, with "Mostra tutti" for the long ones (no page of its own: it
 * is a block of the home page). A name with no logo is shown as text. Without a script every panel but the first is hidden.
 */
export function ChannelsCatalogue() {
  const { t } = useTranslation();
  const [active, setActive] = useState<IntegrationGroupId>('ota');
  return (
    <Section title={t('site.home.channels.catalogTitle')} intro={t('site.home.channels.catalogIntro')} tone="cream">
      <div id="integrazioni" className="scroll-mt-24">
        <div role="tablist" aria-label={t('site.home.channels.tabs')} className="mb-6 flex flex-wrap gap-2">
          {INTEGRATION_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              id={`channels-tab-${group.id}`}
              aria-selected={active === group.id}
              aria-controls={`channels-${group.id}`}
              onClick={() => setActive(group.id)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-700 ${
                active === group.id
                  ? 'border-ink-800 bg-ink-800 text-white'
                  : 'border-ink-700/15 bg-white text-ink-700 hover:border-terra-500 hover:text-terra-800'
              }`}
            >
              {t(`site.home.channels.groups.${group.id}.title`)}
            </button>
          ))}
        </div>
        {INTEGRATION_GROUPS.map((group) => (
          <CategoryPanel key={group.id} group={group} active={active === group.id} />
        ))}
      </div>
      <p className="mt-8 max-w-3xl text-sm text-ink-500">{t('site.home.channels.note')}</p>
      <p className="mt-2 max-w-3xl text-xs text-ink-500">{t('site.home.channels.trademarks')}</p>
    </Section>
  );
}

/** A screenshot of the app in a browser window: the images are the app with example data, never a mock-up. */
export function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700/15 bg-white shadow-lift">
      <div aria-hidden="true" className="flex items-center gap-1.5 border-b border-ink-700/10 bg-cream-100 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-ink-200" />
        <span className="size-2.5 rounded-full bg-ink-200" />
        <span className="size-2.5 rounded-full bg-ink-200" />
      </div>
      <img src={src} alt={alt} width={1600} height={1000} loading="lazy" decoding="async" className="block h-auto w-full" />
    </div>
  );
}

type ExplorerKey = 'cockpit' | 'alloggiati' | 'cin' | 'checkin' | 'lease';

const EXPLORER_TABS: readonly { key: ExplorerKey; image?: string }[] = [
  { key: 'cockpit', image: '/site/cockpit.webp' },
  { key: 'alloggiati', image: '/site/alloggiati.webp' },
  { key: 'cin', image: '/site/cin.webp' },
  { key: 'checkin' },
  { key: 'lease', image: '/site/lease.webp' },
];

/** The guest check-in on a phone: a short muted loop, with its first frame as the poster (and for those who cannot play it). */
function PhoneVideo({ label }: { label: string }) {
  return (
    <div className="mx-auto w-[240px] overflow-hidden rounded-[2.2rem] border-[7px] border-ink-900 bg-ink-900 shadow-lift sm:w-[270px]">
      <video
        className="block h-auto w-full"
        width={390}
        height={780}
        poster="/site/checkin-poster.webp"
        aria-label={label}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source src="/site/checkin.webm" type="video/webm" />
        <source src="/site/checkin.mp4" type="video/mp4" />
      </video>
    </div>
  );
}

/**
 * "CasaZen al lavoro": a tab per flow (what to do today, Alloggiati Web, the CIN, the guest check-in, the lease), each with a
 * short text and the screen or the video of the app. Screens and video are recorded from the app with example data.
 * The copy is in `site.home.showcase.*`.
 */
export function ProductShowcase({ only }: { only?: readonly ExplorerKey[] } = {}) {
  const { t } = useTranslation();
  const tabs = only ? EXPLORER_TABS.filter((item) => only.includes(item.key)) : EXPLORER_TABS;
  const [active, setActive] = useState<ExplorerKey>(tabs[0].key);
  const tab = tabs.find((candidate) => candidate.key === active) ?? tabs[0];
  return (
    <Section title={t('site.home.showcase.title')} intro={t('site.home.showcase.intro')}>
      <div role="tablist" aria-label={t('site.home.showcase.title')} className="mb-8 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`showcase-tab-${item.key}`}
            aria-selected={active === item.key}
            aria-controls="showcase-panel"
            onClick={() => setActive(item.key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-700 ${
              active === item.key
                ? 'border-terra-600 bg-terra-600 text-white'
                : 'border-ink-700/15 bg-white text-ink-700 hover:border-terra-500 hover:text-terra-800'
            }`}
          >
            {t(`site.home.showcase.${item.key}.tab`)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="showcase-panel"
        aria-labelledby={`showcase-tab-${active}`}
        className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14"
      >
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight text-ink-800">{t(`site.home.showcase.${active}.title`)}</h3>
          <p className="mt-3 text-base leading-relaxed text-ink-500">{t(`site.home.showcase.${active}.text`)}</p>
        </div>
        {tab.image ? (
          <BrowserFrame src={tab.image} alt={t(`site.home.showcase.${active}.alt`)} />
        ) : (
          <div className="rounded-3xl bg-ink-700 p-8 sm:p-10">
            <PhoneVideo label={t(`site.home.showcase.${active}.alt`)} />
          </div>
        )}
      </div>
      <p className="mt-6 text-sm text-ink-500">{t('site.home.showcase.caption')}</p>
    </Section>
  );
}

/**
 * "Esempi di siti vetrina": the public site of a host (booking site) and the one of a supplier (showcase), recorded from the app
 * with example data (invented names). The copy is in `site.home.examples.*`.
 */
export function SiteExamples() {
  const { t } = useTranslation();
  const items = [
    { key: 'host', src: '/site/host-site.webp' },
    { key: 'supplier', src: '/site/supplier-site.webp' },
  ] as const;
  return (
    <Section title={t('site.home.examples.title')} intro={t('site.home.examples.intro')} tone="cream">
      <div className="grid gap-10 lg:grid-cols-2">
        {items.map((item) => (
          <figure key={item.key}>
            <BrowserFrame src={item.src} alt={t(`site.home.examples.${item.key}.alt`)} />
            <figcaption className="mt-4">
              <h3 className="font-display text-xl font-semibold text-ink-800">{t(`site.home.examples.${item.key}.title`)}</h3>
              <p className="mt-2 text-base leading-relaxed text-ink-500">{t(`site.home.examples.${item.key}.text`)}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-6 text-sm text-ink-500">{t('site.home.examples.caption')}</p>
    </Section>
  );
}
