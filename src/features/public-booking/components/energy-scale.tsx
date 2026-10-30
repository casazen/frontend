import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import '@/features/public-booking/property-page.css';

/** The classes of the energy certificate (APE), from the best to the worst, with a tint from green to red for the eye. */
const ENERGY_CLASSES = [
  { id: 'A4', tint: '#1a8a3e' },
  { id: 'A3', tint: '#3a9a2c' },
  { id: 'A2', tint: '#6aa81f' },
  { id: 'A1', tint: '#9ab51a' },
  { id: 'B', tint: '#c7bd14' },
  { id: 'C', tint: '#e8b312' },
  { id: 'D', tint: '#ec9114' },
  { id: 'E', tint: '#e8661a' },
  { id: 'F', tint: '#dc3f1c' },
  { id: 'G', tint: '#b9221a' },
] as const;

interface EnergyScaleProps {
  /** The class printed on the APE (`A4` to `G`). A value that is not one of them shows nothing: the system never guesses it. */
  energyClass: string | null | undefined;
  /** The global energy performance index in kWh/m² per year; only said together with the class. */
  energyIndex?: number | null;
}

/**
 * The energy class of the house on its scale (DB-04a, DB-D18): only when the host stated it, never invented and never worked out.
 * The class that applies is the one that is bigger and inverted, and the sentence under the scale says it in words, so it never
 * depends on the tint (the scale is drawn for the eye and is hidden from assistive technology).
 */
export function EnergyScale({ energyClass, energyIndex }: EnergyScaleProps) {
  const { t, i18n } = useTranslation();
  const current = ENERGY_CLASSES.find((entry) => entry.id === (energyClass ?? '').trim().toUpperCase());
  if (!current) return null;

  const index =
    typeof energyIndex === 'number' && Number.isFinite(energyIndex) && energyIndex > 0
      ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(energyIndex)
      : null;

  return (
    <section className="pp-energy space-y-3" aria-labelledby="property-energy-title" data-testid="property-energy">
      <h3 id="property-energy-title" className="public-display text-lg font-semibold">
        {t('publicProperty.energy.title')}
      </h3>
      <ul className="pp-energy__scale" aria-hidden="true">
        {ENERGY_CLASSES.map((entry) => (
          <li
            key={entry.id}
            className="pp-energy__step"
            style={{ '--pp-energy-tint': entry.tint } as CSSProperties}
            aria-current={entry.id === current.id ? 'true' : undefined}
          >
            {entry.id}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        {index
          ? t('publicProperty.energy.withIndex', { energyClass: current.id, index })
          : t('publicProperty.energy.classOnly', { energyClass: current.id })}
      </p>
      <p className="text-sm text-[var(--cz-public-muted)]">{t('publicProperty.energy.source')}</p>
    </section>
  );
}
