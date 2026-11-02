import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { INTEGRATION_GROUPS, type IntegrationEntry } from '../integrations-catalog';
import type { SiteLegal } from '../site-config';
import { InviteCta } from './site-pages-content';
import { BulletList, IconTile, PageHeader, Section } from './site-blocks';

/** A logo on a tile: the logos have their own proportions, so they are contained, never cropped. Light ones go on a dark tile. */
function LogoTile({ entry }: { entry: IntegrationEntry & { logo: string } }) {
  return (
    <li
      className={`flex h-24 items-center justify-center rounded-2xl border p-4 shadow-soft ${
        entry.onDark ? 'border-ink-700 bg-ink-700' : 'border-ink-700/10 bg-white'
      }`}
    >
      <img
        src={entry.logo}
        alt={entry.name}
        title={entry.name}
        loading="lazy"
        decoding="async"
        className="max-h-full max-w-full object-contain"
      />
    </li>
  );
}

/** The best known channels have no logo to show: their name, large, on a tile of the same size as the logos. */
function NameTile({ entry }: { entry: IntegrationEntry }) {
  return (
    <li className="flex h-24 items-center justify-center rounded-2xl border border-terra-200 bg-terra-50 p-4 text-center font-display text-xl font-semibold text-ink-800 shadow-soft">
      {entry.name}
    </li>
  );
}

/**
 * "Integrazioni" (`/integrazioni`): the sales channels and the partner tools that can be connected to CasaZen, by group, with the
 * logo where there is one and the name otherwise. The copy is in `site.integrations.*` of it.json and en.json.
 */
export function IntegrationsPage({ legal }: { legal: SiteLegal }) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('site.integrations.title')} intro={t('site.integrations.intro')}>
        <nav aria-label={t('site.integrations.jump')} >
          <ul className="flex flex-wrap gap-2">
            {INTEGRATION_GROUPS.map((group) => (
              <li key={group.id}>
                <a
                  href={`#${group.id}`}
                  className="inline-block rounded-full border border-ink-700/15 bg-white px-4 py-1.5 text-sm font-medium text-ink-700 hover:border-terra-500 hover:text-terra-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-700"
                >
                  {t(`site.integrations.groups.${group.id}.title`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>
      <div className="mx-auto max-w-6xl px-5 pt-10">
        <div className="rounded-3xl border border-terra-200 bg-terra-50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <IconTile icon={Info} tint="terra" />
            <h2 className="text-xl font-semibold text-ink-800">{t('site.integrations.noteTitle')}</h2>
          </div>
          <BulletList items={[t('site.integrations.note1'), t('site.integrations.note2')]} />
        </div>
      </div>
      {INTEGRATION_GROUPS.map((group, index) => {
        const featured = group.entries.filter((entry) => entry.featured && !entry.logo);
        const withLogo = group.entries.filter((entry): entry is IntegrationEntry & { logo: string } => Boolean(entry.logo));
        const textOnly = group.entries.filter((entry) => !entry.logo && !entry.featured);
        const tiles = featured.length + withLogo.length;
        return (
          <div key={group.id} id={group.id} className="scroll-mt-24">
            <Section
              title={t(`site.integrations.groups.${group.id}.title`)}
              intro={t(`site.integrations.groups.${group.id}.intro`)}
              tone={index % 2 === 0 ? 'plain' : 'cream'}
            >
              {tiles > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {featured.map((entry) => (
                    <NameTile key={entry.name} entry={entry} />
                  ))}
                  {withLogo.map((entry) => (
                    <LogoTile key={entry.name} entry={entry} />
                  ))}
                </ul>
              )}
              {textOnly.length > 0 && (
                <ul className={`flex flex-wrap gap-2 ${tiles > 0 ? 'mt-6' : ''}`}>
                  {textOnly.map((entry) => (
                    <li key={entry.name} className="rounded-full bg-ink-100 px-3.5 py-1.5 text-sm font-medium text-ink-700">
                      {entry.name}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        );
      })}
      <Section title={t('site.integrations.cta.title')} intro={t('site.integrations.cta.text')} tone="terra">
        <InviteCta legal={legal} />
      </Section>
      <p className="mx-auto max-w-6xl px-5 py-8 text-sm text-ink-500">{t('site.integrations.trademarks')}</p>
    </>
  );
}
