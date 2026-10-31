import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Building2, FileText, FolderOpen } from 'lucide-react';
import { leasesApi } from '@/api/leases.api';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { longRentPropertyPath } from '@/features/properties/long-rent/paths';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs, withJsonErrorBody } from '@/lib/file-download';
import type { LeaseDetail } from '@/types';
import { leaseSheetPath } from '../lib/lease-next-step';

/**
 * The ways to somewhere else that the menu «⋯» of the sheet of a lease offers (LR-03c), before the actions that change the lease (which
 * `useLeaseActions` gives, delete or end last): read the contract, open the property, go to the documents. None of them changes anything.
 *
 * The contract is the one every party signed once there is one; before that, the preview marked BOZZA, which the server gives to who may
 * sign (it carries the full fiscal codes). A draft ConcordatoFacile prepares, and a contract still to be imported, have no contract of
 * CasaZen to read, so the entry is not offered. There is no «Scrivi al conduttore» (decision LR-D23) and no archive of all the files in
 * one download: the documents are on their tab, each with its own.
 */
export function useLeaseSheetMenu(lease: LeaseDetail, { partnerDraft }: { partnerDraft: boolean }): PageHeaderMenuItem[] {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  // Without a workspace (a page rendered on its own) nothing is hidden: the server decides.
  const canSign = workspace ? workspace.hasPermission('long-rent', 'lease.sign') : true;
  const importedDraft = lease.status === 'Draft' && lease.origin === 'Imported';
  const hasSomethingToRead = lease.hasSignedPdf || (canSign && !partnerDraft && !importedDraft && lease.isConcordatoFacileSource !== true);

  async function readContract() {
    try {
      if (lease.hasSignedPdf) saveBlobAs(await leasesApi.downloadSignedContract(lease.id), `contratto-firmato-${lease.id}.pdf`);
      else saveBlobAs(await leasesApi.downloadContractPreview(lease.id), `bozza-contratto-${lease.id}.pdf`);
    } catch (error) {
      toast.error(getProblemMessage(await withJsonErrorBody(error), t) ?? t('leases.signature.downloadFailed'));
    }
  }

  const items: PageHeaderMenuItem[] = [];
  if (hasSomethingToRead) {
    items.push({
      label: t(lease.hasSignedPdf ? 'leaseSheet.menu.readContract' : 'leaseSheet.menu.readDraft'),
      icon: FileText,
      onClick: () => void readContract(),
      testId: 'lease-menu-read-contract',
    });
  }
  items.push({ label: t('leaseSheet.menu.openProperty'), icon: Building2, to: longRentPropertyPath(lease.propertyId), testId: 'lease-menu-open-property' });
  items.push({ label: t('leaseSheet.menu.documents'), icon: FolderOpen, to: leaseSheetPath(lease.id, 'documenti'), testId: 'lease-menu-documents' });
  return items;
}
