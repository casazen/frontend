import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import type { OrgBookingSite } from './use-org-domain';

/**
 * Copies an address of the booking site (the org's, or one of its homes) and says what was copied (E27/F01/US02, NF-123). While the settings that tell the real address are still
 * on their way nothing is copied: it may change a moment later. «URL copiato» is said only when the address is the one of the site; when the settings could not be read, or are
 * the account administrator's to read, what went to the clipboard is the address of CasaZen and the host is told so. `false` when nothing was copied.
 */
export async function copySiteAddress(url: string, status: OrgBookingSite['status'], t: TFunction): Promise<boolean> {
  if (status === 'loading') return false;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    toast.error(t('directBooking.urlCopyError'));
    return false;
  }
  if (status === 'failed') toast.warning(t('directBooking.siteAddress.copiedFailed'));
  else if (status === 'restricted') toast.warning(t('directBooking.siteAddress.copiedRestricted'));
  else toast.success(t('directBooking.urlCopied'));
  return true;
}
