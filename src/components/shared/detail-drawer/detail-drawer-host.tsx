import { Suspense, createElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { SheetHandle } from '@/components/ui/sheet';
import { SkeletonLine } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { DetailRef } from '@/lib/detail-address';
import { isChunkLoadError } from './detail-chunk-error';
import { focusedElement, rememberOpenerIfNone, takeOpener } from './detail-opener';
import { getDetail, registerHost, type DetailDef } from './detail-registry';
import { useDetailDrawer } from './use-detail-drawer';
import './detail-drawer.css';

/** The attribute of `<body>` while a drawer is open: `detail-drawer.css` lets the toasts be pressed under it. */
const OPEN_ATTRIBUTE = 'data-detail-drawer-open';

/**
 * A toast is not part of the drawer, but a press on one is not a press "outside" it: it must not dismiss the drawer in which
 * the action that raised the toast ("Annulla") was taken. (While the drawer is open the toasts can be pressed at all only
 * because of `detail-drawer.css`.)
 */
function ignoreToasts(event: Event) {
  const target = event.target;
  if (target instanceof Element && target.closest('[data-sonner-toaster]')) event.preventDefault();
}

interface PanelProps {
  shown: DetailRef;
  def: DetailDef;
  close: () => void;
}

/**
 * One element, two shapes. Under `md` (48rem, where the shell stops being a phone) it is a sheet from the bottom edge, as tall
 * as its content up to most of the screen, with the handle that can be pulled down; from `md` on it is a panel at the right,
 * the full height. The shape is decided by CSS only, so turning a phone around (or resizing a window) does not mount the
 * content again: what is typed in it, and where it is scrolled, stays.
 */
function DetailPanel({ shown, def, close }: PanelProps) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // The element the title is drawn in. A state and not a ref: the content of a dialog is mounted a moment after the panel (Radix
  // draws a portal in a second pass), and a title that is replaced (a retry, another drawer) is a new element.
  const [titleSlot, setTitleSlot] = useState<HTMLSpanElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [untitled, setUntitled] = useState(false);

  const fallbackTitle = t('detailDrawer.fallbackTitle');
  const pageHref = def.pageHref?.(shown.id);
  const thing = `${shown.kind}:${shown.id}`;
  const retryKey = `${thing}:${attempt}`;

  const title = typeof def.title === 'string' ? t(def.title) : createElement(def.title, { id: shown.id });

  // A title that comes with the data draws nothing until the data has arrived, and a dialog with no name tells a screen reader
  // nothing. While the title is empty the generic name is there, for assistive technology only; it goes when the title comes.
  useEffect(() => {
    if (!titleSlot) return;
    const sync = () => setUntitled((titleSlot.textContent ?? '').trim() === '');
    const observer = new MutationObserver(sync);
    observer.observe(titleSlot, { childList: true, subtree: true, characterData: true });
    queueMicrotask(sync);
    return () => observer.disconnect();
  }, [titleSlot]);

  // Another drawer in the place of this one (`open` while one is open, or Back to an earlier one): the control that had the focus
  // is gone with its content, and Radix would leave the focus on the frame. The new content has its own container, at the top.
  useEffect(() => {
    bodyRef.current?.focus({ preventScroll: true });
  }, [thing]);

  return (
    <DialogPortal>
      <DialogOverlay className="bg-black/50 md:bg-black/80" />
      <DialogPrimitive.Content
        data-detail-sheet=""
        data-testid="detail-drawer"
        data-detail-kind={shown.kind}
        // The name is the title (Radix points `aria-labelledby` at it); there is no description to read out.
        aria-describedby={undefined}
        // The container of the content takes the focus, not the first control: a drawer that opens on "Accetta" must not have
        // it focused, and the arrow keys scroll what has the focus. Before that, whatever had the focus (the link that was
        // followed) is noted as the opener, if `open` did not say who it was.
        onOpenAutoFocus={(event) => {
          rememberOpenerIfNone(focusedElement());
          event.preventDefault();
          bodyRef.current?.focus({ preventScroll: true });
        }}
        // The button that opened the drawer gets the focus back (Radix does it only for a trigger).
        onCloseAutoFocus={(event) => {
          const opener = takeOpener();
          if (!opener) return;
          event.preventDefault();
          opener.focus();
        }}
        onInteractOutside={ignoreToasts}
        className={cn(
          'fixed z-50 flex flex-col bg-background text-foreground shadow-lg outline-none',
          // A sheet from the bottom edge, clear of the home indicator.
          'max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[92dvh] max-md:rounded-t-2xl max-md:border-t max-md:pb-[env(safe-area-inset-bottom)]',
          // A panel at the right. Its motion is the utilities' (a sheet from the bottom moves with `styles/sheet-bottom.css`).
          'md:inset-y-0 md:right-0 md:w-full md:border-l',
          def.width === 'wide' ? 'md:max-w-2xl' : 'md:max-w-xl',
          'md:data-[state=open]:animate-in md:data-[state=open]:slide-in-from-right md:data-[state=open]:duration-300',
          'md:data-[state=closed]:animate-out md:data-[state=closed]:slide-out-to-right md:data-[state=closed]:duration-200',
        )}
      >
        <SheetHandle className="md:hidden" onClose={() => closeRef.current?.click()} />
        {/* `pr-16`: room for the close button, which is 44 px wide and sits over the right corner. */}
        <div className="shrink-0 px-4 pb-3 pr-16 md:pb-4 md:pl-6 md:pr-16 md:pt-6">
          <ErrorBoundary
            key={retryKey}
            fallbackRender={() => <DialogTitle className="break-words text-lg leading-snug">{fallbackTitle}</DialogTitle>}
          >
            <DialogTitle className="break-words text-lg leading-snug">
              <span ref={setTitleSlot}>
                <Suspense fallback={fallbackTitle}>{title}</Suspense>
              </span>
              {untitled ? <span className="sr-only">{fallbackTitle}</span> : null}
            </DialogTitle>
          </ErrorBoundary>
        </div>
        {/* Keyed by what is shown: another drawer starts at the top, not where the last one was scrolled to. */}
        <div
          key={thing}
          ref={bodyRef}
          tabIndex={-1}
          data-testid="detail-drawer-body"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain break-words px-4 pb-6 outline-none md:px-6"
        >
          {/* A content that fails to draw must not take the page with it: the drawer says so and offers to try again. */}
          <ErrorBoundary
            key={retryKey}
            fallbackRender={(error) => (
              <ErrorState
                title={t('detailDrawer.errorTitle')}
                // A `lazy` content whose chunk did not load stays failed in place (React keeps it): the page is loaded again.
                onRetry={() => (isChunkLoadError(error) ? window.location.reload() : setAttempt((count) => count + 1))}
                testId="detail-drawer-error"
              />
            )}
          >
            <Suspense fallback={<SkeletonLine lines={5} label={t('detailDrawer.loading')} />}>
              {createElement(def.Content, { id: shown.id, close })}
            </Suspense>
          </ErrorBoundary>
        </div>
        {pageHref ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3 md:px-6">
            <Button asChild variant="outline">
              <Link to={pageHref}>{t('detailDrawer.openPage')}</Link>
            </Button>
          </div>
        ) : null}
        <DialogPrimitive.Close
          ref={closeRef}
          className="absolute right-2 top-1.5 flex size-11 items-center justify-center rounded-full opacity-70 transition-opacity hover:bg-muted hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:right-3 md:top-3"
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">{t('shared.close')}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/**
 * The one detail drawer of the app (UI-15), mounted once in the shell (`AppShellLayout`): it shows, for the kind and the id in
 * the address (`?detail=booking:3f2a`), what was registered with `registerDetail`. It is a modal dialog: the focus stays
 * inside, Esc and a press outside close it, and the focus goes back to the button that opened it.
 *
 * It draws nothing, and needs nothing but the router, while no drawer is open: a shell without a query client still renders.
 */
export function DetailDrawerHost() {
  const { current, close } = useDetailDrawer();
  const open = current !== null;

  // `open` refuses to add a history entry on a page that has no host to draw it. A layout effect, so that it is known before the
  // effects of the page run (a page may open a drawer as it mounts).
  useLayoutEffect(() => registerHost(), []);

  // While a drawer is open the page behind it is inert, toasts included (Radix, on `<body>`): the stylesheet gives the toasts back
  // their pointer events, so that "Annulla" can be pressed after an action taken in the drawer.
  useEffect(() => {
    if (!open) return;
    document.body.setAttribute(OPEN_ATTRIBUTE, '');
    return () => document.body.removeAttribute(OPEN_ATTRIBUTE);
  }, [open]);

  // The last drawer stays in place while the panel slides out: by then the address no longer says what it was.
  const [last, setLast] = useState<DetailRef | null>(current);
  if (current && (last?.kind !== current.kind || last.id !== current.id)) setLast(current);

  const shown = current ?? last;
  const def = shown ? getDetail(shown.kind) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      {/* Swapping one drawer for another keeps the panel and mounts the content again (its boundaries are keyed by what is shown). */}
      {shown && def ? <DetailPanel shown={shown} def={def} close={close} /> : null}
    </Dialog>
  );
}
