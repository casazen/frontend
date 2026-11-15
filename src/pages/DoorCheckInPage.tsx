import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { publicCheckinApi } from '@/api/checkin.api';
import { isFeatureEnabled } from '@/config/feature-flags';
import { GuestPageFrame } from '@/features/checkin/components/guest-page-frame';
import { LanguageSwitcher } from '@/features/checkin/components/language-switcher';
import {
  checkInAddressOf,
  classifyDoorError,
  doorRequestOf,
  validateDoor,
  DOOR_CODE_MAX_LENGTH,
  DOOR_SURNAME_MAX_LENGTH,
  type DoorErrors,
  type DoorMode,
  type DoorProblem,
  type DoorValues,
} from '@/features/checkin/lib/door-model';
import { resolveGuestLocale, useGuestPageLocale, type GuestLocale } from '@/features/checkin/lib/guest-locale';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useOpenDoorCheckIn } from '@/queries/use-checkin';
import { NotFoundPage } from '@/pages/not-found-page';

/** The sentence for a door that did not open: the same one for everything the server does not open, never which part of what was typed was wrong. */
function problemText(problem: DoorProblem, t: (key: string) => string): string {
  switch (problem) {
    case 'not_found':
      return t('checkin.door.errors.notFound');
    case 'too_many_requests':
      return t('checkin.door.errors.tooManyRequests');
    case 'network':
      return t('checkin.door.errors.network');
    default:
      return t('checkin.door.errors.failed');
  }
}

/** The words of a field that needs another look. */
function fieldErrorText(field: 'code' | 'surname' | 'arrival', error: DoorErrors[keyof DoorErrors], t: (key: string) => string): string | undefined {
  if (!error) return undefined;
  if (field === 'code') return t(error === 'required' ? 'checkin.door.errors.codeRequired' : 'checkin.door.errors.codeInvalid');
  if (field === 'surname') return t(error === 'required' ? 'checkin.door.errors.surnameRequired' : 'checkin.door.errors.surnameInvalid');
  return t(error === 'required' ? 'checkin.door.errors.arrivalRequired' : 'checkin.door.errors.arrivalInvalid');
}

function DoorCheckInForm({ doorToken }: { doorToken: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const door = useOpenDoorCheckIn(doorToken);
  // The page opens in the language of the browser until the guest chooses; the page of the stay then opens in the one that was chosen here.
  const [chosenLocale, setChosenLocale] = useState<GuestLocale | null>(null);
  const locale = chosenLocale ?? resolveGuestLocale(typeof navigator === 'undefined' ? undefined : navigator.language);
  const keepLocale = useCallback((stayedIn: GuestLocale) => setChosenLocale(stayedIn), []);
  useGuestPageLocale(locale, keepLocale);

  const [mode, setMode] = useState<DoorMode>('code');
  // What is typed lives in this state only, for the time the page is open: never in the address, a storage or a cache.
  const [values, setValues] = useState<DoorValues>({ code: '', surname: '', arrival: '' });
  const [tried, setTried] = useState(false);
  const errors = tried ? validateDoor(mode, values) : {};

  const edit = (change: Partial<DoorValues>) => {
    setValues((current) => ({ ...current, ...change }));
    // Something typed again is a new attempt: the sentence about the last one goes away.
    if (door.isError) door.reset();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (door.isPending || Object.keys(validateDoor(mode, values)).length > 0) return;

    try {
      const answer = await door.mutateAsync(doorRequestOf(mode, values));
      // The page of the stay opens in the language chosen here; the stay is found either way, so a failure to save it is not worth a word.
      if (chosenLocale) void publicCheckinApi.setLanguage(answer.token, chosenLocale).catch(() => undefined);
      navigate(checkInAddressOf(answer.token), { replace: true });
    } catch {
      // The reason is read from the state of the mutation below, in words.
    }
  };

  const switcher = <LanguageSwitcher value={locale} onChange={setChosenLocale} />;

  return (
    <GuestPageFrame switcher={switcher} testId="checkin-door-page">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{t('checkin.door.title')}</h1>
        <p className="text-muted-foreground">{t('checkin.door.description')}</p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-5 rounded-lg border bg-card p-5 shadow-sm" data-testid="checkin-door-form">
        <Segmented<DoorMode>
          label={t('checkin.door.modeLabel')}
          value={mode}
          onValueChange={(next) => {
            setMode(next);
            if (door.isError) door.reset();
          }}
          options={[
            { value: 'code', label: t('checkin.door.modeCode'), testId: 'checkin-door-mode-code' },
            { value: 'surname', label: t('checkin.door.modeSurname'), testId: 'checkin-door-mode-surname' },
          ]}
        />

        {mode === 'code' ? (
          <Field label={t('checkin.door.codeLabel')} hint={t('checkin.door.codeHint')} error={fieldErrorText('code', errors.code, t)}>
            <Input
              data-testid="checkin-door-code"
              value={values.code}
              maxLength={DOOR_CODE_MAX_LENGTH}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={door.isPending}
              onChange={(event) => edit({ code: event.target.value })}
            />
          </Field>
        ) : (
          <Field label={t('checkin.door.surnameLabel')} hint={t('checkin.door.surnameHint')} error={fieldErrorText('surname', errors.surname, t)}>
            <Input
              data-testid="checkin-door-surname"
              value={values.surname}
              maxLength={DOOR_SURNAME_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
              disabled={door.isPending}
              onChange={(event) => edit({ surname: event.target.value })}
            />
          </Field>
        )}

        <Field label={t('checkin.door.arrivalLabel')} hint={t('checkin.door.arrivalHint')} error={fieldErrorText('arrival', errors.arrival, t)}>
          <Input
            data-testid="checkin-door-arrival"
            type="date"
            value={values.arrival}
            autoComplete="off"
            disabled={door.isPending}
            onChange={(event) => edit({ arrival: event.target.value })}
          />
        </Field>

        {door.isError && (
          <Alert variant="danger" data-testid="checkin-door-error">
            {problemText(classifyDoorError(door.error), t)}
          </Alert>
        )}

        <Button type="submit" size="lg" className="w-full" loading={door.isPending} disabled={door.isPending} data-testid="checkin-door-submit">
          {door.isPending ? t('checkin.door.submitting') : t('checkin.door.submit')}
        </Button>
      </form>
    </GuestPageFrame>
  );
}

/**
 * The page the QR code at the door of a property opens (`/checkin/porta/:doorToken`, E22/F02/US01/T01, NF-24, NF-50): no sign-in, the same frame as the check-in of the link. The guest
 * who arrives types the booking code (or the surname of the main guest, for a stay that has no code) and the arrival date; the API finds the stay of THIS property and answers the token of its
 * check-in link, and the page goes on there at the identity step. Everything that does not open is one answer, the same for every cause: the page never says which part was wrong. Behind the
 * flag `checkInIdentityVerification`: while it is off the address is one nobody knows, as it was before.
 */
export function DoorCheckInPage() {
  const { doorToken = '' } = useParams<{ doorToken: string }>();
  const { flags, isLoading } = useFeatureFlags();
  const { t } = useTranslation();

  if (isLoading) return <LoadingScreen message={t('checkin.loading')} />;
  if (!isFeatureEnabled(flags, 'checkInIdentityVerification') || doorToken === '') return <NotFoundPage />;
  return <DoorCheckInForm doorToken={doorToken} />;
}
