import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { pluginDownloadUrl, type EmbedBase } from './embed-snippet';

/**
 * The plugin for WordPress, in three steps (E41/F03/US01, NF-147, NF-148): install and activate it, give it the address of CasaZen (and, with no domain of the agency's own, the
 * slug of the org), run its guided setup, which creates the pages «Prenota», «Check-in online» and «Area proprietari». The download link is the ZIP of the latest release, at the
 * address of `VITE_WORDPRESS_PLUGIN_URL`: there is no address in the code, so while the variable is not set (or is not an address on `https`) the link is not shown and the steps stand.
 */
export function EmbedPluginSteps({ origin }: { origin: EmbedBase }) {
  const { t } = useTranslation();
  const titleId = useId();
  const downloadUrl = pluginDownloadUrl(import.meta.env.VITE_WORDPRESS_PLUGIN_URL);

  return (
    <section className="space-y-3" aria-labelledby={titleId} data-testid="embed-plugin">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={titleId} className="text-sm font-semibold">
          {t('embed.settings.plugin.title')}
        </h2>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
            rel="noopener noreferrer"
            data-testid="embed-plugin-download"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            {t('embed.settings.plugin.download')}
          </a>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t('embed.settings.plugin.description')}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm" data-testid="embed-plugin-steps">
        <li>{t('embed.settings.plugin.step1')}</li>
        <li>{origin.org ? t('embed.settings.plugin.step2Slug', { address: origin.base, slug: origin.org }) : t('embed.settings.plugin.step2Own', { address: origin.base })}</li>
        <li>{t('embed.settings.plugin.step3')}</li>
      </ol>
    </section>
  );
}
