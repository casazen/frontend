import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SheetHandle } from "@/components/ui/sheet";
import "@/styles/sheet-bottom.css";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

/** Accessible (screen-reader only) label of the close button. */
function DialogCloseLabel() {
  const { t } = useTranslation();
  return <span className="sr-only">{t("shared.close")}</span>;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * The motion of a dialog in the middle of the screen: it fades and grows a little. (The slide that came with the classes of
 * shadcn is gone: Tailwind 4 centers with the `translate` property and the slide animates `transform`, so together they
 * threw the dialog in from the corner.)
 */
const CENTERED_MOTION =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";

/** The same, but only from `sm` up: under it the dialog is a sheet and moves as one (`styles/sheet-bottom.css`). */
const CENTERED_MOTION_FROM_SM =
  "sm:data-[state=open]:animate-in sm:data-[state=closed]:animate-out sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95";

/**
 * Under `sm` (a phone held upright) the dialog is a sheet that comes up from the bottom edge: the full width, rounded at
 * the top, as tall as its content up to most of the screen (and scrolling inside when there is more), clear of the home
 * indicator. It is the same element as the centered one, with other classes, so the content of a form does not remount
 * (and is not lost) if the phone is turned. A column of boxes instead of a grid: the bar at the top sticks while the
 * content scrolls, and a sticky box cannot leave the grid area it sits in. No padding above: the bar is the top of the
 * sheet (a sticky box cannot be pulled up into the padding either: it stays inside the content box of its parent).
 */
const SHEET_ON_PHONE =
  "max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-h-[92dvh] max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:rounded-t-2xl max-sm:border-b-0 max-sm:pt-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:flex max-sm:flex-col max-sm:[&>*]:shrink-0";

/**
 * Notes what has the focus at the moment the content of the dialog is put on the page. It is a component of its own, inside
 * the content, because `DialogContent` itself is there (and has run) all the time, open or not; this one is mounted with
 * the content. A layout effect runs before the passive effect with which Radix moves the focus into the dialog.
 */
function RememberOpener({ remember }: { remember: (opener: HTMLElement | null) => void }) {
  React.useLayoutEffect(() => {
    const active = document.activeElement;
    remember(active instanceof HTMLElement && active !== document.body ? active : null);
  }, [remember]);
  return null;
}

export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Under `sm` the dialog is a sheet from the bottom (see above); from `sm` up it is in the middle, as it has always been.
   * Turn it off for content that wants the whole screen on a phone as well, such as a photo viewer. Default: on.
   * (The sheet assumes the padding of the dialog, `p-6`: a dialog that changes it does not want to be a sheet.)
   */
  sheetOnPhone?: boolean;
  /** The grip at the top of the sheet of a phone, which can also be pulled down to close the sheet. Default: on. */
  handle?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, sheetOnPhone = true, handle = true, onCloseAutoFocus, ...props }, ref) => {
  const closeRef = React.useRef<HTMLButtonElement>(null);

  // What had the focus when the dialog opened (before Radix moves it inside): the button that opened it. Radix hands the focus
  // back on its own only to a `DialogTrigger`, and most dialogs of the app are opened by a button that sets state, so on close
  // the focus fell to the page: a keyboard user started again from the top.
  const opener = React.useRef<HTMLElement | null>(null);
  const remember = React.useCallback((element: HTMLElement | null) => {
    opener.current = element;
  }, []);

  const closeButton = (
    <DialogPrimitive.Close
      ref={closeRef}
      className={cn(
        // The icon is 16 px; the invisible `before` box makes the target 44 px for a finger.
        "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity before:absolute before:-inset-3.5 before:content-[''] hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
        // In the bar of the sheet the button is a 44 px disc.
        sheetOnPhone &&
          "max-sm:right-2 max-sm:top-0 max-sm:flex max-sm:h-11 max-sm:w-11 max-sm:items-center max-sm:justify-center max-sm:rounded-full max-sm:bg-muted max-sm:before:hidden"
      )}
    >
      <X className="h-4 w-4" />
      <DialogCloseLabel />
    </DialogPrimitive.Close>
  );

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-dialog-sheet={sheetOnPhone ? "" : undefined}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
          sheetOnPhone ? CENTERED_MOTION_FROM_SM : CENTERED_MOTION,
          sheetOnPhone && SHEET_ON_PHONE,
          className
        )}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          // After Radix has given the focus to the trigger, when there is one. When there is none, the focus is on the
          // page: it goes back to the button that opened the dialog, if that is still there.
          const back = opener.current;
          setTimeout(() => {
            if (back?.isConnected && (!document.activeElement || document.activeElement === document.body)) back.focus();
          }, 0);
        }}
        {...props}
      >
        <RememberOpener remember={remember} />
        {children}
        {sheetOnPhone ? (
          // Last in the markup (so the first field, not this button, takes the focus when the dialog opens) and first on
          // the screen: a bar that stays at the top while the content scrolls under it, with the grip and the close
          // button. Almost no room of its own: its negative bottom margin leaves the title close under the grip.
          // From `sm` up it is not a box at all (`contents`): the close button is where it has always been. It takes the
          // background of the dialog (`inherit`), so a dark one (the photo viewer of the public site) has a dark bar, not a white one.
          <div className="max-sm:sticky max-sm:top-0 max-sm:z-10 max-sm:order-first max-sm:-mb-1 max-sm:h-7 max-sm:bg-inherit sm:contents">
            {handle ? <SheetHandle className="sm:hidden" onClose={() => closeRef.current?.click()} /> : null}
            {closeButton}
          </div>
        ) : (
          closeButton
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  // Left aligned (it was centered on a phone) and clear of the close button of the sheet.
  <div className={cn("flex flex-col space-y-1.5 text-left max-sm:pr-10", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-foreground/70", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
