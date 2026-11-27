import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deployEnv } from '@/config/deploy-env';
import { pluginDownloadUrl, type EmbedBase } from './embed-snippet';

/**
 * The plugin for WordPress, in four steps (E41/F03/US01, NF-147, NF-148, PLG-FE-CONSOLE, NF-200, NF-201): download and activate it, press «Connetti a CasaZen» in the plugin and confirm
 * (the console page `/app/connect/wordpress` links the site to the agency account, so the address and the slug fill in by themselves), write the domain in the plugin and create the two DNS records it
 * shows, create the pages with the guided setup. The download is always there: the ZIP of the channel of this build, whatever is set (`pluginDownloadUrl`). The manual set-up, for whoever does not
 * connect the plugin, is a collapsed note under the steps, with the address and the slug of the org.
 */
export function EmbedPluginSteps({ origin }: { origin: EmbedBase }) {
  const { t } = useTranslation();
  const titleId = useId();
  const downloadUrl = pluginDownloadUrl(import.meta.env.VITE_WORDPRESS_PLUGIN_URL, deployEnv);

  return (
    <section className="space-y-3" aria-labelledby={titleId} data-testid="embed-plugin">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={titleId} className="text-sm font-semibold">
          {t('embed.settings.plugin.title')}
        </h2>
        <Button asChild variant="outline" size="sm">
          <a href={downloadUrl} rel="noopener noreferrer" data-testid="embed-plugin-download">
            <Download aria-hidden="true" className="size-4" />
            {t('embed.settings.plugin.download')}
          </a>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('embed.settings.plugin.description')}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm" data-testid="embed-plugin-steps">
        <li>{t('embed.settings.plugin.step1')}</li>
        <li>{t('embed.settings.plugin.step2')}</li>
        <li>{t('embed.settings.plugin.step3')}</li>
        <li>{t('embed.settings.plugin.step4')}</li>
      </ol>
      <details className="text-sm" data-testid="embed-plugin-manual">
        <summary className="cursor-pointer rounded-sm py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11">
          {t('embed.settings.plugin.manual.title')}
        </summary>
        <div className="mt-2 space-y-1 text-muted-foreground">
          <p>{t('embed.settings.plugin.manual.description')}</p>
          <p className="break-words" data-testid="embed-plugin-address">
            {t('embed.settings.plugin.manual.address', { address: origin.base })}
          </p>
          <p className="break-words" data-testid="embed-plugin-slug">
            {origin.org ? t('embed.settings.plugin.manual.slug', { slug: origin.org }) : t('embed.settings.plugin.manual.slugNotNeeded')}
          </p>
        </div>
      </details>
    </section>
  );
}
