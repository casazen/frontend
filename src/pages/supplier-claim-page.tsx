import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { Home, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RolesPendingPanel } from '@/features/onboarding/components/roles-pending-panel';
import { useAuth } from '@/hooks/use-auth';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { SUPPLIER_HOME_ROUTE } from '@/lib/onboarding';
import {
  clearPendingSupplierClaim,
  readPendingSupplierClaim,
  SUPPLIER_CLAIM_PATH,
  type PendingSupplierClaim,
} from '@/lib/supplier-claim';
import { useClaimSupplier } from '@/queries/use-supplier';
import type { SupplierClaimResult } from '@/services/supplier-api';

function claimErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/** Claim errors after which the stored token is useless. */
const TOKEN_FINAL_CODES = new Set([
  'supplier_claim_invalid',
  'supplier_claim_expired',
  'supplier_claim_used',
  'supplier_account_already_linked',
]);

/**
 * `/register/claim` (SU-02, A4-02): links the signed-in account to the supplier profile registered without an
 * account, with the claim token kept by the registration page (or, without it, the email verified by Auth0), then
 * assigns the Supplier role. Outside the onboarding guard, so the user is never sent to the host onboarding first.
 */
export function SupplierClaimPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated, login, refreshAccessToken, forceReauth } = useAuth();
  // Read once: the token is forgotten as soon as the claim succeeds, a retry reuses this copy.
  const [pending] = useState<PendingSupplierClaim | null>(() => readPendingSupplierClaim());
  const claim = useClaimSupplier();
  const { mutate } = claim;
  const started = useRef(false);
  const [result, setResult] = useState<SupplierClaimResult | null>(null);
  const [leaving, setLeaving] = useState(false);

  const sendClaim = useCallback(
    () =>
      mutate(pending?.token, {
        onSuccess: (data) => {
          clearPendingSupplierClaim();
          setResult(data);
        },
        onError: (error) => {
          const code = claimErrorCode(error);
          if (code && TOKEN_FINAL_CODES.has(code)) clearPendingSupplierClaim();
        },
      }),
    [mutate, pending],
  );

  // Once signed in, the claim starts by itself (the user got here to link the profile).
  useEffect(() => {
    if (authLoading || !isAuthenticated || started.current) return;
    started.current = true;
    sendClaim();
  }, [authLoading, isAuthenticated, sendClaim]);

  const retryWithFreshToken = () => {
    // A just-verified email reaches the access token only with a new token.
    void refreshAccessToken()
      .catch(() => undefined)
      .then(sendClaim);
  };

  const continueToConsole = async (target: string) => {
    setLeaving(true);
    // Best effort: the new Supplier role reaches the token; the console already works through the account link.
    await refreshAccessToken().catch(() => undefined);
    navigate(target, { replace: true });
  };

  const renewAndContinue = async (target: string) => {
    setLeaving(true);
    try {
      await refreshAccessToken();
    } catch {
      // Silent renewal refused: a new sign-in issues a token with the current roles.
      forceReauth();
      return;
    }
    navigate(target, { replace: true });
  };

  const loginForClaim = (authorizationParams: Record<string, string>) =>
    login({
      returnTo: SUPPLIER_CLAIM_PATH,
      appState: pending ? { supplierClaim: pending } : undefined,
      authorizationParams: pending ? { login_hint: pending.email, ...authorizationParams } : authorizationParams,
    });

  const forget = () => {
    clearPendingSupplierClaim();
    navigate('/', { replace: true });
  };

  if (authLoading || leaving) {
    return <ClaimLoading message={t('supplier.claim.loading')} />;
  }

  if (!isAuthenticated) {
    return (
      <ClaimLayout
        title={t('supplier.claim.title')}
        description={
          pending
            ? t('supplier.claim.signInWithEmail', { email: pending.email })
            : t('supplier.claim.signInDescription')
        }
      >
        <Button className="w-full" size="lg" onClick={() => loginForClaim({ screen_hint: 'signup' })}>
          {t('supplier.claim.createAccount')}
        </Button>
        <Button className="w-full" variant="outline" onClick={() => loginForClaim({})}>
          {t('supplier.claim.login')}
        </Button>
      </ClaimLayout>
    );
  }

  if (result) {
    const target = result.redirectUrl?.startsWith('/app/') ? result.redirectUrl : SUPPLIER_HOME_ROUTE;
    if (!result.rolesSynced) {
      // FD-14 / PL-01: the link is saved, the Auth0 role is not; a retry repeats the (idempotent) claim.
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <RolesPendingPanel
            isRetrying={claim.isPending}
            onRetry={sendClaim}
            onRenewSession={() => void renewAndContinue(target)}
          />
        </div>
      );
    }

    return (
      <ClaimLayout title={t('supplier.claim.successTitle')} description={t('supplier.claim.successDescription')} success>
        <Button className="w-full" size="lg" onClick={() => void continueToConsole(target)}>
          {t('supplier.claim.completeProfile')}
        </Button>
      </ClaimLayout>
    );
  }

  if (claim.isError) {
    const code = claimErrorCode(claim.error);
    const message = getProblemMessage(claim.error, t) ?? t('supplier.claim.errorGeneric');
    return (
      <ClaimLayout title={t('supplier.claim.errorTitle')}>
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
        {code === 'supplier_claim_email_mismatch' && pending ? (
          <Button className="w-full" onClick={() => loginForClaim({ prompt: 'login' })}>
            {t('supplier.claim.switchAccount', { email: pending.email })}
          </Button>
        ) : null}
        {code === 'supplier_claim_email_unverified' ? (
          <>
            <p className="text-sm text-muted-foreground">{t('supplier.claim.verifyEmailHint')}</p>
            <Button className="w-full" disabled={claim.isPending} onClick={retryWithFreshToken}>
              {t('supplier.claim.retry')}
            </Button>
          </>
        ) : null}
        {code === 'supplier_account_already_linked' ? (
          <Button className="w-full" onClick={() => navigate(SUPPLIER_HOME_ROUTE, { replace: true })}>
            {t('supplier.claim.openConsole')}
          </Button>
        ) : null}
        {code !== undefined && REGISTER_AGAIN_CODES.has(code) ? (
          <Button className="w-full" onClick={() => navigate('/register')}>
            {t('supplier.claim.registerAgain')}
          </Button>
        ) : null}
        {code === undefined || !KNOWN_CODES.has(code) ? (
          <Button className="w-full" variant="outline" disabled={claim.isPending} onClick={sendClaim}>
            {t('supplier.claim.retry')}
          </Button>
        ) : null}
        <Button className="w-full" variant="ghost" onClick={forget}>
          {t('supplier.claim.skip')}
        </Button>
      </ClaimLayout>
    );
  }

  return <ClaimLoading message={t('supplier.claim.linking')} />;
}

/** No profile can be linked with what the user has: a new registration is the way forward. */
const REGISTER_AGAIN_CODES = new Set([
  'supplier_claim_invalid',
  'supplier_claim_expired',
  'supplier_claim_used',
  'supplier_claim_not_found',
]);

/** Codes with a dedicated action; anything else (network, 5xx, rate limit) offers a plain retry. */
const KNOWN_CODES = new Set([
  ...TOKEN_FINAL_CODES,
  'supplier_claim_email_mismatch',
  'supplier_claim_email_unverified',
  'supplier_claim_not_found',
  'supplier_claim_ambiguous',
  'supplier_account_email_missing',
]);

function ClaimLoading({ message }: { message: string }) {
  return (
    <ClaimLayout title={message}>
      <div className="flex justify-center py-4" role="status" aria-label={message}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </ClaimLayout>
  );
}

function ClaimLayout({
  title,
  description,
  success = false,
  children,
}: {
  title: string;
  description?: string;
  success?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md" data-testid="supplier-claim">
        <CardHeader className="text-center">
          <div
            className={
              success
                ? 'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700'
                : 'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground'
            }
          >
            <Home className="h-8 w-8" aria-hidden />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <CardContent className="space-y-4">{children}</CardContent>}
      </Card>
    </div>
  );
}
