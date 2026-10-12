type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "2 ore", "1 ora e 30 minuti", "45 minuti". */
export function formatWorkDuration(minutes: number, t: Translate): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return t('serviceRequest.durationMinutes', { count: rest });
  if (rest === 0) return t('serviceRequest.durationHours', { count: hours });
  return t('serviceRequest.durationHoursMinutes', {
    hours: t('serviceRequest.durationHours', { count: hours }),
    minutes: t('serviceRequest.durationMinutes', { count: rest }),
  });
}
