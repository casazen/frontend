import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, CalendarOff, FileText, Mail, Sun } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import type { PropertyModeChange } from '@/types/property-mode.types';
import { listPathFor, propertyDetailPath, type ModeArea, type ModeEntry } from '../paths';

interface ModeDoneProps {
  propertyId: string;
  propertyName: string;
  /** The section the property is in until the day of the change: both buttons lead there (or to the account, when it began there). */
  area: ModeArea;
  entry: ModeEntry;
  change: PropertyModeChange;
}

/**
 * "What happens now" after the change is programmed. Only true things: what closes now, where the property will be and from
 * when, the e-mail, and that it can be withdrawn. The property is still in its old section, so "see the property" leads there:
 * from the day of the change the redirects of the property pages (#246) take whoever opens it to the new one.
 */
export function ModeDone({ propertyId, propertyName, area, entry, change }: ModeDoneProps) {
  const { t, i18n } = useTranslation();
  const toLong = change.toMode === 'Long';
  const date = formatStayDate(parseStayDate(change.effectiveDate), i18n.language);

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
