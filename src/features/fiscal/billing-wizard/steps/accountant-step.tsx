import { useState } from 'react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';
import { accountantPackageTooLarge } from '@/api/accountant-package.api';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkeletonLine } from '@/components/ui/skeleton';
import { asInstant } from '@/features/owner-accounting/owner-accounting-model';
import { translateValidationMessage } from '@/i18n/validation-message';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { ACCOUNTANT_SEND_DAYS, type AccountantPackageEmailQueued, type AccountantPackageSettings, type SaveAccountantPackageSettingsRequest } from '@/types';
import { accountantChange, accountantProblemsOf, amountLocale, isAccountantRefused, lastSendErrorKey, periodLabel, type AccountantField } from '../billing-wizard-model';
import {
  ACCOUNTANT_EMAIL_MAX,
  BILLING_ERROR_KEYS,
  accountantAnswersOf,
  accountantFoldersFor,
  accountantProblems,
  accountantSettingsFor,
  type BillingWizardValues,
} from '../billing-wizard-schema';

type Read<T> = Pick<UseQueryResult<T>, 'data' | 'isPending' | 'isError' | 'error' | 'refetch'>;

interface AccountantStepProps {
  /**
   * The settings of the send as the server has them: `null` when the server refuses them to this person (403: their reach is only some of the properties, and the settings are the whole
   * organization's), an error when they could not be read. The step never lays this over what the person typed: the form keeps the answers they changed, and the rest is read from here.
   */
  settings: Read<AccountantPackageSettings | null>;
  /** The save of the settings (`PUT api/accountant-package/settings`): the page's own, so that its buttons wait for it. */
  save: UseMutationResult<AccountantPackageSettings, unknown, SaveAccountantPackageSettingsRequest>;
  /** The test send (`POST api/accountant-package/send`). */
  send: UseMutationResult<AccountantPackageEmailQueued, unknown, void>;
  /** The month the test is about, `yyyy-MM`: the one that is over. */
  lastMonth: string;
  /** Another request of the wizard is on its way (the save of a step, the way out): the action of the step waits for it, as «Continua» waits for the action. */
  busy: boolean;
  /**
   * The person may choose the folders that carry the owner accounting: the administrator of an organization on the agency plan (`agency` of the wizard, who holds `agency.statement.view`).
   * For anyone else those folders are not offered and are never sent: the backend refuses them (422 `accountant_package_owner_accounting_required`) on an agency's organization.
   */
  ownerAccounting: boolean;
  /** The server refused the save or the test with a 403 (the role or the reach of the person is not what the settings need): the wizard turns read-only, as at a save of the step. */
  onRefused: () => void;
}

/** The fields of the step a problem can sit on: when one shows, they are all checked again at each change, so that its message goes as soon as the answer is fixed. */
const PROBLEM_FIELDS = ['accountantEmail', 'accountantDay', 'accountantContents'] as const;

/** The days of the month the send can be due on: 1 to 28, so that every month has the day. */
const SEND_DAYS = Array.from({ length: ACCOUNTANT_SEND_DAYS.max - ACCOUNTANT_SEND_DAYS.min + 1 }, (_, index) => ACCOUNTANT_SEND_DAYS.min + index);

/** A folder of the package to choose: a native checkbox in a card of at least 44 px, with the name and a line on what it holds. */
const FOLDER_CARD =
  'flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-md border bg-background p-3 text-sm has-[:checked]:bg-primary/5 has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60';

const DATE_ONLY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
const DATE_AND_TIME: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };

/** 422: the test of an organization on the agency plan is for a caller who may read the owner accounting, whatever folders are chosen (the package it sends holds it). */
const OWNER_ACCOUNTING_REQUIRED_CODE = 'accountant_package_owner_accounting_required';

/**
 * What a failed test send says, in words: a package that is too large (with how many files it would hold and how many one package allows, when the server says), the refusals the server explains
 * by code, and, for anything else, the sentence that admits the person cannot tell whether the e-mail went out (a call that ended without an answer may have): they look at the last send before they try again.
 * `asked` is whether the test itself was asked (and not only the save that goes before it): only then can a call with no answer have gone through.
 */
function testProblem(error: unknown, asked: boolean, t: TFunction): string {
  const tooLarge = accountantPackageTooLarge(error);
  if (tooLarge) {
    return tooLarge.fileCount !== null && tooLarge.maxFiles !== null
      ? t('billingWizard.accountant.test.tooLargeCount', { files: tooLarge.fileCount, max: tooLarge.maxFiles })
      : t('billingWizard.accountant.test.tooLarge');
  }
  // Its own words: the generic ones talk about folders, and the person who gets this has no owner folder to take out.
  if (isAxiosError(error) && error.response?.status === 422 && getProblemCode(error.response.data) === OWNER_ACCOUNTING_REQUIRED_CODE) return t('billingWizard.accountant.test.ownerAccounting');
  // No answer at all (the ten minutes ran out, the connection dropped): the server may have made the package and queued the e-mail. «Cannot reach the server, try again» would send the person to a second
  // test (which sends again whatever was sent), so it is the sentence that admits they cannot tell. Before the test is asked nothing has gone out, and the generic words are the true ones.
  if (asked && isAxiosError(error) && !error.response) return t('billingWizard.accountant.test.failed');
  return getProblemMessage(error, t) ?? t('billingWizard.accountant.test.failed');
}

/**
 * Step 9, «Commercialista» (E15/F02/US02/T01, NF-101, decision of 2026-11-14; optional): the accountant issues nothing and only receives, so this is where the person says to which address CasaZen
 * sends the package every month (an e-mail with a link that works for 30 days, never an attachment), from which day of the month, and which folders it holds, and where they try it with
 * «Invia una prova». The step is optional: it adds no missing item to the part «Fatturazione» of the guide, and «Continua» with nothing changed saves nothing.
 *
 * The settings are read from the server and the form keeps only what the person changes (`null` is «not touched»): what is shown is their answer, else the server's. «Continua» saves them as a whole,
 * once, and only when something changed. The test goes to the address that is SAVED, never to one that comes with the request: so «Invia una prova» saves what is on screen first (when it is valid
 * and different), and the e-mail goes where the person sees it going. The answer says «queued» and nothing more: delivery is not something the server can promise, and neither does the page.
 */
export function AccountantStep({ settings, save, send, lastMonth, busy, ownerAccounting, onRefused }: AccountantStepProps) {
  const { t } = useTranslation();
  // A 404 is the module being off at the server: it is that even when the query still holds the answer it had (a read that fails keeps the data it had), and it is said, never a form.
  const notFound = settings.isError && getHttpStatus(settings.error) === 404;

  return (
    <>
      <p className="text-sm text-foreground/80">{t('billingWizard.accountant.intro')}</p>
      {notFound ? (
        <Alert variant="info" data-testid="billing-accountant-unavailable">
          {t('billingWizard.accountant.unavailable')}
        </Alert>
      ) : settings.data ? (
        // A read that fails after the settings are on screen (a transient error when the window comes back) does not take the form from under the person's hands.
        <AccountantSettingsForm
          current={accountantSettingsFor(settings.data, ownerAccounting)}
          save={save}
          send={send}
          lastMonth={lastMonth}
          busy={busy}
          ownerAccounting={ownerAccounting}
          onRefused={onRefused}
        />
      ) : settings.data === null ? (
        <Alert variant="info" data-testid="billing-accountant-no-access">
          {t('billingWizard.accountant.noAccess')}
        </Alert>
      ) : settings.isError ? (
        <ErrorState title={t('billingWizard.accountant.loadError')} error={settings.error} onRetry={() => void settings.refetch()} testId="billing-accountant-error" />
      ) : (
        <SkeletonLine lines={3} lineClassName="h-10" label={t('billingWizard.accountant.loading')} />
      )}
    </>
  );
}

interface AccountantSettingsFormProps {
  /** The settings as this person sees them (`accountantSettingsFor`): without the folders they may not choose. */
  current: AccountantPackageSettings;
  save: AccountantStepProps['save'];
  send: AccountantStepProps['send'];
  lastMonth: string;
  busy: boolean;
  ownerAccounting: boolean;
  onRefused: () => void;
}

function AccountantSettingsForm({ current, save, send, lastMonth, busy, ownerAccounting, onRefused }: AccountantSettingsFormProps) {
  const { t, i18n } = useTranslation();
  const {
    control,
    getValues,
    setValue,
    setError,
    trigger,
    formState: { errors },
  } = useFormContext<BillingWizardValues>();
  const typedEmail = useWatch({ control, name: 'accountantEmail' });
  const typedMonthly = useWatch({ control, name: 'accountantMonthly' });
  const typedDay = useWatch({ control, name: 'accountantDay' });
  const typedContents = useWatch({ control, name: 'accountantContents' });
  const [queued, setQueued] = useState<AccountantPackageEmailQueued | null>(null);
  // What failed, and whether it was the test itself (`asked`) or only the save that goes before it.
  const [failure, setFailure] = useState<{ error: unknown; asked: boolean } | null>(null);
  // The test is on its way (the save that goes before it, then the send): the page's own save of «Continua» is not the test, and does not make the button say so.
  const [running, setRunning] = useState(false);
  const locale = amountLocale(i18n.language);

  const answers = accountantAnswersOf(current, { accountantEmail: typedEmail, accountantMonthly: typedMonthly, accountantDay: typedDay, accountantContents: typedContents });

  /** After an answer of the person: a problem that is on screen is checked again at once, so that its message goes as soon as the answer is fixed (and none shows before they have tried to go on). */
  const recheck = () => {
    if (errors.accountantEmail || errors.accountantDay || errors.accountantContents) void trigger([...PROBLEM_FIELDS]);
  };
  const changeEmail = (value: string) => {
    setValue('accountantEmail', value, { shouldDirty: true });
    recheck();
  };
  const changeMonthly = (value: boolean) => {
    setValue('accountantMonthly', value, { shouldDirty: true });
    recheck();
  };
  const changeDay = (value: number) => {
    setValue('accountantDay', value, { shouldDirty: true });
    recheck();
  };
  const toggleFolder = (folder: string) => {
    const chosen = answers.contents;
    setValue('accountantContents', chosen.includes(folder) ? chosen.filter((key) => key !== folder) : [...chosen, folder], { shouldDirty: true });
    recheck();
  };

  /** «Invia una prova»: what is on screen is checked and saved first when it is valid and different, so the e-mail goes to the address the person sees; then the test is asked. */
  const sendTest = async () => {
    if (busy || running) return;
    setQueued(null);
    setFailure(null);
    const values = getValues();
    const now = accountantAnswersOf(current, values);
    const noAddress = now.email.trim() === '';
    // With no address the test has nowhere to go: that is what the field says (not the monthly send's own words), and any other problem of the step is told as well.
    const problems = accountantProblems(now).filter((problem) => !(noAddress && problem.field === 'accountantEmail'));
    if (noAddress) problems.unshift({ field: 'accountantEmail', messageKey: BILLING_ERROR_KEYS.accountantEmailNeeded });
    if (problems.length > 0) {
      for (const problem of problems) setError(problem.field, { type: 'validate', message: problem.messageKey });
      return;
    }
    setRunning(true);
    // The save goes first and then the test: a refusal of the save names the field it is about; a refusal of the test is about the test, and names no field (not a folder the person chose).
    let saving = true;
    try {
      const { request } = accountantChange(current, values, 'whole');
      if (request) await save.mutateAsync(request);
      saving = false;
      setQueued(await send.mutateAsync());
    } catch (error) {
      if (saving) for (const problem of accountantProblemsOf(error)) setError(problem.name as AccountantField, { type: 'server', message: problem.messageKey });
      // The settings are the organization's: a refusal of the role or of the reach, of the save or of the test, turns the wizard read-only, as at a save of the step.
      if (isAccountantRefused(error)) onRefused();
      setFailure({ error, asked: !saving });
    } finally {
      setRunning(false);
    }
  };

  const last = current.lastSend;
  const contentsError = errors.accountantContents?.message ? translateValidationMessage(errors.accountantContents.message, t, i18n) : null;

  return (
    <>
      <Field label={t('billingWizard.accountant.email.label')} hint={t('billingWizard.accountant.email.hint')} optional error={errors.accountantEmail}>
        <Input
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={ACCOUNTANT_EMAIL_MAX}
          value={answers.email}
          onChange={(event) => changeEmail(event.target.value)}
          data-testid="billing-accountant-email"
        />
      </Field>

      <ChoiceGroup legend={t('billingWizard.accountant.monthly.legend')} minCardWidth={16}>
        <ChoiceCard
          type="checkbox"
          checked={answers.enabled}
          onChange={(event) => changeMonthly(event.target.checked)}
          icon={CalendarClock}
          title={t('billingWizard.accountant.monthly.title')}
          description={t(answers.enabled ? 'billingWizard.accountant.monthly.on' : 'billingWizard.accountant.monthly.off')}
          data-testid="billing-accountant-monthly"
        />
      </ChoiceGroup>

      {answers.enabled ? (
        <Field label={t('billingWizard.accountant.day.label')} hint={t('billingWizard.accountant.day.hint')} error={errors.accountantDay}>
          <Select value={String(answers.sendDay)} onChange={(event) => changeDay(Number(event.target.value))} data-testid="billing-accountant-day">
            {SEND_DAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" aria-describedby="billing-accountant-contents-hint" data-testid="billing-accountant-contents">
        <legend className="mb-1 text-sm font-medium">{t('billingWizard.accountant.contents.legend')}</legend>
        <p id="billing-accountant-contents-hint" className="text-sm text-foreground/70">
          {t(ownerAccounting ? 'billingWizard.accountant.contents.hint' : 'billingWizard.accountant.contents.hintNoOwnerFolders')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {accountantFoldersFor(ownerAccounting).map((folder) => (
            <label key={folder} className={FOLDER_CARD}>
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={answers.contents.includes(folder)}
                onChange={() => toggleFolder(folder)}
                aria-invalid={contentsError ? true : undefined}
                data-testid={`billing-accountant-folder-${folder}`}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="break-words font-medium leading-snug">{t(`billingWizard.accountant.contents.folders.${folder}.title`)}</span>
                <span className="break-words text-foreground/70">{t(`billingWizard.accountant.contents.folders.${folder}.description`)}</span>
              </span>
            </label>
          ))}
        </div>
        {contentsError ? (
          <p role="alert" className="break-words text-sm text-[color:var(--color-danger-foreground,#b4232a)]" data-testid="billing-accountant-contents-error">
            {contentsError}
          </p>
        ) : null}
      </fieldset>

      <section className="flex min-w-0 flex-col gap-3 rounded-lg border p-4" aria-labelledby="billing-accountant-test-title" data-testid="billing-accountant-test">
        <h3 id="billing-accountant-test-title" className="text-base font-semibold">
          {t('billingWizard.accountant.test.title')}
        </h3>
        <p className="text-sm text-foreground/80">{t('billingWizard.accountant.test.description', { period: periodLabel(lastMonth, locale) })}</p>
        {last ? (
          <p className="text-sm" data-testid="billing-accountant-last-send" data-result={last.result}>
            {last.result === 'sent'
              ? t('billingWizard.accountant.lastSend.sent', { period: periodLabel(last.period, locale), when: formatRomeDateTime(asInstant(last.at), locale, DATE_AND_TIME) })
              : t('billingWizard.accountant.lastSend.failed', {
                  period: periodLabel(last.period, locale),
                  when: formatRomeDateTime(asInstant(last.at), locale, DATE_AND_TIME),
                  reason: t(lastSendErrorKey(last.error)),
                  // «We try again every morning» is true only while the monthly send is on (the server tries again for no one else, and a failed test is not recorded here).
                  retry: t(current.enabled ? 'billingWizard.accountant.lastSend.retryOn' : 'billingWizard.accountant.lastSend.retryOff'),
                })}
          </p>
        ) : (
          <p className="text-sm text-foreground/70" data-testid="billing-accountant-last-send-none">
            {t('billingWizard.accountant.lastSend.none')}
          </p>
        )}
        <div>
          <Button type="button" variant="outline" loading={running} disabled={busy || running} onClick={() => void sendTest()} data-testid="billing-accountant-test-button">
            {t('billingWizard.accountant.test.button')}
          </Button>
        </div>
        {running ? (
          <p role="status" className="text-sm text-foreground/70" data-testid="billing-accountant-test-preparing">
            {t('billingWizard.accountant.test.preparing')}
          </p>
        ) : null}
        {queued ? (
          <Alert variant="success" data-testid="billing-accountant-test-result">
            {t('billingWizard.accountant.test.queued', {
              period: periodLabel(queued.period, locale),
              until: formatRomeDateTime(asInstant(queued.linkExpiresAt), locale, DATE_ONLY),
            })}
          </Alert>
        ) : null}
        {failure !== null ? (
          <Alert variant="danger" data-testid="billing-accountant-test-failure">
            {testProblem(failure.error, failure.asked, t)}
          </Alert>
        ) : null}
      </section>
    </>
  );
}
