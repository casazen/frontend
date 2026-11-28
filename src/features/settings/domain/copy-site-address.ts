import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import type { OrgBookingSite } from './use-org-domain';

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
