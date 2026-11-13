import { useRef, useState, type ReactNode, type RefObject } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronDown, X } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { focusedElement, rememberOpenerIfNone, takeOpener } from '@/components/shared/detail-drawer/detail-opener';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { SheetHandle } from '@/components/ui/sheet';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { useMarketplaceEntry } from '@/queries/use-marketplace';
import type { MarketplaceEntryDetail } from '@/types';
import { marketplaceAction, marketplaceReturnTarget, parseMarketplaceEntry } from '../lib/marketplace-entry';
import { MARKETPLACE_ENTRY_PARAM, MARKETPLACE_MINE_PATH } from '../lib/marketplace-paths';
import { useMarketplaceProperty } from '../lib/marketplace-property';
import { MarketplaceStatusBadge } from './marketplace-status-badge';

/** A part of the detail card: its heading and what it says. */
function DetailSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`marketplace-detail-${id}`} className="space-y-1.5" data-testid={`marketplace-detail-${id}`}>
      <h3 id={`marketplace-detail-${id}`} className="text-sm font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A text the administrator or the server wrote: kept as plain text (its line breaks too), never as markup. */
function Prose({ children }: { children: ReactNode }) {
  return <p className="whitespace-pre-line break-words text-sm text-foreground/80">{children}</p>;
}

/** «Fatturato dal partner», as a sentence of its own. */
function sentence(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** The card of an integration, read from the data of the server: nothing is added to it, and what it does not say is «non specificato». */
function EntryDetail({ detail }: { detail: MarketplaceEntryDetail }) {
  const { t, i18n } = useTranslation();
  const notSpecified = t('marketplace.detail.notSpecified');
  const invoicerKey = `marketplace.card.invoicedBy.${detail.cost.invoicedBy}`;
  const invoicer = t(i18n.exists(invoicerKey) ? invoicerKey : 'marketplace.card.invoicedBy.Unknown');
  const requirements = detail.activation.requirements;

  return (
    <div className="space-y-6 pb-2" data-testid="marketplace-entry-detail">
      <div className="flex flex-wrap items-center gap-2">
        <MarketplaceStatusBadge status={detail.status} data-testid="marketplace-entry-detail-status" />
      </div>

      <DetailSection id="what" title={t('marketplace.detail.whatItDoes')}>
        <Prose>{detail.whatItDoes || notSpecified}</Prose>
      </DetailSection>

      <DetailSection id="audience" title={t('marketplace.detail.audience')}>
        <Prose>{detail.audience || notSpecified}</Prose>
      </DetailSection>

      <DetailSection id="requirements" title={t('marketplace.detail.requirements')}>
        {requirements.length > 0 ? (
          <ul role="list" className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
            {requirements.map((requirement) => (
              <li key={requirement.code} className="break-words">
                {requirement.text}
              </li>
            ))}
          </ul>
        ) : (
          <Prose>{t('marketplace.detail.noRequirements')}</Prose>
        )}
        {detail.activation.needsOctoratePanel ? (
          <p className="text-sm font-medium" data-testid="marketplace-detail-panel-step">
            {t('marketplace.detail.needsPanel')}
          </p>
        ) : null}
      </DetailSection>

      <DetailSection id="cost" title={t('marketplace.detail.cost')}>
        <Prose>{detail.cost.text || t('marketplace.detail.costUnknown')}</Prose>
        {detail.cost.invoicedBy !== 'Unknown' ? <Prose>{sentence(invoicer)}</Prose> : null}
      </DetailSection>

      <DetailSection id="data" title={t('marketplace.detail.dataShared')}>
        {detail.dataShared.length > 0 ? (
          <ul role="list" className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
            {detail.dataShared.map((line, index) => (
              <li key={`${index}-${line}`} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <Prose>{notSpecified}</Prose>
        )}
      </DetailSection>

      <DetailSection id="deactivation" title={t('marketplace.detail.deactivation')}>
        {detail.deactivation.text ? <Prose>{detail.deactivation.text}</Prose> : detail.deactivation.guided ? null : <Prose>{notSpecified}</Prose>}
        {detail.deactivation.guided ? <Prose>{t('marketplace.detail.deactivationGuided')}</Prose> : null}
      </DetailSection>

      {detail.faq.length > 0 ? (
        <DetailSection id="faq" title={t('marketplace.detail.faq')}>
          <ul role="list" className="list-none divide-y rounded-lg border">
            {detail.faq.map((item, index) => (
              <li key={`${index}-${item.q}`}>
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 break-words">{item.q}</span>
                    <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-foreground/70 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <div className="px-3 pb-3">
                    <Prose>{item.a}</Prose>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </DetailSection>
      ) : null}
    </div>
  );
}

/** The foot of the card: the one thing to do, or why it cannot be done. */
function EntryFooter({ detail, propertyId }: { detail: MarketplaceEntryDetail; propertyId: string | undefined }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const action = marketplaceAction(
    { kind: detail.kind, code: detail.code, status: detail.status, canActivate: detail.actions.canActivate },
    propertyId,
    marketplaceReturnTarget(location),
    detail.activation.type,
  );
  // «Gestisci» leads to the Active tab: on the Active tab itself (where the card is also opened from) it would lead to the page the person is on and only shut the card, so there is no foot there.
  if (action?.kind === 'manage' && location.pathname === MARKETPLACE_MINE_PATH) return null;

  // The server says why it cannot be activated; a reason this page has no text for is said in general words.
  const reasonKey = `marketplace.detail.reason.${detail.actions.reason}`;
  const reason = t(detail.actions.reason && i18n.exists(reasonKey) ? reasonKey : 'marketplace.detail.reason.unknown');

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3 md:px-6" data-testid="marketplace-entry-footer">
      {action ? (
        <Button asChild variant={action.kind === 'manage' ? 'outline' : 'default'}>
          <Link to={action.to} data-testid="marketplace-entry-action">
            {t(`marketplace.card.${action.kind}`)}
          </Link>
        </Button>
      ) : (
        <p className="min-w-0 flex-1 text-sm text-foreground/80" data-testid="marketplace-entry-reason">
          {reason}
        </p>
      )}
    </div>
  );
}

/**
 * The inside of the drawer: the title, the card (or the state it is in) and its foot. It reads the entry, so it is mounted only while the
 * drawer is open: a closed drawer asks for nothing.
 */
function EntryPanelContent({ kind, code, bodyRef }: { kind: string; code: string; bodyRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation();
  const { property } = useMarketplaceProperty();
  const entry = useMarketplaceEntry(kind, code, property?.id);

  const detail = entry.data;
  // The card is not there for this person (a partner their plan or country does not allow, a code that does not exist): said as such.
  const notAvailable = !detail && entry.isError && getHttpStatus(entry.error) === 404;

  return (
    <>
      {/* `pr-16`: room for the close button, which is 44 px wide and sits over the right corner. */}
      <div className="shrink-0 px-4 pb-3 pr-16 md:pb-4 md:pl-6 md:pr-16 md:pt-6">
        <DialogTitle className="break-words text-lg leading-snug">{detail?.name ?? t('marketplace.detail.fallbackTitle')}</DialogTitle>
      </div>
      <div
        ref={bodyRef}
        tabIndex={-1}
        data-testid="marketplace-entry-drawer-body"
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain break-words px-4 pb-6 outline-none md:px-6"
      >
        {detail ? (
          <EntryDetail detail={detail} />
        ) : notAvailable ? (
          <div role="status" className="space-y-1 py-4" data-testid="marketplace-entry-not-found">
            <p className="font-semibold">{t('marketplace.detail.notFound')}</p>
            <p className="text-sm text-foreground/70">{t('marketplace.detail.notFoundDescription')}</p>
          </div>
        ) : entry.isError ? (
          <ErrorState title={t('marketplace.detail.loadError')} error={entry.error} onRetry={() => void entry.refetch()} testId="marketplace-entry-error" />
        ) : (
          <SkeletonLine lines={5} label={t('marketplace.detail.loading')} />
        )}
      </div>
      {detail ? <EntryFooter detail={detail} propertyId={property?.id} /> : null}
    </>
  );
}

/**
 * One element, two shapes, as the detail drawer of the app (UI-15): a sheet from the bottom edge under `md`, a panel at the right from
 * `md` up. The focus is trapped inside; Esc, a press outside and the close button close it (the dialog tells the drawer, which takes the
 * parameter away); the focus goes back to the card that opened it.
 */
function EntryPanel({ kind, code }: { kind: string; code: string }) {
  const { t } = useTranslation();
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogPortal>
      <DialogOverlay className="bg-black/50 md:bg-black/80" />
      <DialogPrimitive.Content
        data-detail-sheet=""
        data-testid="marketplace-entry-drawer"
        // The name is the title (Radix points `aria-labelledby` at it); there is no description to read out.
        aria-describedby={undefined}
        // The container of the content takes the focus, not the first control: the arrow keys scroll what has the focus.
        onOpenAutoFocus={(event) => {
          rememberOpenerIfNone(focusedElement());
          event.preventDefault();
          bodyRef.current?.focus({ preventScroll: true });
        }}
        // The card that opened the drawer gets the focus back (Radix does it only for a trigger).
        onCloseAutoFocus={(event) => {
          const opener = takeOpener();
          if (!opener) return;
          event.preventDefault();
          opener.focus();
        }}
        className="fixed z-50 flex flex-col bg-background text-foreground shadow-lg outline-none max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[92dvh] max-md:rounded-t-2xl max-md:border-t max-md:pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-0 md:w-full md:max-w-xl md:border-l md:data-[state=open]:animate-in md:data-[state=open]:slide-in-from-right md:data-[state=open]:duration-300 md:data-[state=closed]:animate-out md:data-[state=closed]:slide-out-to-right md:data-[state=closed]:duration-200"
      >
        <SheetHandle className="md:hidden" onClose={() => closeRef.current?.click()} />
        <EntryPanelContent kind={kind} code={code} bodyRef={bodyRef} />
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
 * The detail card of an integration (MKT-02): a drawer that is open while the address has `?entry=<kind>:<code>`, so that it can be
 * shared and a link opens it on load. Closing it (the close button, Esc, a press outside) takes the parameter away and keeps the
 * others. It reads the entry for the property the page is about; the footer leads to the wizard, to the Active tab, or says why not.
 */
export function MarketplaceEntryDrawer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = parseMarketplaceEntry(searchParams.get(MARKETPLACE_ENTRY_PARAM));

  // The last card stays in place while the panel slides out: by then the address no longer names it.
  const [last, setLast] = useState(requested);
  if (requested && (last?.kind !== requested.kind || last.code !== requested.code)) setLast(requested);
  const shown = requested ?? last;

  const close = () =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(MARKETPLACE_ENTRY_PARAM);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  return (
    <Dialog
      open={requested !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {shown ? <EntryPanel key={`${shown.kind}:${shown.code}`} kind={shown.kind} code={shown.code} /> : null}
    </Dialog>
  );
}
