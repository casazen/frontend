import { useEffect, useState, useSyncExternalStore } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react';
import { transferAwaitingConfirmation } from '@/api/financial-connections.api';
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
import {
  useAttachOrgBankLink,
  useAttachRentBankLink,
  useCreateOrgBankLinkSession,
  useCreateRentBankLinkSession,
  useOrgBankLink,
  useStartOrgBankLinkPayment,
  useStartRentBankLinkPayment,
} from '@/queries/use-financial-connections';
import type { BankLinkAccount, BankLinkSession } from '@/types';
import { toBankLinkCents } from './bank-link-currency';
import {
  beginStripeTransfer,
  releaseAcceptedStripeTransfer,
  settleStripeTransfer,
  stripeTransferAttempt,
  subscribeStripeTransferAttempts,
} from './transfer-attempt';

export interface FinancialConnectionsTransferProps {
  /** Landlord uses the org bank-link. The tenant of a payment link uses the public rent-payment bank-link. */
  mode: 'org' | 'public';
  leaseId: string;
  dueId: string;
  amount: number;
  currency: string;
  /** Shown on the screen. The API does not take a reference: the due is the installment id. */
  reference: string;
  /** Payment-link token. Required for `mode: 'public'`. */
  token?: string;
  publishableKey?: string | null;
  /** Used when neither the session nor the caller already has the platform publishable key. */
  resolvePublishableKey?: () => Promise<string | null>;
  /**
   * The tenant due still shows the IBAN and “Ho effettuato il bonifico”. The landlord screens do not,
   * so they leave this off.
   */
  showManualTransfer?: boolean;
  forLandlord?: boolean;
  /** The due already failed: the previous attempt is over and a new transfer may start. */
  dueFailed?: boolean;
}

function keyFromEnv(): string | null {
  const value = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

async function publishableKeyFor(
  session: BankLinkSession,
  caller: string | null | undefined,
  resolve?: () => Promise<string | null>,
): Promise<string | null> {
  const known = session.publishableKey || caller || keyFromEnv();
  if (known && known.trim() !== '') return known.trim();
  const resolved = (await resolve?.()) ?? null;
  return resolved && resolved.trim() !== '' ? resolved.trim() : null;
}

function accountLabel(account: BankLinkAccount): string {
  const tail = account.last4 ? `···· ${account.last4}` : '';
  const name = account.displayName || account.institutionName || 'Conto';
  return tail ? `${name} ${tail}` : name;
}

/**
 * Links a bank account with Stripe Financial Connections and starts a USD debit for one open rent due.
 * Stripe draws the consent screen. This block never marks the due paid.
 */
export function FinancialConnectionsTransfer({
  mode,
  leaseId,
  dueId,
  amount,
  currency,
  reference,
  token,
  publishableKey,
  resolvePublishableKey,
  showManualTransfer = false,
  forLandlord = false,
  dueFailed = false,
}: FinancialConnectionsTransferProps) {
  const { t } = useTranslation();
  const orgAccount = useOrgBankLink(mode === 'org');
  const orgSession = useCreateOrgBankLinkSession();
  const rentSession = useCreateRentBankLinkSession();
  const attachOrg = useAttachOrgBankLink();
  const attachRent = useAttachRentBankLink();
  const startOrg = useStartOrgBankLinkPayment(leaseId);
  const startRent = useStartRentBankLinkPayment();
  const attempt = useSyncExternalStore(
    subscribeStripeTransferAttempts,
    () => stripeTransferAttempt(leaseId, dueId),
    () => stripeTransferAttempt(leaseId, dueId),
  );
  const [attached, setAttached] = useState<BankLinkAccount | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const awaiting = attempt.phase === 'accepted';
  const startBusy = attempt.phase === 'inflight';

  useEffect(() => {
    if (dueFailed) releaseAcceptedStripeTransfer(leaseId, dueId);
  }, [dueFailed, leaseId, dueId]);

  const stored = mode === 'org' ? orgAccount.data : undefined;
  const account = attached?.linked ? attached : stored?.linked ? stored : attached;
  const accountId = account?.linked ? account.accountId : null;
  const linkBusy = orgSession.isPending || rentSession.isPending || attachOrg.isPending || attachRent.isPending;

  async function linkAccount() {
    if (mode === 'public' && !token) return;
    setLinkError(null);
    try {
      const session = mode === 'org' ? await orgSession.mutateAsync() : await rentSession.mutateAsync({ installmentId: dueId, token: token ?? '' });
      const key = await publishableKeyFor(session, publishableKey, resolvePublishableKey);
      if (!key) {
        setLinkError(t('bankTransfer.noStripe'));
        return;
      }
      const stripe = await loadStripe(key);
      if (!stripe) {
        setLinkError(t('bankTransfer.noStripe'));
        return;
      }
      const result = await stripe.collectFinancialConnectionsAccounts({ clientSecret: session.clientSecret });
      if (result.error) {
        setLinkError(result.error.message ?? t('bankTransfer.stripeClosed'));
        return;
      }
      const linkedId = result.financialConnectionsSession?.accounts?.[0]?.id;
      if (!linkedId) {
        setLinkError(t('bankTransfer.stripeClosed'));
        return;
      }
      const saved = mode === 'org'
        ? await attachOrg.mutateAsync(linkedId)
        : await attachRent.mutateAsync({ installmentId: dueId, token: token ?? '', accountId: linkedId });
      setAttached(saved);
    } catch (error) {
      setLinkError(getProblemMessage(error, t) ?? t('bankTransfer.failed'));
    }
  }

  async function startTransfer() {
    if (!accountId || amount <= 0) return;
    if (mode === 'public' && !token) return;
    const idempotencyKey = beginStripeTransfer(leaseId, dueId);
    if (!idempotencyKey) return;
    setLinkError(null);
    try {
      const started = mode === 'org'
        ? await startOrg.mutateAsync({
            input: {
              amountCents: toBankLinkCents(amount),
              currency: currency.trim().toLowerCase(),
              leaseId,
              installmentId: dueId,
            },
            idempotencyKey,
          })
        : await startRent.mutateAsync({ installmentId: dueId, token: token ?? '', idempotencyKey });
      if (!transferAwaitingConfirmation(started)) {
        settleStripeTransfer(leaseId, dueId, 'failed');
        setLinkError(t('bankTransfer.failed'));
        return;
      }
      settleStripeTransfer(leaseId, dueId, 'accepted');
    } catch (error) {
      settleStripeTransfer(leaseId, dueId, 'retry');
      setLinkError(getProblemMessage(error, t) ?? t('bankTransfer.failed'));
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

      {mode === 'org' && orgAccount.isLoading ? <p className="text-muted-foreground">{t('bankTransfer.loadingAccounts')}</p> : null}
      {mode === 'org' && orgAccount.isError ? (
        <p className="text-destructive" role="alert" data-testid="stripe-accounts-error">
          {getProblemMessage(orgAccount.error, t) ?? t('bankTransfer.loadError')}
        </p>
      ) : null}

      {accountId ? (
        <p data-testid={`stripe-account-${accountId}`}>
          <span className="text-foreground/70">{t('bankTransfer.accountsLabel')}</span> {account ? accountLabel(account) : accountId}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={accountId ? 'outline' : 'default'}
          loading={linkBusy}
          onClick={() => void linkAccount()}
          data-testid="stripe-link-account"
        >
          {accountId ? t('bankTransfer.linkAnother') : t('bankTransfer.link')}
        </Button>
        {accountId && !awaiting ? (
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
      {showManualTransfer ? (
        <p className="text-foreground/70" data-testid="stripe-manual-stays">
          {forLandlord ? t('bankTransfer.manualStaysLandlord') : t('bankTransfer.manualStays')}
        </p>
      ) : null}
      {forLandlord && !showManualTransfer ? (
        <p className="text-foreground/70" data-testid="stripe-manual-stays">
          {t('bankTransfer.manualStaysLandlord')}
        </p>
      ) : null}
    </div>
  );

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

interface StripeRentTransferDialogProps extends Omit<FinancialConnectionsTransferProps, 'mode' | 'forLandlord'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The landlord transfer, from a rent row. The tenant declaration is not on this screen. */
export function StripeRentTransferDialog({ open, onOpenChange, ...transfer }: StripeRentTransferDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="stripe-rent-transfer-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('bankTransfer.title')}</DialogTitle>
          <DialogDescription>{t('bankTransfer.hint')}</DialogDescription>
        </DialogHeader>
        {open ? <FinancialConnectionsTransfer {...transfer} mode="org" forLandlord /> : null}
      </DialogContent>
    </Dialog>
  );
}
