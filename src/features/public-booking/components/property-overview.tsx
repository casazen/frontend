import { useTranslation } from 'react-i18next';
import { ChevronRight, Hammer, Sun } from 'lucide-react';
import { EnergyScale } from '@/features/public-booking/components/energy-scale';
import { PropertyDescription } from '@/features/public-booking/components/property-description';
import { PropertyFacts } from '@/features/public-booking/components/property-facts';
import { PropertyHighlights } from '@/features/public-booking/components/property-highlights';
import { HostAvatar } from '@/features/public-booking/components/host-card';
import { pickText } from '@/features/public-booking/lib/property-profile';
import type { PublicPropertyDetailDto } from '@/types';
import '@/features/public-booking/property-page.css';

interface PropertyOverviewProps {
  property: PublicPropertyDetailDto;
  description: string;
  hostLabel: string | null;
  hasHostCard: boolean;
}

export function PropertyOverview({ property, description, hostLabel, hasHostCard }: PropertyOverviewProps) {
  const { t, i18n } = useTranslation();
  const outdoor = pickText(property.outdoorNote, i18n.language);
  const renovated = typeof property.renovatedYear === 'number' && property.renovatedYear > 1800 ? property.renovatedYear : null;

  const extras: Array<{ key: string; icon: typeof Sun; text: string }> = [];
  if (outdoor) extras.push({ key: 'outdoor', icon: Sun, text: outdoor });
  if (renovated) extras.push({ key: 'renovated', icon: Hammer, text: t('publicProperty.overview.renovated', { year: renovated }) });

  return (
    <section id="panoramica" aria-label={t('publicProperty.sections.overview')} className="scroll-mt-20 space-y-8" data-testid="property-overview">
      <PropertyFacts property={property} />

      {hostLabel ? (
        hasHostCard ? (
          <a href="#host" className="pp-hostline" data-testid="property-hostline">
            <HostAvatar name={hostLabel} size={40} />
            <span className="min-w-0 flex-1">{t('publicProperty.overview.hostedBy', { host: hostLabel })}</span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0" aria-hidden />
          </a>
        ) : (
          <p className="pp-hostline" data-testid="property-hostline">
            <HostAvatar name={hostLabel} size={40} />
            <span className="min-w-0 flex-1">{t('publicProperty.overview.hostedBy', { host: hostLabel })}</span>
          </p>
        )
      ) : null}

      <PropertyHighlights highlights={property.highlights} />

      {description ? <PropertyDescription text={description} /> : null}

      {extras.length > 0 ? (
        <ul className="flex flex-wrap gap-x-7 gap-y-2 text-[0.95rem] text-[var(--cz-public-muted)]" data-testid="property-extras">
          {extras.map(({ key, icon: Icon, text }) => (
            <li key={key} className="inline-flex items-center gap-2">
              <Icon className="h-[19px] w-[19px] shrink-0 text-[var(--cz-public-ink)]" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <EnergyScale energyClass={property.energyClass} energyIndex={property.energyIndex} />
    </section>
  );
}
