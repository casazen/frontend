import { useId, useState } from 'react';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, MinusCircle, XCircle, type LucideIcon } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { flowNameKey, isOnboardingFlowKey } from '@/lib/onboarding-flows';
import { useFlowProperties } from '@/queries/use-onboarding-flows';
import { useRunTest } from '@/queries/use-flow-activation';
import type { FlowCheck, TestRunOutcome } from '@/types/onboarding.types';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** The 404 that says the property has no booking imported from the channel manager to run the test on. */
const TEST_BOOKING_NOT_FOUND = 'test_booking_not_found';

/** How each outcome looks: an icon and a word, never a color alone (UX-09). */
const OUTCOME_VIEW: Record<TestRunOutcome, { Icon: LucideIcon; tone: string }> = {
  pass: { Icon: CheckCircle2, tone: 'text-success-foreground' },
  fail: { Icon: XCircle, tone: 'text-danger-foreground' },
  skipped: { Icon: MinusCircle, tone: 'text-foreground/70' },
};

/** The result of the test on one flow: one line, what it found and, for a fail or a skip, the reasons in plain words. */
function CheckLine({ check }: { check: FlowCheck }) {
  const { t, i18n } = useTranslation();
  const outcome: TestRunOutcome = check.outcome === 'pass' || check.outcome === 'fail' || check.outcome === 'skipped' ? check.outcome : 'skipped';
  const { Icon, tone } = OUTCOME_VIEW[outcome];
  const reasons = (check.reasons ?? []).map((code) => (i18n.exists(`onboardingPlan.test.reasons.${code}`) ? t(`onboardingPlan.test.reasons.${code}`) : t('onboardingPlan.test.reasons.unknown')));

  return (
    <li className="flex min-w-0 items-start gap-2 text-sm" data-testid={`test-check-${check.flow}`} data-outcome={outcome}>
      <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <p className="break-words">
          <span className="font-medium">{isOnboardingFlowKey(check.flow) ? t(flowNameKey(check.flow)) : check.flow}</span>
          {': '}
          <span>{t(`onboardingPlan.test.outcomes.${outcome}`)}</span>
        </p>
        {reasons.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-5 text-foreground/70" role="list">
            {reasons.map((reason, index) => (
              <li key={`${index}:${reason}`} className="break-words">
                {reason}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The final test (E10/F03/US02/T03, NF-104 part 11, ONB-03): the host chooses a property, presses «Fai la prova finale» and a recently imported booking of
 * that property passes through every flow, read only. The result is one line for each flow: pass, fail with the reason in plain words, or skipped with
 * why. «Nessun effetto: non viene inviato nulla» is always on screen, before and after the test, because it is the thing that makes pressing it safe.
 * A property with no imported booking yet says so. The property that comes first is one that is already connected (it has bookings to read).
 */
export function FinalTestPanel() {
  const { t } = useTranslation();
  const selectId = useId();
  const [chosen, setChosen] = useState<string | null>(null);
  // The properties to choose from: the ones with bookings come from the channel manager, so the first page of the bookings flow, the connected ones first.
  const properties = useFlowProperties('Bookings', { page: 1, pageSize: 100 });
  const run = useRunTest();

  const items = properties.data?.items ?? [];
  const preferred = items.find((item) => item.state === 'active') ?? items[0];
  const propertyId = chosen ?? preferred?.propertyId ?? '';

  const noBooking = run.isError && isAxiosError(run.error) && getProblemCode(run.error.response?.data) === TEST_BOOKING_NOT_FOUND;

  return (
    <section className="min-w-0 space-y-3" aria-labelledby={`${selectId}-title`} data-testid="final-test-panel">
      <h2 id={`${selectId}-title`} className="text-lg font-semibold">
        {t('onboardingPlan.test.title')}
      </h2>
      <p className="text-sm text-foreground/70">{t('onboardingPlan.test.description')}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1 text-sm font-medium" htmlFor={selectId}>
          <span>{t('onboardingPlan.test.property')}</span>
          <select
            id={selectId}
            className="block h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={propertyId}
            onChange={(event) => setChosen(event.target.value)}
            disabled={items.length === 0}
            data-testid="test-property"
          >
            {items.map((item) => (
              <option key={item.propertyId} value={item.propertyId}>
                {item.city ? `${item.name} · ${item.city}` : item.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" className={TOUCH_TARGET} disabled={!propertyId} loading={run.isPending} onClick={() => run.mutate({ propertyId })} data-testid="test-run">
          {t('onboardingPlan.test.run')}
        </Button>
      </div>

      {/* Always on screen: it is what makes pressing the button safe. */}
      <p className="text-sm font-medium" data-testid="test-no-effect">
        {t('onboardingPlan.test.noEffect')}
      </p>

      {properties.isError ? (
        <Alert variant="danger" data-testid="test-properties-error">
          {getProblemMessage(properties.error, t) ?? t('onboardingPlan.test.propertiesError')}
        </Alert>
      ) : null}
      {noBooking ? (
        <Alert variant="info" data-testid="test-no-booking">
          {t('onboardingPlan.test.noBooking')}
        </Alert>
      ) : null}
      {run.isError && !noBooking ? (
        <Alert variant="danger" data-testid="test-error">
          {getProblemMessage(run.error, t) ?? t('onboardingPlan.test.error')}
        </Alert>
      ) : null}
      {run.data ? (
        <ul className="space-y-2" role="list" aria-live="polite" aria-label={t('onboardingPlan.test.resultLabel')} data-testid="test-result">
          {run.data.checks.map((check) => (
            <CheckLine key={check.flow} check={check} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
