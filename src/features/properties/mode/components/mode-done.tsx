import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, CalendarOff, FileText, Mail, Sun } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import type { PropertyModeChange } from '@/types/property-mode.types';
import { listPathFor, propertyDetailPath, type ModeArea, type ModeEntry } from '../paths';
import { useDayLabel } from '../use-mode-labels';

interface ModeDoneProps {
  propertyId: string;
  propertyName: string;
  area: ModeArea;
  entry: ModeEntry;
  change: PropertyModeChange;
}

export function ModeDone({ propertyId, propertyName, area, entry, change }: ModeDoneProps) {
  const { t } = useTranslation();
  const dayLabel = useDayLabel();
  const toLong = change.toMode === 'Long';
  const date = dayLabel(change.effectiveDate);

  return (
    <WizardDone
      title={t('propertyMode.done.title')}
      description={t(toLong ? 'propertyMode.done.descriptionToLong' : 'propertyMode.done.descriptionToShort', { name: propertyName, date })}
      whatNext={
        toLong
          ? [
              { text: t('propertyMode.done.toLong.calendar', { date }), icon: CalendarOff },
              { text: t('propertyMode.done.toLong.section', { date }), icon: FileText },
              { text: t('propertyMode.done.email'), icon: Mail },
            ]
          : [
              { text: t('propertyMode.done.toShort.section', { date }), icon: Sun },
              { text: t('propertyMode.done.toShort.listing'), icon: ArrowRightLeft },
              { text: t('propertyMode.done.email'), icon: Mail },
            ]
      }
      primary={{ label: t('propertyMode.done.viewProperty'), to: propertyDetailPath(area, propertyId) }}
      secondary={{ label: t('propertyMode.done.backToList'), to: listPathFor(area, entry) }}
    />
  );
}
