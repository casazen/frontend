import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CasaZenMark, CasaZenRing } from '@/components/brand/casazen-mark';
import { PUBLIC_SITE_THEME_PALETTES } from '@/lib/public-site-themes';

/**
 * The illustrations of the public site (SEO-VETRINA): decoration only, so every one is `aria-hidden` and carries no claim
 * that the text does not make. The labels on the chips are the names of the checks of the "Adempimenti" section.
 */

function Chip({ className, dot, children }: { className: string; dot: string; children: ReactNode }) {
  return (
    <span
      className={`absolute flex items-center gap-2 rounded-full bg-white py-2 pl-2.5 pr-4 text-sm font-semibold text-ink-800 shadow-lg shadow-ink-900/15 ring-1 ring-ink-700/10 ${className}`}
    >
      <span className={`grid size-5 place-items-center rounded-full text-white ${dot}`}>
        <Check className="size-3" strokeWidth={3.5} />
      </span>
      {children}
    </span>
  );
}

/** The brand on a dark panel, with three of the checks of the product around it. */
export function HeroArt() {
  const { t } = useTranslation();
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-sm sm:max-w-md lg:max-w-none">
      <div className="relative aspect-square overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-ink-600 via-ink-700 to-ink-900 shadow-2xl shadow-ink-900/30">
        <CasaZenRing size={460} color="#ff9b6b" className="absolute -right-24 -top-24 opacity-[0.16]" />
        <div className="absolute inset-0 grid place-items-center">
          <CasaZenMark size={216} tone="dark" />
        </div>
      </div>
      <Chip className="left-3 top-8 sm:-left-5" dot="bg-terra-600">
        {t('site.home.compliance.cinTitle')}
      </Chip>
      <Chip className="right-3 top-[46%] sm:-right-5" dot="bg-salvia-600">
        {t('site.home.compliance.checkinTitle')}
      </Chip>
      <Chip className="bottom-8 left-6 sm:-left-1" dot="bg-ametista-600">
        {t('site.home.compliance.touristTaxTitle')}
      </Chip>
    </div>
  );
}

/**
 * The three looks of the booking site (`mare`, `montagna`, `urban`: the themes a host can choose), drawn with their own
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
