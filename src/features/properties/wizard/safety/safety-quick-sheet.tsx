import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { HelpTip } from '@/components/ui/help-tip';
import { Qty } from '@/components/ui/qty';
import { useSafetyChecklist, useSaveSafetyChecklist } from '@/features/compliance/use-compliance';
import { useWorkspace } from '@/hooks/use-workspace';
import { MAX_FLOORS, OPTIONAL_SAFETY_ITEMS } from '@/lib/safety-checklist';
import { useFiscalRegime } from '@/queries/use-fiscal';
import { useProperty } from '@/queries/use-properties';
import type { SafetyChecklist, SafetyItemCode } from '@/types/compliance.types';
import {
  HEAT_SOURCES,
  MAX_EXTINGUISHERS,
  extinguisherCount,
  heatIsIncomplete,
  initialQuickState,
  quickCommand,
  quickMinimum,
  visibleItems,
  type HeatSource,
  type PrefillKey,
  type PrefillReason,
  type Prefilled,
  type QuickSafetyState,
  type SafetyHints,
} from './safety-quick-model';

const T = 'propertyWizard.safetyQuick';

export interface SafetyQuickSheetProps {
  propertyId: string;
  /** The amenities chosen in the step, as the form has them now (saved or not). */
  amenities: readonly string[];
  /** Whole square metres from the first step; null when not given. */
  areaSqm: number | null;
  /** Called after each save, with the checklist as the server evaluated it. */
  onSaved?: (checklist: SafetyChecklist) => void;
  /** Opens the full form (where the devices are, the dates, the proofs). Offered while nothing is changed here. */
  onOpenFull?: () => void;
}

/**
 * «Scheda di sicurezza» of the wizard, the quick way (item 3 of the pre-release list): three questions — gas or a flame, a
 * business, the floors — and a list of what is already in the home, like the safety devices of Airbnb and Booking.com, then the
 * one confirmation. What CasaZen already knows (the amenities just chosen, the tax data, the CIN, the area) fills in the answers
 * the sheet does not have yet, each marked «Precompilato» with its reason; the host checks and confirms. It saves the body of the
 * full form, so the server decides what is missing exactly as before.
 */
export function SafetyQuickSheet({ propertyId, amenities, areaSqm, onSaved, onOpenFull }: SafetyQuickSheetProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const checklist = useSafetyChecklist(propertyId);
  const property = useProperty(propertyId);
  // The tax data only for who may read them: a refused read would take the host out of the wizard.
  const canReadTaxData = hasPermission('short-rent', 'payment.read');
  const fiscal = useFiscalRegime(new Date().getFullYear(), canReadTaxData);

  if (checklist.isLoading || property.isLoading || fiscal.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="safety-quick-loading">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t('propertyWizard.amenities.safety.loading')}
      </p>
    );
  }

  if (checklist.isError || !checklist.data) {
    return (
      <div className="space-y-2" role="alert" data-testid="safety-quick-error">
        <p className="text-sm text-destructive">{t('compliance.safety.loadFailed')}</p>
        <Button variant="outline" size="sm" onClick={() => void checklist.refetch()}>
          {t('compliance.safety.retry')}
        </Button>
      </div>
    );
  }

  const hints: SafetyHints = {
    amenities,
    areaSqm,
    cinCode: property.data?.cinCode ?? null,
    fiscal: fiscal.data ? { hasPartitaIva: fiscal.data.hasPartitaIva, requiresPartitaIva: fiscal.data.requiresPartitaIva } : null,
  };

  return (
    <QuickEditor
      key={checklist.data.updatedAt ?? 'new'}
      propertyId={propertyId}
      checklist={checklist.data}
      hints={hints}
      onSaved={onSaved}
      onOpenFull={onOpenFull}
    />
  );
}

function PrefillNote({ reason, testId }: { reason: PrefillReason | undefined; testId: string }) {
  const { t } = useTranslation();
  if (!reason) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/70" data-testid={testId}>
      <Badge variant="secondary">{t(`${T}.prefill.label`)}</Badge>
      <span>{t(`${T}.prefill.${reason}`)}</span>
    </div>
  );
}

/** What is still missing after the last save, in the words of the full form (stable codes of the server). */
function MissingList({ checklist }: { checklist: SafetyChecklist }) {
  const { t, i18n } = useTranslation();
  if (!checklist.saved || checklist.isComplete || checklist.blockers.length === 0) return null;
  const extinguishers = checklist.items.find((item) => item.code === 'FireExtinguishers');
  return (
    <Alert variant="warning" title={t(`${T}.missingTitle`)} data-testid="safety-quick-missing">
      <ul className="list-disc space-y-1 pl-5">
        {checklist.blockers.map((blocker) => {
          const key = `compliance.safety.blockers.${blocker.code}`;
          return (
            <li key={blocker.code} data-code={blocker.code}>
              {i18n.exists(key)
                ? t(key, { declared: extinguishers?.quantity ?? 0, minimum: checklist.minimumExtinguishers ?? 0 })
                : blocker.message}
            </li>
          );
        })}
      </ul>
    </Alert>
  );
}

interface QuickEditorProps {
  propertyId: string;
  checklist: SafetyChecklist;
  hints: SafetyHints;
  onSaved?: (checklist: SafetyChecklist) => void;
  onOpenFull?: () => void;
}

function QuickEditor({ propertyId, checklist, hints, onSaved, onOpenFull }: QuickEditorProps) {
  const { t } = useTranslation();
  const save = useSaveSafetyChecklist(propertyId);
  const [initial] = useState(() => initialQuickState(checklist, hints));
  const [state, setState] = useState<QuickSafetyState>(initial.state);
  const [prefilled, setPrefilled] = useState<Prefilled>(initial.prefilled);
  const [dirty, setDirty] = useState(false);
  const [heatError, setHeatError] = useState(false);

  /** A change of the host: the answer is theirs from now on, so its «Precompilato» goes. */
  const update = (change: (previous: QuickSafetyState) => Partial<QuickSafetyState>, keys: PrefillKey[]) => {
    setState((previous) => ({ ...previous, ...change(previous) }));
    if (keys.length > 0) {
      setPrefilled((previous) => {
        const next = { ...previous };
        for (const key of keys) delete next[key];
        return next;
      });
    }
    setDirty(true);
  };

  const setHeat = (heat: 'yes' | 'no') => {
    setHeatError(false);
    update((previous) => ({ heat, heatSources: heat === 'no' ? [] : previous.heatSources }), ['heat']);
  };
  const toggleSource = (source: HeatSource, on: boolean) => {
    setHeatError(false);
    update(
      (previous) => ({
        heatSources: on ? [...previous.heatSources.filter((s) => s !== source), source] : previous.heatSources.filter((s) => s !== source),
      }),
      ['heat'],
    );
  };
  const toggleItem = (code: SafetyItemCode, on: boolean) =>
    update(
      (previous) => ({
        present: on ? [...previous.present.filter((c) => c !== code), code] : previous.present.filter((c) => c !== code),
        touched: previous.touched.includes(code) ? previous.touched : [...previous.touched, code],
      }),
      [code],
    );

  const handleSave = async () => {
    if (heatIsIncomplete(state)) {
      setHeatError(true);
      return;
    }
    try {
      const saved = await save.mutateAsync(quickCommand(state, checklist, hints));
      onSaved?.(saved);
    } catch {
      // Toast shown by the mutation; the answers stay on screen.
    }
  };

  const items = visibleItems(state).filter((code) => code !== 'BdsrDeclaration');
  const minimum = quickMinimum(state, checklist, hints);
  const extinguishers = extinguisherCount(state, checklist, hints);
  const toReview = new Set(checklist.items.filter((item) => item.answer === 'ToReview').map((item) => item.code));
  const bdsrTicked = state.present.includes('BdsrDeclaration');

  return (
    <div className="space-y-6" data-testid="safety-quick">
      <p className="text-sm text-foreground/70">
        {t(`${T}.intro`)}{' '}
        <HelpTip title={t(`${T}.why.title`)} label={t(`${T}.why.title`)}>
          {t(`${T}.why.text`)}
        </HelpTip>
      </p>

      <MissingList checklist={checklist} />

      <section className="space-y-3" aria-labelledby="safety-quick-heat">
        <div className="space-y-1">
          <h3 id="safety-quick-heat" className="font-semibold">
            {t(`${T}.heat.question`)}
          </h3>
          <p className="text-sm text-foreground/70">{t(`${T}.heat.hint`)}</p>
        </div>
        <ChoiceGroup legend={t(`${T}.heat.question`)} minCardWidth={10}>
          <ChoiceCard
            name="safety-quick-heat"
            value="yes"
            title={t(`${T}.heat.yes`)}
            checked={state.heat === 'yes'}
            onChange={() => setHeat('yes')}
            data-testid="safety-quick-heat-yes"
          />
          <ChoiceCard
            name="safety-quick-heat"
            value="no"
            title={t(`${T}.heat.no`)}
            checked={state.heat === 'no'}
            onChange={() => setHeat('no')}
            data-testid="safety-quick-heat-no"
          />
        </ChoiceGroup>
        {state.heat === 'yes' ? (
          <ChoiceGroup legend={t(`${T}.heat.which`)} legendVisible minCardWidth={9}>
            {HEAT_SOURCES.map((source) => (
              <ChoiceCard
                key={source}
                type="checkbox"
                value={source}
                title={t(`${T}.heat.source.${source}`)}
                className="p-3 pr-10"
                checked={state.heatSources.includes(source)}
                onChange={(event) => toggleSource(source, event.target.checked)}
                data-testid={`safety-quick-source-${source}`}
              />
            ))}
          </ChoiceGroup>
        ) : null}
        {heatError ? (
          <p role="alert" className="text-sm text-danger-foreground" data-testid="safety-quick-heat-error">
            {t(`${T}.heat.whichRequired`)}
          </p>
        ) : null}
        {state.heat === 'no' ? (
          <p className="text-sm text-foreground/70" data-testid="safety-quick-exempt">
            {t(`${T}.heat.exempt`)}
          </p>
        ) : null}
        <PrefillNote reason={prefilled.heat} testId="safety-quick-prefill-heat" />
      </section>

      <section className="space-y-3" aria-labelledby="safety-quick-business">
        <div className="space-y-1">
          <h3 id="safety-quick-business" className="font-semibold">
            {t(`${T}.business.question`)}{' '}
            <HelpTip title={t(`${T}.business.helpTitle`)}>{t(`${T}.business.help`)}</HelpTip>
          </h3>
          <p className="text-sm text-foreground/70">{t(`${T}.business.hint`)}</p>
        </div>
        <ChoiceGroup legend={t(`${T}.business.question`)} minCardWidth={8}>
          <ChoiceCard
            name="safety-quick-business"
            value="yes"
            title={t(`${T}.business.yes`)}
            checked={state.entrepreneurial === true}
            onChange={() => update(() => ({ entrepreneurial: true }), ['entrepreneurial'])}
            data-testid="safety-quick-business-yes"
          />
          <ChoiceCard
            name="safety-quick-business"
            value="no"
            title={t(`${T}.business.no`)}
            checked={state.entrepreneurial === false}
            onChange={() => update(() => ({ entrepreneurial: false }), ['entrepreneurial'])}
            data-testid="safety-quick-business-no"
          />
        </ChoiceGroup>
        <PrefillNote reason={prefilled.entrepreneurial} testId="safety-quick-prefill-entrepreneurial" />
      </section>

      <section className="space-y-3" aria-labelledby="safety-quick-floors">
        {/* The question and its counter together (`max-w-xl`): on a wide screen the buttons do not end up at the far end of the step. */}
        <div className="flex max-w-xl flex-wrap items-center justify-between gap-3">
          <h3 id="safety-quick-floors" className="font-semibold">
            {t(`${T}.floors.question`)}
          </h3>
          <Qty
            label={t(`${T}.floors.label`)}
            value={state.floorCount}
            min={1}
            max={MAX_FLOORS}
            onChange={(floorCount) => update(() => ({ floorCount }), ['floorCount'])}
            testId="safety-quick-floors"
          />
        </div>
        <PrefillNote reason={prefilled.floorCount} testId="safety-quick-prefill-floorCount" />
      </section>

      <section className="space-y-3" aria-labelledby="safety-quick-have">
        <h3 id="safety-quick-have" className="font-semibold">
          {t(`${T}.have.title`)}
        </h3>
        <div className="space-y-3">
          {items.map((code) => {
            const ticked = state.present.includes(code);
            const optional = OPTIONAL_SAFETY_ITEMS.includes(code);
            return (
              <div key={code} className="space-y-2">
                <ChoiceCard
                  type="checkbox"
                  value={code}
                  title={t(`${T}.items.${code}`)}
                  description={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{t(optional ? `${T}.have.recommended` : `${T}.have.required`)}</span>
                      {code === 'FireExtinguishers' ? <span>{t(`${T}.have.minimum`, { count: minimum })}</span> : null}
                      {toReview.has(code) && !ticked ? (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-foreground">
                          {t(`${T}.have.toReview`)}
                        </span>
                      ) : null}
                    </span>
                  }
                  checked={ticked}
                  onChange={(event) => toggleItem(code, event.target.checked)}
                  data-testid={`safety-quick-item-${code}`}
                />
                {code === 'FireExtinguishers' && ticked ? (
                  <div className="flex flex-wrap items-center gap-3 pl-1">
                    <Qty
                      label={t(`${T}.have.count`)}
                      value={extinguishers}
                      min={1}
                      max={MAX_EXTINGUISHERS}
                      onChange={(count) => update(() => ({ extinguishers: count }), ['FireExtinguishers'])}
                      testId="safety-quick-extinguishers"
                    />
                    {extinguishers < minimum ? (
                      <p className="text-sm text-danger-foreground" data-testid="safety-quick-below-minimum">
                        {t(`${T}.have.minimum`, { count: minimum })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <PrefillNote reason={prefilled[code]} testId={`safety-quick-prefill-${code}`} />
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <ChoiceCard
            type="checkbox"
            value="BdsrDeclaration"
            title={t(`${T}.items.BdsrDeclaration`)}
            description={t(`${T}.have.required`)}
            checked={bdsrTicked}
            onChange={(event) => toggleItem('BdsrDeclaration', event.target.checked)}
            data-testid="safety-quick-item-BdsrDeclaration"
          />
          {!bdsrTicked ? <p className="text-sm text-foreground/70">{t(`${T}.bdsrHint`)}</p> : null}
          <PrefillNote reason={prefilled.BdsrDeclaration} testId="safety-quick-prefill-BdsrDeclaration" />
        </div>
      </section>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          className="mt-0.5"
          checked={state.confirm}
          onCheckedChange={(checked) => update(() => ({ confirm: checked === true }), [])}
          data-testid="safety-quick-confirm"
        />
        <span>{t('compliance.safety.confirm')}</span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={() => void handleSave()} disabled={save.isPending} data-testid="safety-quick-save">
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {t(`${T}.save`)}
        </Button>
        {onOpenFull && !dirty ? (
          <div className="text-right">
            <Button type="button" variant="ghost" size="sm" onClick={onOpenFull} data-testid="safety-quick-full">
              {t('propertyWizard.amenities.safety.full')}
            </Button>
            <p className="text-xs text-foreground/70">{t('propertyWizard.amenities.safety.fullHint')}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
