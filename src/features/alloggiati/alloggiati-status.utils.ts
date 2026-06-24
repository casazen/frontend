import i18n from '@/i18n/config';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';

// Status labels are resolved via getAlloggiatiStatusLabel() from @/lib/i18n-labels.
// See alloggiati.statusLabel.{key} entries in locale JSONs.

/** Returns an i18n-translated label for an Alloggiati Web report status. */
export function getAlloggiatiStatusLabel(status: AlloggiatiWebStatus, isOverdue = false): string {
  // This function is kept for backward compatibility with non-React consumers.
  // React components should use getAlloggiatiStatusLabel() from @/lib/i18n-labels
  // which takes a TFunction parameter.
  if (isOverdue) return i18n.t('alloggiati.statusLabel.Expired');
  return i18n.t(`alloggiati.statusLabel.${status}`);
}

// Badge variant map moved inline to alloggiati-status-badge.tsx
