import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import '@/styles/sheet-bottom.css';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

/** Accessible (screen-reader only) label of the close button. */
function SheetCloseLabel() {
  const { t } = useTranslation();
  return <span className="sr-only">{t('shared.close')}</span>;
}

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

/** Pulled down this far, or less but fast enough, the sheet from the bottom lets go (px, px, px per ms). */
const DRAG_CLOSE_DISTANCE = 96;
const DRAG_FLICK_DISTANCE = 32;
const DRAG_FLICK_SPEED = 0.5;

/**
 * The handle of the sheet from the bottom: the grip that says it can be pulled, and the part of it that does what it says.
 * Dragging it down moves the sheet with the finger; letting go past a distance (or after a quick flick) closes the sheet,
 * letting go earlier brings it back. The sheet is moved by hand (its `transform`), not through React state: it follows
 * the finger at every pointer move and is mounted again, untouched, the next time it opens. The same can be done without
 * a pointer with Esc and the close button, which is why the handle is hidden from assistive technology.
 *
 * The dialog of a phone (`Dialog`, UI-07) is a sheet from the bottom too, and wears the same handle: what it moves is the
 * nearest element that says it is a sheet, `data-sheet-side` or `data-dialog-sheet`.
 */
function SheetHandle({ onClose, className }: { onClose: () => void; className?: string }) {
  const start = React.useRef<{ y: number; time: number } | null>(null);

  const place = (event: React.PointerEvent<HTMLElement>, distance: number, following: boolean) => {
    const sheet = event.currentTarget.closest<HTMLElement>('[data-sheet-side], [data-dialog-sheet]');
    if (!sheet) return;
    // `--sheet-drag` is where the closing animation starts from (`styles/sheet-bottom.css`).
    sheet.style.setProperty('--sheet-drag', `${distance}px`);
    sheet.style.transform = distance > 0 ? `translateY(${distance}px)` : '';
    sheet.style.transition = following ? 'none' : 'transform 200ms ease-out';
  };

  const release = (event: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const origin = start.current;
    if (!origin) return;
    start.current = null;
    const distance = cancelled ? 0 : Math.max(0, event.clientY - origin.y);
    const elapsed = Math.max(1, event.timeStamp - origin.time);
    const letGo =
      distance >= DRAG_CLOSE_DISTANCE || (distance >= DRAG_FLICK_DISTANCE && distance / elapsed >= DRAG_FLICK_SPEED);
    if (letGo) {
      place(event, distance, true);
      onClose();
    } else {
      place(event, 0, false);
    }
  };

  return (
    <div
      aria-hidden="true"
      data-testid="sheet-handle"
      className={cn(
        'flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing',
        className,
      )}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        start.current = { y: event.clientY, time: event.timeStamp };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (start.current) place(event, Math.max(0, event.clientY - start.current.y), true);
      }}
      onPointerUp={(event) => release(event, false)}
      onPointerCancel={(event) => release(event, true)}
    >
      <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
    </div>
  );
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { side?: 'left' | 'right' | 'bottom' }
>(({ side = 'left', className, children, ...props }, ref) => {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  return (
    <SheetPortal>
      <SheetOverlay data-sheet-overlay={side} className={cn(side === 'bottom' && 'bg-black/50')} />
      <SheetPrimitive.Content
        ref={ref}
        data-sheet-side={side}
        className={cn(
          'fixed z-50 flex h-full flex-col gap-4 border bg-background p-0 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
          side === 'left' &&
            'inset-y-0 left-0 w-3/4 max-w-sm data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          side === 'right' &&
            'inset-y-0 right-0 w-3/4 max-w-sm data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          // From the bottom edge, as tall as its content up to most of the screen, clear of the home indicator of a phone.
          side === 'bottom' &&
            'inset-x-0 bottom-0 h-auto max-h-[85dvh] gap-0 rounded-t-2xl border-b-0 pb-[env(safe-area-inset-bottom)]',
          className,
        )}
        {...props}
      >
        {side === 'bottom' ? <SheetHandle onClose={() => closeRef.current?.click()} /> : null}
        {children}
        <SheetPrimitive.Close
          ref={closeRef}
          className={cn(
            'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none',
            // A touch target: the handle is for the finger that can drag, this is for everyone else.
            side === 'bottom' && 'right-2 top-1.5 flex h-11 w-11 items-center justify-center rounded-full',
          )}
        >
          <X className="h-4 w-4" />
          <SheetCloseLabel />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 p-6 text-left', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-foreground', className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

/** What the sheet is about, in a sentence: a screen reader reads it when the sheet opens (the tip of `HelpTip`, UI-07). */
const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn('text-sm text-foreground/70', className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHandle,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
