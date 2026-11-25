import { useTranslation } from 'react-i18next';
import { PUBLIC_SITE_THEME_PALETTES } from '@/lib/public-site-themes';

/** The host workspace and guest check-in, using the product's own demo captures. */
export function HeroArt() {
  const { t } = useTranslation();
  return (
    <figure className="site-product-scene relative isolate mx-auto w-full max-w-2xl rounded-3xl bg-ink-800 px-[6%] pb-[13%] pt-[10%]">
      <img
        src="/site/cockpit.webp"
        alt={t('site.home.showcase.cockpit.alt')}
        width={1600}
        height={1000}
        fetchPriority="high"
        className="block w-full rounded-xl border border-ink-200 bg-white shadow-xl"
      />
      <img
        src="/site/checkin-poster.webp"
        alt={t('site.home.showcase.checkin.alt')}
        width={390}
        height={780}
        className="absolute bottom-[4%] right-[3%] w-[20%] rounded-[12%/6%] border-4 border-ink-900 bg-white shadow-xl"
      />
    </figure>
  );
}

/**
 * The three looks of the booking site (`terra`, `mare`, `citta`: the themes a host can choose), drawn with their own
 * colors as three small pages.
 */
export function ThemeSwatches() {
  const palettes = Object.values(PUBLIC_SITE_THEME_PALETTES);
  return (
    <div aria-hidden="true" className="grid grid-cols-3 gap-3 sm:gap-4">
      {palettes.map((palette) => (
        <div
          key={palette.primary}
          className="overflow-hidden rounded-2xl shadow-xl shadow-ink-900/30 ring-1 ring-white/20"
          style={{ backgroundColor: palette.bg }}
        >
          <div className="flex items-center gap-1.5 px-3 py-2.5" style={{ backgroundColor: palette.surface }}>
            <span className="size-2 rounded-full" style={{ backgroundColor: palette.primary }} />
            <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: palette.text, opacity: 0.35 }} />
          </div>
          <div className="space-y-2 p-3">
            <div className="h-14 rounded-lg sm:h-20" style={{ backgroundColor: palette.primary, opacity: 0.9 }} />
            <div className="h-1.5 w-4/5 rounded-full" style={{ backgroundColor: palette.text, opacity: 0.35 }} />
            <div className="h-1.5 w-3/5 rounded-full" style={{ backgroundColor: palette.text, opacity: 0.2 }} />
            <div className="h-5 w-12 rounded-full" style={{ backgroundColor: palette.primary }} />
          </div>
        </div>
      ))}
    </div>
  );
}
