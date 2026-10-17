import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { WeeklyHoursEditor } from '../components/weekly-hours-editor';
import { HOURS_SECTION_ID } from './hours-section';

/**
 * The weekly working hours on the profile: the same editor as the agenda (SP-07b), up to three bands a day on the Rome clock, saved with
 * its own button. It is one editor and not two so that a lunch break set in the agenda is not lost when the hours are saved from here.
 */
export function ProfileHours() {
  const { t } = useTranslation();

  return (
    <PlainSection id={HOURS_SECTION_ID} title={t('supplier.hoursTitle')} data-testid="supplier-working-hours">
      <p className="text-sm text-foreground/70">{t('supplier.hoursDescription')}</p>
      <WeeklyHoursEditor />
    </PlainSection>
  );
}
