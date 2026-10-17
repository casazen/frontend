import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

/** A finger (or a pointer) must travel this far sideways, and more sideways than up or down, to count as a swipe. */
const SWIPE_DISTANCE = 48;

/** The round 44 px buttons over the black: close and the two arrows. */
const CONTROL =
  'inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

interface PhotoViewerProps {
  photos: string[];
  /** The photo on show. */
  index: number;
  /** Name of the property: the text alternative of every photo and the title of the viewer. */
  name: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** The element that takes the focus back when the viewer closes (the photo that opened it). */
  restoreFocusTo?: () => HTMLElement | null;
}

/**
 * Full-screen viewer of the photos of a property: arrows, Home and End, swipe, the counter and Esc. It is a modal dialog
 * (`Dialog`): the focus stays inside while it is open, the page behind is inert and the focus goes back to the photo that
 * opened it.
 */
export function PhotoViewer({ photos, index, name, onIndexChange, onClose, restoreFocusTo }: PhotoViewerProps) {
  const { t } = useTranslation();
  const total = photos.length;
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const go = useCallback((to: number) => onIndexChange(((to % total) + total) % total), [onIndexChange, total]);

  // The two neighbours are fetched before they are asked for, so the arrows answer at once.
  useEffect(() => {
    if (total < 2) return;
    for (const neighbour of [index - 1, index + 1]) {
      const image = new Image();
      image.src = photos[(neighbour + total) % total];
    }
  }, [index, photos, total]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (total < 2) return;
    if (event.key === 'ArrowRight') go(index + 1);
    else if (event.key === 'ArrowLeft') go(index - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(total - 1);
    else return;
    event.preventDefault();
  };

  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || total < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        sheetOnPhone={false}
        data-testid="property-viewer"
        onKeyDown={onKeyDown}
        onCloseAutoFocus={(event) => {
          const target = restoreFocusTo?.();
          if (!target) return;
          event.preventDefault();
          target.focus();
        }}
        // Over the whole screen, black; the default close button of the dialog is left out for the 44 px one of the bar.
        className="left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-black p-0 font-sans text-white sm:rounded-none [&>button]:hidden"
      >
        <DialogTitle className="sr-only">{t('publicProperty.viewer.title', { name })}</DialogTitle>
        <DialogDescription className="sr-only">{t('publicProperty.viewer.hint')}</DialogDescription>

        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p aria-hidden className="text-sm tabular-nums text-white/80">
            {total > 1 ? `${index + 1} / ${total}` : ''}
          </p>
          <DialogClose className={CONTROL}>
            <X className="h-5 w-5" aria-hidden />
            <span className="sr-only">{t('shared.close')}</span>
          </DialogClose>
        </div>

        <div
          className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-2 pb-4 sm:px-16"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
        >
          <img
            key={index}
            src={photos[index]}
            alt={t('publicSite.photoAlt', { name, index: index + 1 })}
            draggable={false}
            className="max-h-full max-w-full select-none object-contain"
          />
          {total > 1 ? (
            <>
              <button type="button" className={`${CONTROL} absolute left-2 top-1/2 -translate-y-1/2 sm:left-4`} onClick={() => go(index - 1)}>
                <ChevronLeft className="h-6 w-6" aria-hidden />
                <span className="sr-only">{t('publicProperty.viewer.previous')}</span>
              </button>
              <button type="button" className={`${CONTROL} absolute right-2 top-1/2 -translate-y-1/2 sm:right-4`} onClick={() => go(index + 1)}>
                <ChevronRight className="h-6 w-6" aria-hidden />
                <span className="sr-only">{t('publicProperty.viewer.next')}</span>
              </button>
            </>
          ) : null}
        </div>

        <p className="sr-only" aria-live="polite">
          {t('publicProperty.viewer.position', { index: index + 1, total })}
        </p>
      </DialogContent>
    </Dialog>
  );
}
