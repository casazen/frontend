import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { useGuestMarketing, useResendMarketingConfirmation, useSaveGuestMarketing } from '@/queries/use-guest-marketing';
import type { GuestBookingDetails, GuestSession } from '@/types';
import type { GuestMarketingState } from '@/types/guest-marketing.types';

type Channel = 'email' | 'whatsapp';

/** The codes of the change that say the address or the number the guest gave (or the booking has) cannot be used: the field for it is asked for. */
const EMAIL_INVALID_CODE = 'guest_marketing_email_invalid';
const PHONE_INVALID_CODE = 'guest_marketing_phone_invalid';
const CONSENT_OUTDATED_CODE = 'guest_marketing_consent_outdated';

/** What each state is called and what it means for the guest. The keys are written out, so that the i18n test finds a missing translation. */
const STATES: Record<GuestMarketingState, { labelKey: string; detailKey: string | null }> = {
  none: { labelKey: 'publicBooking.guestMarketing.state.none', detailKey: null },
  pending: { labelKey: 'publicBooking.guestMarketing.state.pending', detailKey: 'publicBooking.guestMarketing.stateDetail.pending' },
  confirmed: { labelKey: 'publicBooking.guestMarketing.state.confirmed', detailKey: 'publicBooking.guestMarketing.stateDetail.confirmed' },
  soft_opt_in: { labelKey: 'publicBooking.guestMarketing.state.softOptIn', detailKey: 'publicBooking.guestMarketing.stateDetail.softOptIn' },
  service_only: { labelKey: 'publicBooking.guestMarketing.state.serviceOnly', detailKey: 'publicBooking.guestMarketing.stateDetail.serviceOnly' },
  withdrawn: { labelKey: 'publicBooking.guestMarketing.state.withdrawn', detailKey: 'publicBooking.guestMarketing.stateDetail.withdrawn' },
};

/** The states in which a channel receives (or is about to receive) offers: the guest can say they do not want them. */
const ACTIVE_STATES: readonly GuestMarketingState[] = ['pending', 'confirmed', 'soft_opt_in'];
/** The states in which a channel receives nothing and the guest has not objected: the guest can switch it on. */
const OFFERABLE_STATES: readonly GuestMarketingState[] = ['none', 'service_only'];

interface GuestMarketingSectionProps {
  session: GuestSession;
  booking: GuestBookingDetails;
}

/**
 * «Offerte e novità» of the guest area (E07/F04/US02/T03, NF-90, CRM-03): what the guest agreed to for e-mail and for WhatsApp, and the way to
 * change it, under the booking of "Le mie prenotazioni" (the {@link GuestAreaSlot} hooks it in, after the messages). Per channel it says where
 * the choice stands (not subscribed, to confirm, confirmed, offers on similar stays, unsubscribed) with the address or number masked; the
 * switches «E-mail» and «WhatsApp» start off, whatever the guest did elsewhere, and exist only when the server has a version of the consent
 * text, which is shown with it; an address (or a number) is asked for when the booking has none that can be used (the forward address of a
 * booking channel); a consent waiting for its confirmation can be asked for again; and «Non voglio ricevere offerte» withdraws a channel,
 * after saying that it is final. Nothing is shown for a booking whose choices answer 404. Everything is read with the session of the guest, so it
 * never shows another guest's data.
 */
export function GuestMarketingSection({ session, booking }: GuestMarketingSectionProps) {
  return <GuestMarketing session={session} code={booking.bookingCode} />;
}

interface ChannelRowProps {
  channel: Channel;
  name: string;
  state: GuestMarketingState;
  /** The address or number the choice is about, masked; null when there is none to show. */
  masked: string | null;
  /** The guest can switch it on: the channel is off, not objected to, and the server has a version of the consent text. */
  canTurnOn: boolean;
  ticked: boolean;
  busy: boolean;
  onTick: (ticked: boolean) => void;
  onWithdraw: () => void;
  /** Under the state: the field to type an address or a number, the resend of the confirmation. */
  children?: ReactNode;
}

/** One channel: its name, where it stands, and what the guest can do about it. */
function ChannelRow({ channel, name, state, masked, canTurnOn, ticked, busy, onTick, onWithdraw, children }: ChannelRowProps) {
  const { t } = useTranslation();
  const switchId = useId();
  const stateText = STATES[state];
  // The address of a contact used for the stay only is the forward address of a booking channel: no use showing it, even masked.
  const shownValue = state === 'service_only' ? null : masked;
  const active = ACTIVE_STATES.includes(state);

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid={`guest-marketing-${channel}`} data-state={state}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          {canTurnOn ? (
            <Label htmlFor={switchId} className="text-sm font-medium">
              {name}
            </Label>
          ) : (
            <p className="text-sm font-medium">{name}</p>
          )}
          {shownValue ? (
            <p className="break-all font-mono text-xs text-muted-foreground" data-testid={`guest-marketing-${channel}-value`}>
              {shownValue}
            </p>
          ) : null}
        </div>
        {canTurnOn ? (
          <Switch
            id={switchId}
            checked={ticked}
            disabled={busy}
            onCheckedChange={onTick}
            data-testid={`guest-marketing-${channel}-switch`}
          />
        ) : null}
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-medium" data-testid={`guest-marketing-${channel}-state`}>
          {t(stateText.labelKey)}
        </p>
        {stateText.detailKey ? <p className="text-sm text-muted-foreground">{t(stateText.detailKey)}</p> : null}
      </div>
      {children}
      {active ? (
        <div className="space-y-1 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label={t('publicBooking.guestMarketing.withdrawLabel', { channel: name })}
            onClick={onWithdraw}
            data-testid={`guest-marketing-${channel}-withdraw`}
          >
            {t('publicBooking.guestMarketing.withdraw')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('publicBooking.guestMarketing.withdrawFinal')}</p>
        </div>
      ) : null}
    </div>
  );
}

interface GuestMarketingProps {
  session: GuestSession;
  code: string;
}

function GuestMarketing({ session, code }: GuestMarketingProps) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const marketing = useGuestMarketing(session, code);
  const save = useSaveGuestMarketing(session, code);
  const withdraw = useSaveGuestMarketing(session, code);
  const resend = useResendMarketingConfirmation(session, code);
  // What the guest switched on and typed here, not yet sent: nothing starts ticked, whatever the server knows.
  const [ticked, setTicked] = useState<Record<Channel, boolean>>({ email: false, whatsapp: false });
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [withdrawing, setWithdrawing] = useState<Channel | null>(null);

  // No choices for this booking (it is not the guest's, or there is nothing to show): nothing, not even a placeholder.
  if (marketing.isError && getHttpStatus(marketing.error) === 404) return null;

  const data = marketing.data;
  const language = i18n.language.toLowerCase().startsWith('en') ? 'en' : 'it';
  const version = data?.marketingConsentVersion ?? null;
  const channelNames: Record<Channel, string> = {
    email: t('publicBooking.guestMarketing.channels.email'),
    whatsapp: t('publicBooking.guestMarketing.channels.whatsapp'),
  };

  const refusedWith = (problemCode: string) => isAxiosError(save.error) && getProblemCode(save.error.response?.data) === problemCode;
  // An address is asked for when the booking has no real one (the forward address of a channel, or none), or the server refused the one used.
  const needsAddress = data !== undefined && (data.email.maskedAddress === null || data.email.state === 'service_only' || refusedWith(EMAIL_INVALID_CODE));
  const needsPhone = data !== undefined && (data.whatsapp.maskedPhone === null || refusedWith(PHONE_INVALID_CODE));
  const emailOffered = version !== null && data !== undefined && OFFERABLE_STATES.includes(data.email.state);
  const whatsappOffered = version !== null && data !== undefined && OFFERABLE_STATES.includes(data.whatsapp.state);
  const wantEmail = emailOffered && ticked.email;
  const wantWhatsapp = whatsappOffered && ticked.whatsapp;
  const addressMissing = wantEmail && needsAddress && address.trim() === '';
  const phoneMissing = wantWhatsapp && needsPhone && phone.trim() === '';

  const clearTicks = () => {
    setTicked({ email: false, whatsapp: false });
    setAddress('');
    setPhone('');
    setAttempted(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (version === null || (!wantEmail && !wantWhatsapp)) return;
    setAttempted(true);
    if (addressMissing || phoneMissing) return;
    save.mutate(
      {
        consentVersion: version,
        language,
        ...(wantEmail ? { email: { enabled: true, ...(needsAddress && address.trim() ? { address: address.trim() } : {}) } } : {}),
        ...(wantWhatsapp ? { whatsapp: { enabled: true, ...(needsPhone && phone.trim() ? { phone: phone.trim() } : {}) } } : {}),
      },
      {
        onSuccess: clearTicks,
        // The text changed while the guest was reading: what they switched on was for the old one. The new one is shown, switched off.
        onError: (error) => {
          if (isAxiosError(error) && getProblemCode(error.response?.data) === CONSENT_OUTDATED_CODE) clearTicks();
        },
      },
    );
  };

  // The withdrawal is final, so it is asked first; the dialog closes only once the server has recorded it, and stays open with the reason otherwise.
  const confirmWithdraw = async () => {
    if (withdrawing === null) return;
    await withdraw.mutateAsync(
      withdrawing === 'email' ? { email: { enabled: false }, language } : { whatsapp: { enabled: false }, language },
    );
  };

  const resendMessage =
    resend.data !== undefined && !resend.isPending
      ? resend.data.sent
        ? t('publicBooking.guestMarketing.resendDone')
        : t('publicBooking.guestMarketing.resendNothing')
      : null;

  return (
    <section aria-labelledby={headingId} className="space-y-4 rounded-lg border bg-card p-4 sm:p-5" data-testid="guest-marketing">
      <div className="space-y-1">
        <h3 id={headingId} className="text-lg font-semibold">
          {t('publicBooking.guestMarketing.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('publicBooking.guestMarketing.intro')}</p>
      </div>

      {marketing.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="guest-marketing-loading">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('publicBooking.guestMarketing.loading')}
        </p>
      ) : null}

      {marketing.isError && !data ? (
        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert" data-testid="guest-marketing-error">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
          <div className="space-y-2">
            <p className="text-sm text-destructive">{getProblemMessage(marketing.error, t) ?? t('publicBooking.guestMarketing.loadError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void marketing.refetch()}>
              <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
              {t('publicBooking.guestMarketing.retry')}
            </Button>
          </div>
        </div>
      ) : null}

      {data ? (
        <>
          <form onSubmit={submit} noValidate className="space-y-3" data-testid="guest-marketing-form">
            {version !== null && (emailOffered || whatsappOffered) ? (
              <div className="space-y-1" data-testid="guest-marketing-consent">
                <p className="text-sm leading-relaxed">{t('publicBooking.guestMarketing.consentText')}</p>
                <p className="text-xs text-muted-foreground" data-testid="guest-marketing-consent-version">
                  {t('publicBooking.guestMarketing.consentVersion', { version })}
                </p>
              </div>
            ) : null}

            <ChannelRow
              channel="email"
              name={channelNames.email}
              state={data.email.state}
              masked={data.email.maskedAddress}
              canTurnOn={emailOffered}
              ticked={ticked.email}
              busy={save.isPending}
              onTick={(value) => setTicked((current) => ({ ...current, email: value }))}
              onWithdraw={() => setWithdrawing('email')}
            >
              {wantEmail && needsAddress ? (
                <Field
                  label={t('publicBooking.guestMarketing.addressLabel')}
                  hint={t('publicBooking.guestMarketing.addressHint')}
                  error={attempted && addressMissing ? t('publicBooking.guestMarketing.addressRequired') : undefined}
                >
                  <Input
                    id="guest-marketing-address"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    data-testid="guest-marketing-address"
                  />
                </Field>
              ) : null}
              {data.email.state === 'pending' ? (
                <div className="space-y-1">
                  {/* Once a message is sent the limits may not allow another for a while: the button goes, what the call said stays. */}
                  {data.email.canResend ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={resend.isPending}
                      onClick={() => resend.mutate()}
                      data-testid="guest-marketing-resend"
                    >
                      {t('publicBooking.guestMarketing.resend')}
                    </Button>
                  ) : null}
                  {resendMessage ? (
                    <p className="text-sm text-muted-foreground" role="status" data-testid="guest-marketing-resend-result">
                      {resendMessage}
                    </p>
                  ) : null}
                  {resend.isError ? (
                    <p className="text-sm text-destructive" role="alert" data-testid="guest-marketing-resend-error">
                      {getProblemMessage(resend.error, t) ?? t('publicBooking.guestMarketing.resendError')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </ChannelRow>

            <ChannelRow
              channel="whatsapp"
              name={channelNames.whatsapp}
              state={data.whatsapp.state}
              masked={data.whatsapp.maskedPhone}
              canTurnOn={whatsappOffered}
              ticked={ticked.whatsapp}
              busy={save.isPending}
              onTick={(value) => setTicked((current) => ({ ...current, whatsapp: value }))}
              onWithdraw={() => setWithdrawing('whatsapp')}
            >
              {wantWhatsapp && needsPhone ? (
                <Field
                  label={t('publicBooking.guestMarketing.phoneLabel')}
                  hint={t('publicBooking.guestMarketing.phoneHint')}
                  error={attempted && phoneMissing ? t('publicBooking.guestMarketing.phoneRequired') : undefined}
                >
                  <Input
                    id="guest-marketing-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    data-testid="guest-marketing-phone"
                  />
                </Field>
              ) : null}
            </ChannelRow>

            {save.isError ? (
              <Alert variant="danger" data-testid="guest-marketing-save-error">
                {getProblemMessage(save.error, t) ?? t('publicBooking.guestMarketing.saveError')}
              </Alert>
            ) : null}

            {emailOffered || whatsappOffered ? (
              <Button type="submit" loading={save.isPending} disabled={!wantEmail && !wantWhatsapp} data-testid="guest-marketing-save">
                {t('publicBooking.guestMarketing.save')}
              </Button>
            ) : null}
          </form>

          <ConfirmationDialog
            open={withdrawing !== null}
            onOpenChange={(open) => {
              if (open) return;
              setWithdrawing(null);
              withdraw.reset();
            }}
            title={t('publicBooking.guestMarketing.withdrawTitle')}
            description={t('publicBooking.guestMarketing.withdrawDescription', { channel: channelNames[withdrawing ?? 'email'] })}
            confirmLabel={t('publicBooking.guestMarketing.withdrawConfirm')}
            variant="destructive"
            consequences={[t('publicBooking.guestMarketing.withdrawConsequence')]}
            onConfirm={confirmWithdraw}
            isLoading={withdraw.isPending}
          >
            {withdraw.isError ? (
              <p className="text-sm text-destructive" role="alert" data-testid="guest-marketing-withdraw-error">
                {getProblemMessage(withdraw.error, t) ?? t('publicBooking.guestMarketing.saveError')}
              </p>
            ) : null}
          </ConfirmationDialog>
        </>
      ) : null}
    </section>
  );
}
