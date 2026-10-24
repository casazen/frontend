import { useContext, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Ban, CalendarCheck, CalendarX2, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useModeChangeMenuItems } from '@/features/properties/mode/use-mode-entry';
import { holdForUndo } from '@/lib/hold-for-undo';
import { toastUndo } from '@/lib/toast-undo';
import {
  canMarkLeaseSentAgain,
  useLeaseLifecycleActions,
  useLeaseStage,
  useRemoveLeaseNotice,
  useRequestLeaseErasure,
  useRevokeLeaseSent,
} from '@/queries/use-lease-lifecycle';
import { leaseDraftDeleteKey } from '@/queries/use-leases';
import type { LeaseDetail, LeaseErasureResult } from '@/types';
import { ErasureResultDialog } from './erasure-result-dialog';
import { LEASE_ACTION_PARAM, availableLeaseActions, leaseActionOf, type LeaseAction } from './lifecycle-actions';
import type { LeaseSubject } from './lifecycle-format';
import { RecordNoticeDialog } from './record-notice-dialog';
import { SwitchToShortDialog } from './switch-to-short-dialog';
import { TerminateLeaseDialog } from './terminate-lease-dialog';

const LEASES_PATH = '/app/long-rent/leases';

export interface LeaseActions {
  /** The entries of the menu «⋯» of the sheet, for the stage the lease is in; the one that destroys comes last, apart. */
  menu: PageHeaderMenuItem[];
  /** The windows of the actions: put them once on the sheet. They open from the menu and from the address (`?azione=`). */
  dialogs: ReactNode;
  /** Opens the request to erase the data of the people of the lease; `undefined` for who may not make it. */
  requestErasure: (() => void) | undefined;
}

/**
 * The actions of the life of a lease on its sheet (LR-10): delete the draft, take back the download for the signature, record a notice
 * and take it back, end the lease early, move on to short rent, and ask for the data of its people to be erased. Each opens from the
 * menu «⋯» or from the address (`?azione=elimina-bozza`, `annulla-firma`, `disdetta`, `togli-disdetta`, `termina`, `passa-a-breve`,
 * `cancellazione-dati`: a link from anywhere lands on the window) and the address is cleaned when the window closes. What is offered follows the stage the server gives the lease
 * (`useLeaseStage`) and the permissions of the person; the server is the last word and says no with a code that becomes a sentence.
 *
 * Which actions can be taken back, and how, is decided once here (decision LR-D32): the draft is held for the six seconds of «Annulla»
 * and deleted only when they pass (`holdForUndo`); taking the download back, and the notice, have a real inverse that «Annulla» runs;
 * the early termination and the erasure of data have none and say so with their words, not with a toast that promises it.
 */
export function useLeaseActions(lease: LeaseDetail, subject: LeaseSubject): LeaseActions {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = useContext(WorkspaceContext);
  const stage = useLeaseStage(lease);
  const modeEntry = useModeChangeMenuItems('long-rent', lease.propertyId);
  const lifecycle = useLeaseLifecycleActions();
  const revokeSent = useRevokeLeaseSent();
  const removeNotice = useRemoveLeaseNotice();
  const requestErasure = useRequestLeaseErasure();
  const [erasureResult, setErasureResult] = useState<LeaseErasureResult | null>(null);
  // Once the draft is on its way to deletion the person is taken to the list: closing its window must not take them back to the sheet.
  const leftTheSheet = useRef(false);

  const available = availableLeaseActions(lease, {
    stage,
    // Without a workspace (a page rendered on its own) nothing is hidden: the server decides.
    canManage: workspace ? workspace.hasPermission('long-rent', 'lease.create') : true,
    canChangeMode: modeEntry.length > 0,
  });
  const asked = leaseActionOf(searchParams.get(LEASE_ACTION_PARAM));
  const open = asked !== null && available[asked] ? asked : null;

  function go(action: LeaseAction | null) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (action === null) next.delete(LEASE_ACTION_PARAM);
        else next.set(LEASE_ACTION_PARAM, action);
        return next;
      },
      { replace: true },
    );
  }

  function close() {
    if (!leftTheSheet.current) go(null);
  }

  // ---- the draft: held back for the six seconds of «Annulla», deleted only when they pass ------------------------------------------------

  function deleteDraft() {
    const held = holdForUndo({
      key: leaseDraftDeleteKey(lease.id),
      message: t('leaseLifecycle.deleteDraft.held'),
      description: t('leaseLifecycle.deleteDraft.heldHint'),
      commit: async () => {
        await lifecycle.deleteDraft(lease.id);
        toast.success(t('leaseLifecycle.deleteDraft.done'));
      },
    });
    // The same draft is already on its way out: say it, and stay.
    if (!held) {
      toast.info(t('leaseLifecycle.alreadyHeld'));
      return;
    }
    leftTheSheet.current = true;
    navigate(LEASES_PATH, { replace: true });
  }

  // ---- the download for the signature: taken back, and «Annulla» downloads it again when the server would let it ----------------------------

  async function takeBackTheDownload() {
    // Asked first: once taken back, the lease does not say any more whether the download would be let through again.
    const canGoBack = await canMarkLeaseSentAgain(lease.id);
    try {
      await revokeSent.mutateAsync(lease.id);
    } catch {
      return; // The hook told why and read the lease again.
    }
    const message = t('leaseLifecycle.revokeSent.done');
    if (!canGoBack) {
      toast.success(message);
      return;
    }
    toastUndo(message, {
      undo: async () => {
        await lifecycle.markSent(lease.id);
        toast.info(t('leaseLifecycle.revokeSent.undone'));
      },
    });
  }

  // ---- the notice taken back later, from the menu (right after it was recorded «Annulla» does the same) ---------------------------------------

  async function takeTheNoticeBack() {
    try {
      await removeNotice.mutateAsync(lease.id);
    } catch {
      return; // The hook told why and read the lease again.
    }
    toast.success(t('leaseLifecycle.notice.removed'));
  }

  // ---- the data of the people: the answer is told in words and stays until it is closed ----------------------------------------------------

  async function eraseTheData() {
    try {
      setErasureResult(await requestErasure.mutateAsync(lease.id));
    } catch {
      // The hook told why.
    }
  }

  // ---- the menu «⋯»: what changes nothing for good first, what destroys last and apart --------------------------------------------------

  const gentle: PageHeaderMenuItem[] = [];
  if (available['annulla-firma']) {
    gentle.push({ label: t('leaseLifecycle.menu.revokeSent'), icon: Undo2, onClick: () => go('annulla-firma'), testId: 'lease-action-annulla-firma' });
  }
  if (available.disdetta) {
    gentle.push({ label: t('leaseLifecycle.menu.recordNotice'), icon: CalendarX2, onClick: () => go('disdetta'), testId: 'lease-action-disdetta' });
  }
  if (available['togli-disdetta']) {
    gentle.push({ label: t('leaseLifecycle.menu.takeNoticeBack'), icon: CalendarCheck, onClick: () => go('togli-disdetta'), testId: 'lease-action-togli-disdetta' });
  }
  if (available['passa-a-breve']) {
    gentle.push({ label: t('leaseLifecycle.menu.switchToShort'), icon: ArrowRightLeft, onClick: () => go('passa-a-breve'), testId: 'lease-action-passa-a-breve' });
  }
  const destructive: PageHeaderMenuItem[] = [];
  if (available['elimina-bozza']) {
    destructive.push({ label: t('leaseLifecycle.menu.deleteDraft'), icon: Trash2, danger: true, onClick: () => go('elimina-bozza'), testId: 'lease-action-elimina-bozza' });
  }
  if (available.termina) {
    destructive.push({ label: t('leaseLifecycle.menu.terminate'), icon: Ban, danger: true, onClick: () => go('termina'), testId: 'lease-action-termina' });
  }
  const menu: PageHeaderMenuItem[] = [...gentle, ...(gentle.length > 0 && destructive.length > 0 ? [{ separator: true } as const] : []), ...destructive];

  // ---- the windows ---------------------------------------------------------------------------------------------------------------------

  const dialogs = (
    <>
      <ConfirmationDialog
        open={open === 'elimina-bozza'}
        onOpenChange={(next) => !next && close()}
        title={t('leaseLifecycle.deleteDraft.title')}
        description={t('leaseLifecycle.deleteDraft.description', subject)}
        variant="destructive"
        confirmLabel={t('leaseLifecycle.deleteDraft.confirm')}
        consequences={[t('leaseLifecycle.deleteDraft.consequences.data'), t('leaseLifecycle.deleteDraft.consequences.undo')]}
        onConfirm={deleteDraft}
      />
      <ConfirmationDialog
        open={open === 'annulla-firma'}
        onOpenChange={(next) => !next && close()}
        title={t('leaseLifecycle.revokeSent.title')}
        description={t('leaseLifecycle.revokeSent.description', subject)}
        confirmLabel={t('leaseLifecycle.revokeSent.confirm')}
        cancelLabel={t('leaseLifecycle.revokeSent.cancel')}
        consequences={[t('leaseLifecycle.revokeSent.consequences.invalid'), t('leaseLifecycle.revokeSent.consequences.review')]}
        isLoading={revokeSent.isPending}
        onConfirm={takeBackTheDownload}
      />
      <RecordNoticeDialog open={open === 'disdetta'} lease={lease} subject={subject} onClose={close} />
      <ConfirmationDialog
        open={open === 'togli-disdetta'}
        onOpenChange={(next) => !next && close()}
        title={t('leaseLifecycle.takeNoticeBack.title')}
        description={t('leaseLifecycle.takeNoticeBack.description', subject)}
        confirmLabel={t('leaseLifecycle.takeNoticeBack.confirm')}
        cancelLabel={t('leaseLifecycle.takeNoticeBack.cancel')}
        consequences={[t('leaseLifecycle.takeNoticeBack.consequences.renews')]}
        isLoading={removeNotice.isPending}
        onConfirm={takeTheNoticeBack}
      />
      <TerminateLeaseDialog open={open === 'termina'} lease={lease} subject={subject} onClose={close} />
      <SwitchToShortDialog open={open === 'passa-a-breve'} lease={lease} subject={subject} onClose={close} />
      <ConfirmationDialog
        open={open === 'cancellazione-dati'}
        onOpenChange={(next) => !next && close()}
        title={t('leaseLifecycle.erasure.title')}
        description={t('leaseLifecycle.erasure.description', subject)}
        variant="destructive"
        confirmLabel={t('leaseLifecycle.erasure.confirm')}
        consequences={[
          t('leaseLifecycle.erasure.consequences.ended'),
          t('leaseLifecycle.erasure.consequences.notEnded'),
          t('leaseLifecycle.erasure.consequences.anotherLease'),
          t('leaseLifecycle.erasure.consequences.final'),
        ]}
        isLoading={requestErasure.isPending}
        onConfirm={eraseTheData}
      />
      <ErasureResultDialog result={erasureResult} onClose={() => setErasureResult(null)} />
    </>
  );

  return { menu, dialogs, requestErasure: available['cancellazione-dati'] ? () => go('cancellazione-dati') : undefined };
}
