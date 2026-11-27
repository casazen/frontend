import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileSearch } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import type { ComplianceHandoff } from '@/types/compliance-handoff.types';
import { ComplianceDrawerDialog, type ComplianceDrawerState } from './compliance-drawer-dialog';
import { UnusableDestinationError, originKeyOf, returnRouteOf, type ComplianceDrawerTarget } from './compliance-drawer-model';
import { forgetReturn, openDestination, saveReturn, useReturnFocus } from './compliance-drawer-return';
import { useComplianceDrawerAvailable, useStartComplianceHandoff } from './use-compliance-drawer';

/** How long the tab is given to leave after «Continua la verifica» before the layer can be used again (a navigation the browser cancelled never comes). */
const LEAVING_GRACE_MS = 10_000;

interface ComplianceDrawerButtonProps {
  target: ComplianceDrawerTarget;
  /** Whom or what the button is about, to tell it from the same button of another row for a screen reader («Verifica nel tuo Cassetto Compliance: Mario Rossi»). */
  subject?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  testId?: string;
}

/**
 * «Verifica nel tuo Cassetto Compliance»: the one action that hands the host to the connected area to read an Alloggiati or ISTAT outcome,
 * from a single booking and from the rows of the compliance summary (CHK-15, E03/F05/US02). Pressing it asks the server to prepare the
 * handoff and opens the dialog «Cassetto Compliance»; only «Continua la verifica» leaves, in this same tab, after keeping the route and the
 * filters to come back to. When it is not offered (the connector is off, or the user cannot read bookings) it is not on the page at all.
 *
 * While the server prepares the handoff (and, for a stay of the summary that names no property, while the booking is read to know it) the button
 * is busy and ignores the press (`loading`: it keeps the focus), so a second press cannot ask for a second handoff (the server writes a line in
 * the activity log for each); it stays busy if the dialog was closed in the meantime, until the request has ended. A reading or a handoff that
 * fails is shown as a failure in the dialog, never as nothing.
 */
export function ComplianceDrawerButton({ target, subject, variant = 'outline', size = 'sm', className, testId = 'compliance-drawer-trigger' }: ComplianceDrawerButtonProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const available = useComplianceDrawerAvailable();
  const start = useStartComplianceHandoff();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [unusable, setUnusable] = useState(false);
  // The page and filters as they were when the host pressed the button: what the server was told and what the tab keeps.
  const comingFrom = useRef({ route: '', filters: '' });
  // The dialog is closed: whatever the server answers from now on is dropped, not kept.
  const dismissed = useRef(true);
  // «Continua la verifica» was pressed and the tab kept where to come back to; and the timer that gives the layer back if the tab does not leave.
  const kept = useRef(false);
  const leaveTimer = useRef<number | undefined>(undefined);
  const origin = originKeyOf(target);
  const focusRef = useReturnFocus<HTMLButtonElement>(origin);
  const { mutate, reset, isPending, isError, error, data } = start;

  // A stay whose property the row does not say is read first (inside the same request: the button stays busy through both).
  const ask = () =>
    mutate(
      { target, returnRoute: comingFrom.current },
      {
        onSettled: () => {
          if (dismissed.current) reset();
        },
      },
    );

  const begin = () => {
    comingFrom.current = returnRouteOf(location);
    dismissed.current = false;
    setUnusable(false);
    setLeaving(false);
    setOpen(true);
    ask();
  };

  // A request that is still out is left to end (the button stays busy until it does, so no second handoff is asked for) and its answer is dropped then.
  // A host who closes the layer after pressing «Continua la verifica» (the browser asked «Lasciare il sito?» and was told no) is not on their way any more:
  // what the tab kept to come back to is forgotten.
  const close = () => {
    window.clearTimeout(leaveTimer.current);
    if (kept.current) forgetReturn();
    kept.current = false;
    dismissed.current = true;
    setOpen(false);
    setLeaving(false);
    setUnusable(false);
    if (!isPending) reset();
  };

  const retry = () => {
    setUnusable(false);
    ask();
  };

  // «Continua la verifica»: keep where to come back to, then go, in this same tab. An address that cannot be opened keeps the host here. If the tab
  // has not left after a while (the navigation was cancelled) the layer is usable again: nothing is left waiting for a page that is not coming.
  const proceed = (handoff: ComplianceHandoff) => {
    const { route, filters } = comingFrom.current;
    kept.current = saveReturn({ handoffId: handoff.handoffId, route, filters, origin, expiresAt: handoff.expiresAt });
    setLeaving(true);
    if (!openDestination(handoff.destinationUrl)) {
      forgetReturn();
      kept.current = false;
      setLeaving(false);
      setUnusable(true);
      return;
    }
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setLeaving(false), LEAVING_GRACE_MS);
  };

  // The browser brings the page back from its memory (the back button of the host): the layer is still open, on its way out. It is closed, and
  // what the tab kept is left for the shell, which reads it once and restores it.
  useEffect(() => {
    if (!open) return undefined;
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      window.clearTimeout(leaveTimer.current);
      kept.current = false;
      dismissed.current = true;
      setOpen(false);
      setLeaving(false);
      setUnusable(false);
      reset();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [open, reset]);

  if (!available) return null;

  const state: ComplianceDrawerState = unusable
    ? { status: 'error', error: new UnusableDestinationError() }
    : isError
      ? { status: 'error', error }
      : data
        ? { status: 'ready', handoff: data }
        : { status: 'loading' };

  return (
    <>
      <Button
        ref={focusRef}
        type="button"
        variant={variant}
        size={size}
        className={className}
        loading={isPending}
        onClick={begin}
        aria-label={subject ? t('dashboard.row.actionFor', { action: t('compliance.drawer.trigger'), name: subject }) : undefined}
        data-testid={testId}
        data-compliance-origin={origin}
      >
        <FileSearch aria-hidden="true" className="size-4" />
        {t('compliance.drawer.trigger')}
      </Button>
      {open ? (
        <ComplianceDrawerDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          topic={target.topic}
          state={state}
          leaving={leaving}
          onContinue={proceed}
          onRetry={retry}
        />
      ) : null}
    </>
  );
}
