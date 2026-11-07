import { useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { formatCurrency } from '@/lib/utils';
import { transferAwaitingConfirmation } from '@/api/financial-connections.api';
import {
  useFinancialConnectionsAccounts,
  useFinancialConnectionsSession,
  useStartStripeRentTransfer,
} from '@/queries/use-financial-connections';
import type { FinancialConnectionsAccount } from '@/types';

export interface FinancialConnectionsTransferProps {
  leaseId: string;
  dueId: string;
  amount: number;
  currency: string;
  /** Causale of the due. Sent with the transfer; an empty one is still sent so the API can keep its own. */
  reference: string;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `stripe-transfer-${Date.now()}`;
}

/**
 * One key per due, kept across clicks and across closing the dialog (that remounts this form). The same key again does not
 * start a second debit. A refused attempt is the only time a new key is minted, so the next press can be a new transfer.
 */
const transferKeys = new Map<string, string>();
/** Survives the dialog closing, which remounts the form and would otherwise drop the in-flight guard. */
const transfersInFlight = new Set<string>();

function dueKey(leaseId: string, dueId: string): string {
  return `${leaseId}:${dueId}`;
}

function idempotencyKeyFor(leaseId: string, dueId: string): string {
  const id = dueKey(leaseId, dueId);
  const existing = transferKeys.get(id);
  if (existing) return existing;
  const created = newIdempotencyKey();
  transferKeys.set(id, created);
  return created;
}

function rotateIdempotencyKey(leaseId: string, dueId: string): void {
  transferKeys.delete(dueKey(leaseId, dueId));
}

function accountLabel(account: FinancialConnectionsAccount): string {
  const tail = `···· ${account.last4}`;
  return account.displayName ? `${account.displayName} ${tail}` : `${account.institutionName} ${tail}`;
}

/**
 * Links a bank account with Stripe Financial Connections and starts a transfer for one open rent due.
 * Stripe draws the consent screen. This block never marks the due paid: that happens only when the due is read again
 * and the server says Stripe confirmed it.
 */
export function FinancialConnectionsTransfer({
  leaseId,
  dueId,
  amount,
  currency,
  reference,
  framed = true,
  forLandlord = false,
}: FinancialConnectionsTransferProps & { framed?: boolean; forLandlord?: boolean }) {
  const { t } = useTranslation();
  const accounts = useFinancialConnectionsAccounts();
  const session = useFinancialConnectionsSession();
  const transfer = useStartStripeRentTransfer(leaseId, dueId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [awaiting, setAwaiting] = useState(false);
  // `isPending` flips only after a render, so a second click in the same turn would pass it. This flips before the request.
  const starting = useRef(false);

  const linked = accounts.data ?? [];
  const selected = linked.find((account) => account.id === selectedId) ?? linked[0];
  const linkBusy = session.isPending;
  const startBusy = transfer.isPending;

  async function linkAccount() {
    setLinkError(null);
    try {
      const created = await session.mutateAsync();
      const stripe = await loadStripe(created.publishableKey);
      if (!stripe) {
        setLinkError(t('bankTransfer.noStripe'));
        return;
      }
      const result = await stripe.collectFinancialConnectionsAccounts({ clientSecret: created.clientSecret });
      if (result.error) {
        setLinkError(result.error.message ?? t('bankTransfer.stripeClosed'));
        return;
      }
      await accounts.refetch();
    } catch (error) {
      setLinkError(getProblemMessage(error, t) ?? t('bankTransfer.failed'));
    }
  }

  async function startTransfer() {
    const id = dueKey(leaseId, dueId);
    if (!selected || starting.current || transfersInFlight.has(id) || amount <= 0) return;
    starting.current = true;
    transfersInFlight.add(id);
    setAwaiting(false);
    try {
      const started = await transfer.mutateAsync({
        input: {
          financialConnectionsAccountId: selected.id,
          amount,
          reference,
        },
        idempotencyKey: idempotencyKeyFor(leaseId, dueId),
      });
      if (!transferAwaitingConfirmation(started.status)) {
        // The bank refused it: nothing was taken, and the same key would only replay that refusal.
        rotateIdempotencyKey(leaseId, dueId);
        setLinkError(t('bankTransfer.failed'));
        return;
      }
      setLinkError(null);
      setAwaiting(true);
    } catch (error) {
      // An answer that never came keeps the key, so the retry is the same transfer.
      setLinkError(getProblemMessage(error, t) ?? t('bankTransfer.failed'));
    } finally {
      starting.current = false;
      transfersInFlight.delete(id);
    }
  }

  const body = (
    <div className="space-y-3 text-sm" data-testid="stripe-bank-transfer">
        <p className="text-foreground/70">{t('bankTransfer.hint')}</p>
        <p data-testid="stripe-transfer-amount">
          <span className="text-foreground/70">{t('bankTransfer.amount')}</span> {formatCurrency(amount, currency)}
        </p>
        {reference ? (
          <p data-testid="stripe-transfer-reference">
            <span className="text-foreground/70">{t('bankTransfer.reference')}</span> {reference}
          </p>
        ) : (
          <p className="text-foreground/70" data-testid="stripe-transfer-reference-missing">
            {t('bankTransfer.noReference')}
          </p>
        )}

        {accounts.isLoading ? <p className="text-muted-foreground">{t('bankTransfer.loadingAccounts')}</p> : null}
        {accounts.isError ? (
          <p className="text-destructive" role="alert" data-testid="stripe-accounts-error">
            {getProblemMessage(accounts.error, t) ?? t('bankTransfer.loadError')}
          </p>
        ) : null}

        {linked.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="text-foreground/70">{t('bankTransfer.accountsLabel')}</legend>
            {linked.map((account) => (
              <label key={account.id} className="flex items-center gap-2" data-testid={`stripe-account-${account.id}`}>
                <input
                  type="radio"
                  name={`stripe-account-${dueId}`}
                  checked={selected?.id === account.id}
                  onChange={() => setSelectedId(account.id)}
                />
                {accountLabel(account)}
              </label>
            ))}
          </fieldset>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={linked.length > 0 ? 'outline' : 'default'}
            loading={linkBusy}
            onClick={() => void linkAccount()}
            data-testid="stripe-link-account"
          >
            {linked.length > 0 ? t('bankTransfer.linkAnother') : t('bankTransfer.link')}
          </Button>
          {selected && !awaiting ? (
            <Button type="button" loading={startBusy} onClick={() => void startTransfer()} data-testid="stripe-start-transfer">
              {t('bankTransfer.start')}
            </Button>
          ) : null}
        </div>

        {linkError ? (
          <p className="text-destructive" role="alert" data-testid="stripe-transfer-error">
            {linkError}
          </p>
        ) : null}
        {awaiting ? (
          <p role="status" data-testid="stripe-transfer-pending">
            {t('bankTransfer.pending')}
          </p>
        ) : null}
        <p className="text-foreground/70" data-testid="stripe-manual-stays">
          {forLandlord ? t('bankTransfer.manualStaysLandlord') : t('bankTransfer.manualStays')}
        </p>
    </div>
  );

  if (!framed) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4" aria-hidden="true" />
          {t('bankTransfer.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

interface StripeRentTransferDialogProps extends FinancialConnectionsTransferProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The same transfer, in a dialog, from a rent row the landlord already has open. */
export function StripeRentTransferDialog({ open, onOpenChange, ...transfer }: StripeRentTransferDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="stripe-rent-transfer-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('bankTransfer.title')}</DialogTitle>
          <DialogDescription>{t('bankTransfer.hint')}</DialogDescription>
        </DialogHeader>
        {open ? <FinancialConnectionsTransfer {...transfer} framed={false} forLandlord /> : null}
      </DialogContent>
    </Dialog>
  );
}
