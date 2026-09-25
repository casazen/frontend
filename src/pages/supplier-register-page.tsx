import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { Home, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { currentReturnTo } from '@/lib/auth-return-to';
import {
  parsePendingSupplierClaim,
  savePendingSupplierClaim,
  SUPPLIER_CLAIM_PATH,
  type PendingSupplierClaim,
} from '@/lib/supplier-claim';
import { useRegisterSupplier, useSupplierInvite, useSupplierRegistrationOptions } from '@/queries/use-supplier';
import type { SupplierInvitePreview } from '@/services/supplier-api';

/** Where a registered supplier completes the profile (activation wizard). */
const ACTIVATION_PATH = '/app/supplier/activation';
const SELF_SERVE_PATH = '/register';

/** Invite errors that retrying cannot fix. */
const FINAL_INVITE_CODES = new Set(['supplier_invite_invalid', 'supplier_invite_expired', 'supplier_invite_used']);

type RegistrationDone = {
  authenticated: boolean;
  email: string;
  /** Anonymous registration: the claim that links the account created next (SU-02). */
  claim?: PendingSupplierClaim | null;
};

/**
 * Supplier registration (SU-01). With `?inviteToken=` the invite is read from the API and email and
 * comune are locked; the invite is accepted only after the Auth0 login of the web app (the SDK handles
 * PKCE and `state`) with the invited email. Without a token it is self-serve, for the pilot comuni only.
 */
export function SupplierRegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = (searchParams.get('inviteToken') ?? '').trim();

  return inviteToken ? <InviteRegistration token={inviteToken} /> : <SelfServeRegistration />;
}

function InviteRegistration({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const { isLoading: authLoading, isAuthenticated, user, login } = useAuth();
  const location = useLocation();
  const invite = useSupplierInvite(token);
  const register = useRegisterSupplier();
  const [done, setDone] = useState<RegistrationDone | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done) return <RegistrationSuccess done={done} />;

  if (invite.isPending || authLoading) {
    return <LoadingCard message={t('supplier.register.inviteLoading')} />;
  }

  if (invite.isError) {
    const code = isAxiosError(invite.error) ? getProblemCode(invite.error.response?.data) : undefined;
    const final = code !== undefined && FINAL_INVITE_CODES.has(code);
    return (
      <RegisterLayout title={t('supplier.register.inviteErrorTitle')}>
        <p role="alert" className="text-sm text-destructive">
          {getProblemMessage(invite.error, t) ?? t('supplier.register.inviteErrorGeneric')}
        </p>
        {!final && (
          <Button className="w-full" variant="outline" onClick={() => void invite.refetch()}>
            {t('supplier.register.retry')}
          </Button>
        )}
        <Button className="w-full" variant="ghost" asChild>
          <Link to={SELF_SERVE_PATH}>{t('supplier.register.registerWithoutInvite')}</Link>
        </Button>
      </RegisterLayout>
    );
  }

  const data: SupplierInvitePreview = invite.data;
  const comune = data.comuneName
    ? t('supplier.register.comuneWithCode', { name: data.comuneName, code: data.comuneCode })
    : data.comuneCode;
  const expires = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Rome',
  }).format(new Date(data.expiresAt));
  const summary = (
    <div className="space-y-1 rounded-md bg-muted p-3 text-sm" data-testid="invite-summary">
      <p className="font-medium">{t('supplier.register.inviteFor', { email: data.email })}</p>
      <p>{t('supplier.register.inviteComune', { comune })}</p>
      <p className="text-muted-foreground">{t('supplier.register.inviteExpires', { date: expires })}</p>
    </div>
  );

  // Back to this page after the Auth0 login, with the invited email pre-filled.
  const loginForInvite = (authorizationParams: Record<string, string>) =>
    login({
      returnTo: currentReturnTo(location),
      authorizationParams: { login_hint: data.email, ...authorizationParams },
    });

  if (!isAuthenticated) {
    return (
      <RegisterLayout title={t('supplier.register.title')} description={t('supplier.register.inviteDescription')}>
        {summary}
        <p className="text-sm text-muted-foreground">
          {t('supplier.register.inviteLoginHint', { email: data.email })}
        </p>
        <Button className="w-full" size="lg" onClick={() => loginForInvite({ screen_hint: 'signup' })}>
          {t('supplier.register.inviteSignup')}
        </Button>
        <Button className="w-full" variant="outline" onClick={() => loginForInvite({})}>
          {t('supplier.register.inviteLogin')}
        </Button>
      </RegisterLayout>
    );
  }

  const accountEmail = user?.email?.trim();
  if (accountEmail && accountEmail.toLowerCase() !== data.email.toLowerCase()) {
    return (
      <RegisterLayout title={t('supplier.register.title')} description={t('supplier.register.inviteDescription')}>
        {summary}
        <p role="alert" className="text-sm text-destructive">
          {t('supplier.register.inviteWrongAccount', { account: accountEmail, invited: data.email })}
        </p>
        <Button className="w-full" onClick={() => loginForInvite({ prompt: 'login' })}>
          {t('supplier.register.inviteSwitchAccount')}
        </Button>
      </RegisterLayout>
    );
  }

  const submit = (values: RegistrationValues) => {
    setError(null);
    register.mutate(
      { payload: { ...values, inviteToken: token }, authenticated: true },
      {
        onSuccess: () => setDone({ authenticated: true, email: values.email }),
        onError: (err) => setError(getProblemMessage(err, t) ?? t('supplier.register.errorGeneric')),
      },
    );
  };

  return (
    <RegisterLayout title={t('supplier.register.title')} description={t('supplier.register.inviteDescription')}>
      {summary}
      <RegistrationForm
        email={data.email}
        emailHint={t('supplier.register.emailInviteHint')}
        comune={{ kind: 'locked', code: data.comuneCode, label: comune }}
        submitting={register.isPending}
        error={error}
        onSubmit={submit}
      />
    </RegisterLayout>
  );
}

function SelfServeRegistration() {
  const { t } = useTranslation();
  const { isLoading: authLoading, isAuthenticated, user, login } = useAuth();
  const options = useSupplierRegistrationOptions();
  const register = useRegisterSupplier();
  const [done, setDone] = useState<RegistrationDone | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done) return <RegistrationSuccess done={done} />;

  if (options.isPending || authLoading) {
    return <LoadingCard message={t('supplier.register.loading')} />;
  }

  if (options.isError) {
    return (
      <RegisterLayout title={t('supplier.register.title')}>
        <p role="alert" className="text-sm text-destructive">
          {getProblemMessage(options.error, t) ?? t('supplier.register.optionsError')}
        </p>
        <Button className="w-full" variant="outline" onClick={() => void options.refetch()}>
          {t('supplier.register.retry')}
        </Button>
      </RegisterLayout>
    );
  }

  if (!options.data.selfServeEnabled || options.data.pilotComuni.length === 0) {
    return (
      <RegisterLayout
        title={t('supplier.register.selfServeUnavailableTitle')}
        description={t('supplier.register.selfServeUnavailable')}
      />
    );
  }

  const accountEmail = isAuthenticated ? user?.email?.trim() : undefined;

  const submit = (values: RegistrationValues) => {
    setError(null);
    register.mutate(
      { payload: values, authenticated: isAuthenticated },
      {
        onSuccess: (result) => {
          // Anonymous: keep the claim token until the Auth0 account exists (SU-02, A4-02).
          const claim = isAuthenticated
            ? null
            : parsePendingSupplierClaim({
                token: result.claimToken,
                email: values.email,
                expiresAt: result.claimExpiresAt,
              });
          if (claim) savePendingSupplierClaim(claim);
          setDone({ authenticated: isAuthenticated, email: values.email, claim });
        },
        onError: (err) => setError(getProblemMessage(err, t) ?? t('supplier.register.errorGeneric')),
      },
    );
  };

  return (
    <RegisterLayout title={t('supplier.register.title')} description={t('supplier.register.description')}>
      <RegistrationForm
        email={accountEmail}
        emailHint={accountEmail ? t('supplier.register.emailAccountHint') : undefined}
        comune={{ kind: 'choice', options: options.data.pilotComuni }}
        submitting={register.isPending}
        error={error}
        onSubmit={submit}
      />
      {!isAuthenticated && (
        <p className="text-center text-xs text-muted-foreground">
          {t('supplier.register.existingAccount')}{' '}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => login({ returnTo: SELF_SERVE_PATH })}
          >
            {t('supplier.register.login')}
          </button>
        </p>
      )}
    </RegisterLayout>
  );
}

type RegistrationValues = { email: string; comuneCode: string; legalName: string; phone: string };

type ComuneField =
  | { kind: 'locked'; code: string; label: string }
  | { kind: 'choice'; options: { code: string; name: string }[] };

function RegistrationForm({
  email: lockedEmail,
  emailHint,
  comune,
  submitting,
  error,
  onSubmit,
}: {
  /** Set when the email cannot change (invite, or the signed-in account). */
  email?: string;
  emailHint?: string;
  comune: ComuneField;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: RegistrationValues) => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [comuneCode, setComuneCode] = useState(() =>
    comune.kind === 'locked' ? comune.code : comune.options.length === 1 ? comune.options[0].code : '',
  );
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [missingFields, setMissingFields] = useState(false);

  const effectiveEmail = (lockedEmail ?? email).trim();
  const effectiveComune = comune.kind === 'locked' ? comune.code : comuneCode;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!effectiveEmail || !effectiveComune || !legalName.trim() || !phone.trim()) {
      setMissingFields(true);
      return;
    }
    setMissingFields(false);
    onSubmit({ email: effectiveEmail, comuneCode: effectiveComune, legalName: legalName.trim(), phone: phone.trim() });
  }

  const message = missingFields ? t('supplier.register.errorFields') : error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">{t('supplier.register.email')}</Label>
        {lockedEmail !== undefined ? (
          <Input id="email" type="email" value={lockedEmail} readOnly aria-readonly="true" className="bg-muted" />
        ) : (
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={255}
          />
        )}
        {emailHint && <p className="text-xs text-muted-foreground">{emailHint}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="comune">{t('supplier.register.comune')}</Label>
        {comune.kind === 'locked' ? (
          <Input id="comune" value={comune.label} readOnly aria-readonly="true" className="bg-muted" />
        ) : (
          <>
            <select
              id="comune"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={comuneCode}
              onChange={(e) => setComuneCode(e.target.value)}
              required
            >
              <option value="">{t('supplier.register.comunePlaceholder')}</option>
              {comune.options.map((option) => (
                <option key={option.code} value={option.code}>
                  {t('supplier.register.comuneWithCode', { name: option.name, code: option.code })}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('supplier.register.comuneHint')}</p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="legalName">{t('supplier.register.legalName')}</Label>
        <Input
          id="legalName"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder={t('supplier.register.legalNamePlaceholder')}
          required
          maxLength={300}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">{t('supplier.register.phone')}</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('supplier.register.phonePlaceholder')}
          required
          maxLength={50}
        />
      </div>

      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('supplier.register.registering')}
          </>
        ) : (
          t('supplier.register.complete')
        )}
      </Button>
    </form>
  );
}

function RegistrationSuccess({ done }: { done: RegistrationDone }) {
  const { t } = useTranslation();
  const { login, refreshAccessToken } = useAuth();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  // Back to the claim page after the Auth0 signup or login; the claim also travels in appState.
  function loginToClaim(authorizationParams: Record<string, string>) {
    login({
      returnTo: SUPPLIER_CLAIM_PATH,
      appState: done.claim ? { supplierClaim: done.claim } : undefined,
      authorizationParams: { login_hint: done.email, ...authorizationParams },
    });
  }

  async function openActivation() {
    setOpening(true);
    // The Supplier role was just added in Auth0: get a token that carries it (best effort, the API
    // already authorizes the supplier through the account link).
    await refreshAccessToken().catch(() => undefined);
    navigate(ACTIVATION_PATH, { replace: true });
  }

  return (
    <RegisterLayout
      title={t('supplier.register.successTitle')}
      description={
        done.authenticated
          ? t('supplier.register.successSignedIn')
          : t('supplier.register.successDescription', { email: done.email })
      }
      success
    >
      {done.authenticated ? (
        <Button className="w-full" size="lg" disabled={opening} onClick={() => void openActivation()}>
          {opening && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {t('supplier.register.completeProfile')}
        </Button>
      ) : (
        <>
          <Button className="w-full" size="lg" onClick={() => loginToClaim({ screen_hint: 'signup' })}>
            {t('supplier.register.createAccount')}
          </Button>
          <Button className="w-full" variant="outline" onClick={() => loginToClaim({})}>
            {t('supplier.register.loginToClaim')}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t('supplier.register.afterAccount')}</p>
        </>
      )}
    </RegisterLayout>
  );
}

function LoadingCard({ message }: { message: string }) {
  return (
    <RegisterLayout title={message}>
      <div className="flex justify-center py-4" role="status" aria-label={message}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </RegisterLayout>
  );
}

function RegisterLayout({
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div
            className={
              success
                ? 'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700'
                : 'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground'
            }
          >
            {success ? (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <Home className="h-8 w-8" />
            )}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <CardContent className="space-y-4">{children}</CardContent>}
      </Card>
    </div>
  );
}
