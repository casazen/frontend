import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { Store, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicAccessFrame, type AccessContent } from './public-access-frame';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ComunePicker } from '@/components/shared/comune-picker';
import { useAuth } from '@/hooks/use-auth';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { currentReturnTo } from '@/lib/auth-return-to';
import {
  parsePendingSupplierClaim,
  savePendingSupplierClaim,
  SUPPLIER_CLAIM_PATH,
  type PendingSupplierClaim,
} from '@/lib/supplier-claim';
import { useRegisterSupplier, useSupplierInvite, useSupplierRegistrationOptions } from '@/queries/supplier/use-registration';
import type { SupplierInvitePreview } from '@/services/supplier-api';

const ACTIVATION_PATH = '/app/supplier/activation';
const SELF_SERVE_PATH = '/register';

const FINAL_INVITE_CODES = new Set([
  'supplier_invite_invalid',
  'supplier_invite_expired',
  'supplier_invite_used',
  'supplier_invite_revoked',
]);

type RegistrationDone = {
  authenticated: boolean;
  email: string;
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
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
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
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
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
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {getProblemMessage(options.error, t) ?? t('supplier.register.optionsError')}
        </p>
        <Button className="w-full" variant="outline" onClick={() => void options.refetch()}>
          {t('supplier.register.retry')}
        </Button>
      </RegisterLayout>
    );
  }

  if (!options.data.selfServeEnabled) {
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
        comune={{ kind: 'picker' }}
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
  /** Any comune of the official ISTAT list, searched by name (the list is public and loaded in the background). */
  | { kind: 'picker' };

function RegistrationForm({
  email: lockedEmail,
  emailHint,
  comune,
  submitting,
  error,
  onSubmit,
}: {
  email?: string;
  emailHint?: string;
  comune: ComuneField;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: RegistrationValues) => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [comuneCode, setComuneCode] = useState(() => (comune.kind === 'locked' ? comune.code : ''));
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
    <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
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
            <ComunePicker
              id="comune"
              istatCode={comuneCode || null}
              onChange={(picked) => setComuneCode(picked?.istatCode ?? '')}
              placeholder={t('supplier.register.comunePlaceholder')}
              describedBy="comune-hint"
            />
            <p id="comune-hint" className="text-xs text-muted-foreground">{t('supplier.register.comuneHint')}</p>
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
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
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
  const opened = useRef(false);

  function loginToClaim(authorizationParams: Record<string, string>) {
    login({
      returnTo: SUPPLIER_CLAIM_PATH,
      appState: done.claim ? { supplierClaim: done.claim } : undefined,
      authorizationParams: { login_hint: done.email, ...authorizationParams },
    });
  }

  const authenticated = done.authenticated;
  useEffect(() => {
    if (!authenticated || opened.current) return;
    opened.current = true;
    void refreshAccessToken()
      .catch(() => undefined)
      .then(() => navigate(ACTIVATION_PATH, { replace: true }));
  }, [authenticated, refreshAccessToken, navigate]);

  if (authenticated) return <LoadingCard message={t('supplier.register.openingActivation')} />;

  return (
    <RegisterLayout
      title={t('supplier.register.successTitle')}
      description={t('supplier.register.successDescription', { email: done.email })}
      success
    >
      <Button className="w-full" size="lg" onClick={() => loginToClaim({ screen_hint: 'signup' })}>
        {t('supplier.register.createAccount')}
      </Button>
      <Button className="w-full" variant="outline" onClick={() => loginToClaim({})}>
        {t('supplier.register.loginToClaim')}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t('supplier.register.afterAccount')}</p>
    </RegisterLayout>
  );
}

function LoadingCard({ message }: { message: string }) {
  return (
    <RegisterLayout title={message}>
      <div className="flex justify-center py-4" role="status" aria-label={message}>
        <Loader2 className="size-7 animate-spin motion-reduce:animate-none text-muted-foreground" />
      </div>
    </RegisterLayout>
  );
}

function RegisterLayout(props: AccessContent) {
  return <PublicAccessFrame icon={Store} {...props} />;
}
