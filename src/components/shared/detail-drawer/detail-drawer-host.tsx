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

  useEffect(() => {
    if (!titleSlot) return;
    const sync = () => setUntitled((titleSlot.textContent ?? '').trim() === '');
    const observer = new MutationObserver(sync);
    observer.observe(titleSlot, { childList: true, subtree: true, characterData: true });
    queueMicrotask(sync);
    return () => observer.disconnect();
  }, [titleSlot]);

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
        aria-describedby={undefined}
        // The container of the content takes the focus, not the first control: a drawer that opens on "Accetta" must not have
        // it focused, and the arrow keys scroll what has the focus. Before that, whatever had the focus (the link that was
        // followed) is noted as the opener, if `open` did not say who it was.
        onOpenAutoFocus={(event) => {
          rememberOpenerIfNone(focusedElement());
          event.preventDefault();
          bodyRef.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          const opener = takeOpener();
          if (!opener) return;
          event.preventDefault();
          opener.focus();
        }}
        onInteractOutside={ignoreToasts}
        className={cn(
          'fixed z-50 flex flex-col bg-background text-foreground shadow-lg outline-none',
          'max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[92dvh] max-md:rounded-t-2xl max-md:border-t max-md:pb-[env(safe-area-inset-bottom)]',
          'md:inset-y-0 md:right-0 md:w-full md:border-l',
          def.width === 'wide' ? 'md:max-w-2xl' : 'md:max-w-xl',
          'md:data-[state=open]:animate-in md:data-[state=open]:slide-in-from-right md:data-[state=open]:duration-300',
          'md:data-[state=closed]:animate-out md:data-[state=closed]:slide-out-to-right md:data-[state=closed]:duration-200',
        )}
      >
        <SheetHandle className="md:hidden" onClose={() => closeRef.current?.click()} />
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
        <div
          key={thing}
          ref={bodyRef}
          tabIndex={-1}
          data-testid="detail-drawer-body"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain break-words px-4 pb-6 outline-none md:px-6"
        >
          <ErrorBoundary
            key={retryKey}
            fallbackRender={(error) => (
              <ErrorState
                title={t('detailDrawer.errorTitle')}
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
      {shown && def ? <DetailPanel shown={shown} def={def} close={close} /> : null}
    </Dialog>
  );
}
