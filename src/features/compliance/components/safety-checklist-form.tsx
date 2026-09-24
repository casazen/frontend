import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Loader2, Paperclip, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSafetyChecklist, useSaveSafetyChecklist } from '@/features/compliance/use-compliance';
import { useUploadPropertyDocument } from '@/queries/use-properties';
import { formatDateTime } from '@/lib/utils';
import {
  MAX_FLOORS,
  SAFETY_DETECTORS,
  minimumExtinguishers,
  safetyItemRequirement,
} from '@/lib/safety-checklist';
import {
  COMBUSTION_APPLIANCES,
  SAFETY_DETECTOR_TYPES,
  SAFETY_ITEM_CODES,
  type CombustionAppliance,
  type SafetyChecklist,
  type SafetyChecklistItem,
  type SafetyDetectorType,
  type SafetyItemCode,
  type SafetyItemRequirement,
  type SafetyNotApplicableReason,
  type SaveSafetyChecklistCommand,
} from '@/types/compliance.types';

const EVIDENCE_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
/** Items that collect a number of devices and where they are. */
const WITH_DEVICES: readonly SafetyItemCode[] = ['FireExtinguishers', ...SAFETY_DETECTORS];
const ANSWERS = ['Present', 'Missing'] as const;

type Answer = 'Present' | 'Missing' | null;

interface ItemState {
  answer: Answer;
  /** Imported from the old checklist and not answered again yet. */
  toReview: boolean;
  quantity: string;
  location: string;
  detectorType: SafetyDetectorType | '';
  checkedOn: string;
  expiresOn: string;
  evidenceDocumentId: string | null;
  evidenceFileName: string | null;
  notes: string;
}

interface FormState {
  entrepreneurial: boolean | null;
  hasGasSupply: boolean | null;
  appliances: CombustionAppliance[] | null;
  floorCount: string;
  floorAreas: string[];
  items: Record<SafetyItemCode, ItemState>;
  confirm: boolean;
}

function toItemState(item: SafetyChecklistItem | undefined): ItemState {
  return {
    answer: item?.answer === 'Present' || item?.answer === 'Missing' ? item.answer : null,
    toReview: item?.answer === 'ToReview',
    quantity: item?.quantity?.toString() ?? '',
    location: item?.location ?? '',
    detectorType: item?.detectorType ?? '',
    checkedOn: item?.checkedOn ?? '',
    expiresOn: item?.expiresOn ?? '',
    evidenceDocumentId: item?.evidenceDocumentId ?? null,
    evidenceFileName: item?.evidenceFileName ?? null,
    notes: item?.notes ?? '',
  };
}

function toFormState(checklist: SafetyChecklist): FormState {
  const byCode = new Map(checklist.items.map((i) => [i.code, i]));
  const items = Object.fromEntries(
    SAFETY_ITEM_CODES.map((code) => [code, toItemState(byCode.get(code))]),
  ) as Record<SafetyItemCode, ItemState>;
  const floorCount = checklist.facts.floorCount;
  return {
    entrepreneurial: checklist.facts.entrepreneurial,
    hasGasSupply: checklist.facts.hasGasSupply,
    appliances: checklist.facts.combustionAppliances,
    floorCount: floorCount?.toString() ?? '',
    floorAreas: Array.from({ length: floorCount ?? 0 }, (_, i) => checklist.facts.floorAreasSqm?.[i]?.toString() ?? ''),
    items,
    // A new confirmation is asked on every save (SC-08).
    confirm: false,
  };
}

function toNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return value.trim() === '' || Number.isNaN(parsed) ? null : parsed;
}

function requirementOf(code: SafetyItemCode, form: FormState) {
  return safetyItemRequirement(code, {
    entrepreneurial: form.entrepreneurial,
    hasGasSupply: form.hasGasSupply,
    appliances: form.appliances,
  });
}

function toCommand(form: FormState): SaveSafetyChecklistCommand {
  const floorCount = toNumber(form.floorCount);
  const areas = form.floorAreas.map(toNumber);
  const areasGiven = areas.length > 0 && areas.every((a) => a !== null);
  return {
    facts: {
      entrepreneurial: form.entrepreneurial,
      hasGasSupply: form.hasGasSupply,
      combustionAppliances: form.appliances,
      floorCount,
      floorAreasSqm: areasGiven ? (areas as number[]) : null,
    },
    items: SAFETY_ITEM_CODES.map((code) => {
      const item = form.items[code];
      return {
        code,
        answer: item.answer,
        quantity: toNumber(item.quantity),
        location: item.location.trim() || null,
        detectorType: item.detectorType || null,
        checkedOn: item.checkedOn || null,
        expiresOn: item.expiresOn || null,
        evidenceDocumentId: item.evidenceDocumentId,
        notes: item.notes.trim() || null,
      };
    }),
    confirm: form.confirm,
  };
}

interface SafetyChecklistFormProps {
  propertyId: string;
  /** Called after each successful save, with the checklist evaluated by the server. */
  onSaved?: (checklist: SafetyChecklist) => void;
}

/**
 * D.L. 145/2023 art. 13-ter safety checklist of a short-stay property (CO-07): facts of the unit, items that apply
 * (the others "not applicable" with their reason), dates and optional proofs, final confirmation. The server decides
 * the blockers; this form mirrors its rules only for live feedback.
 */
export function SafetyChecklistForm({ propertyId, onSaved }: SafetyChecklistFormProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useSafetyChecklist(propertyId);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="safety-checklist-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('compliance.safety.loading')}
      </p>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-2" role="alert" data-testid="safety-checklist-error">
        <p className="text-sm text-destructive">{t('compliance.safety.loadFailed')}</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          {t('compliance.safety.retry')}
        </Button>
      </div>
    );
  }

  return <SafetyChecklistEditor key={data.updatedAt ?? 'new'} propertyId={propertyId} checklist={data} onSaved={onSaved} />;
}

function SafetyChecklistEditor({
  propertyId,
  checklist,
  onSaved,
}: {
  propertyId: string;
  checklist: SafetyChecklist;
  onSaved?: (checklist: SafetyChecklist) => void;
}) {
  const { t } = useTranslation();
  const save = useSaveSafetyChecklist(propertyId);
  const [form, setForm] = useState<FormState>(() => toFormState(checklist));

  const floorCount = toNumber(form.floorCount);
  const minimum = minimumExtinguishers(floorCount, form.floorAreas.map(toNumber));
  const areasMissing = !!floorCount && form.floorAreas.some((a) => toNumber(a) === null);
  const detectorsExempt = requirementOf('GasDetector', form).requirement === 'NotApplicable';
  const combustionWithoutGas = form.hasGasSupply === false && (form.appliances?.length ?? 0) > 0;

  const setItem = (code: SafetyItemCode, patch: Partial<ItemState>) =>
    setForm((prev) => ({ ...prev, items: { ...prev.items, [code]: { ...prev.items[code], ...patch } } }));

  const setFloorCount = (value: string) =>
    setForm((prev) => {
      const count = toNumber(value);
      const length = count && count > 0 && count <= MAX_FLOORS ? Math.floor(count) : 0;
      return { ...prev, floorCount: value, floorAreas: Array.from({ length }, (_, i) => prev.floorAreas[i] ?? '') };
    });

  const toggleAppliance = (appliance: CombustionAppliance, checked: boolean) =>
    setForm((prev) => {
      const current = prev.appliances ?? [];
      const next = checked ? [...current, appliance] : current.filter((a) => a !== appliance);
      return { ...prev, appliances: next.length > 0 ? next : null };
    });

  const handleSave = async () => {
    try {
      const saved = await save.mutateAsync(toCommand(form));
      onSaved?.(saved);
    } catch {
      // Toast shown by the mutation; the form keeps the host's input.
    }
  };

  return (
    <div className="space-y-6" data-testid="safety-checklist-form">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>{t('compliance.safety.intro')}</p>
        <p>{t('compliance.safety.disclaimer')}</p>
      </div>

      {checklist.importedFromLegacy && (
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" data-testid="safety-imported">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {t('compliance.safety.importedFromLegacy')}
        </p>
      )}

      <IssuesSummary checklist={checklist} />

      <section className="space-y-4" aria-labelledby="safety-facts-title">
        <h3 id="safety-facts-title" className="font-semibold">
          {t('compliance.safety.facts.title')}
        </h3>

        <YesNo
          name="safety-entrepreneurial"
          legend={t('compliance.safety.facts.entrepreneurial')}
          hint={t('compliance.safety.facts.entrepreneurialHint')}
          value={form.entrepreneurial}
          onChange={(value) => setForm((prev) => ({ ...prev, entrepreneurial: value }))}
        />

        <YesNo
          name="safety-gas"
          legend={t('compliance.safety.facts.gasSupply')}
          value={form.hasGasSupply}
          onChange={(value) => setForm((prev) => ({ ...prev, hasGasSupply: value }))}
        />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('compliance.safety.facts.appliances')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {COMBUSTION_APPLIANCES.map((appliance) => (
              <label key={appliance} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.appliances?.includes(appliance) ?? false}
                  onCheckedChange={(checked) => toggleAppliance(appliance, checked === true)}
                />
                {t(`compliance.safety.appliance.${appliance}`)}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.appliances?.length === 0}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, appliances: checked === true ? [] : null }))
                }
              />
              {t('compliance.safety.facts.noAppliances')}
            </label>
          </div>
        </fieldset>

        {detectorsExempt && (
          <p className="text-sm text-muted-foreground" data-testid="safety-detectors-exempt">
            {t('compliance.safety.facts.detectorsExempt')}
          </p>
        )}
        {combustionWithoutGas && (
          <p className="text-sm text-muted-foreground">{t('compliance.safety.facts.combustionWithoutGas')}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="safety-floor-count">{t('compliance.safety.facts.floorCount')}</Label>
            <Input
              id="safety-floor-count"
              type="number"
              min={1}
              max={MAX_FLOORS}
              inputMode="numeric"
              value={form.floorCount}
              onChange={(e) => setFloorCount(e.target.value)}
            />
          </div>
          {form.floorAreas.map((area, index) => (
            <div key={index} className="space-y-1">
              <Label htmlFor={`safety-floor-area-${index}`}>
                {t('compliance.safety.facts.floorArea', { floor: index + 1 })}
              </Label>
              <Input
                id={`safety-floor-area-${index}`}
                type="number"
                min={1}
                inputMode="decimal"
                value={area}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    floorAreas: prev.floorAreas.map((a, i) => (i === index ? e.target.value : a)),
                  }))
                }
              />
            </div>
          ))}
        </div>
        {minimum !== null && (
          <p className="text-sm" data-testid="safety-minimum-extinguishers">
            {t('compliance.safety.facts.minimumExtinguishers', { minimum })}
          </p>
        )}
        {areasMissing && (
          <p className="text-sm text-amber-700" data-testid="safety-floor-areas-missing">
            {t('compliance.safety.warnings.safety_floor_areas_missing')}
          </p>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="safety-items-title">
        <h3 id="safety-items-title" className="font-semibold">
          {t('compliance.safety.itemsTitle')}
        </h3>
        {SAFETY_ITEM_CODES.map((code) => (
          <SafetyItemFields
            key={code}
            propertyId={propertyId}
            code={code}
            item={form.items[code]}
            applicability={requirementOf(code, form)}
            onChange={(patch) => setItem(code, patch)}
          />
        ))}
      </section>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          className="mt-0.5"
          checked={form.confirm}
          onCheckedChange={(checked) => setForm((prev) => ({ ...prev, confirm: checked === true }))}
          data-testid="safety-confirm"
        />
        <span>{t('compliance.safety.confirm')}</span>
      </label>
      {checklist.confirmedAt && checklist.confirmedTextVersion === checklist.declarationTextVersion && (
        <p className="text-xs text-muted-foreground">
          {t('compliance.safety.confirmedAt', { date: formatDateTime(checklist.confirmedAt) })}
        </p>
      )}

      <Button onClick={() => void handleSave()} disabled={save.isPending} data-testid="safety-save">
        {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('compliance.safety.save')}
      </Button>
    </div>
  );
}

/** Blockers and warnings of the last saved checklist, translated by stable code. */
function IssuesSummary({ checklist }: { checklist: SafetyChecklist }) {
  const { t, i18n } = useTranslation();
  const extinguishers = checklist.items.find((i) => i.code === 'FireExtinguishers');
  // Translation of the stable code in the UI language, or the text the server localized for a code unknown here.
  const blockerText = (issue: { code: string; message: string }) => {
    const key = `compliance.safety.blockers.${issue.code}`;
    return i18n.exists(key)
      ? t(key, { declared: extinguishers?.quantity ?? 0, minimum: checklist.minimumExtinguishers ?? 0 })
      : issue.message;
  };

  if (checklist.isComplete) {
    return (
      <p className="flex items-center gap-2 text-sm text-green-700" data-testid="safety-complete">
        <CheckCircle2 className="h-4 w-4" />
        {t('compliance.safety.complete')}
      </p>
    );
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" data-testid="safety-blockers">
      <p className="font-medium">{t('compliance.safety.blockersTitle')}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {checklist.blockers.map((b) => (
          <li key={b.code} data-code={b.code}>
            {blockerText(b)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function YesNo({
  name,
  legend,
  hint,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  hint?: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex gap-4">
        {[true, false].map((option) => (
          <label key={String(option)} className="flex items-center gap-2 text-sm">
            <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
            {t(option ? 'compliance.safety.answer.yes' : 'compliance.safety.answer.no')}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const REQUIREMENT_BADGE: Record<SafetyItemRequirement, 'destructive' | 'secondary' | 'outline'> = {
  Required: 'destructive',
  Optional: 'secondary',
  NotApplicable: 'outline',
  Undetermined: 'outline',
};

function SafetyItemFields({
  propertyId,
  code,
  item,
  applicability,
  onChange,
}: {
  propertyId: string;
  code: SafetyItemCode;
  item: ItemState;
  applicability: { requirement: SafetyItemRequirement; reason: SafetyNotApplicableReason | null };
  onChange: (patch: Partial<ItemState>) => void;
}) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const upload = useUploadPropertyDocument();
  const fileInput = useRef<HTMLInputElement>(null);
  const { requirement, reason } = applicability;
  const detector = SAFETY_DETECTORS.includes(code);
  const withDevices = WITH_DEVICES.includes(code);

  const handleEvidence = async (file: File | undefined) => {
    if (!file) return;
    try {
      const document = await upload.mutateAsync({ propertyId, file, documentType: 'SafetyCompliance' });
      onChange({ evidenceDocumentId: document.id, evidenceFileName: document.fileName });
    } catch {
      // Toast shown by the upload mutation.
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4" data-testid={`safety-item-${code}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{t(`compliance.safety.items.${code}.title`)}</p>
          <p className="text-xs text-muted-foreground">{t(`compliance.safety.items.${code}.reference`)}</p>
        </div>
        <div className="flex gap-1">
          {item.toReview && requirement !== 'NotApplicable' && (
            <Badge variant="warning">{t('compliance.safety.toReview')}</Badge>
          )}
          <Badge variant={REQUIREMENT_BADGE[requirement]}>{t(`compliance.safety.requirement.${requirement}`)}</Badge>
        </div>
      </div>

      {requirement === 'NotApplicable' && reason ? (
        <p className="text-sm text-muted-foreground" data-testid={`safety-item-${code}-not-applicable`}>
          {t(`compliance.safety.notApplicable.${reason}`)}
        </p>
      ) : (
        <>
          {code === 'FireExtinguishers' && (
            <p className="text-xs text-muted-foreground">{t('compliance.safety.items.FireExtinguishers.faq')}</p>
          )}
          <fieldset>
            <legend className="sr-only">{t(`compliance.safety.items.${code}.title`)}</legend>
            <div className="flex gap-4">
              {ANSWERS.map((answer) => (
                <label key={answer} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`${idPrefix}-answer`}
                    checked={item.answer === answer}
                    onChange={() => onChange({ answer, toReview: false })}
                  />
                  {t(answer === 'Present' ? 'compliance.safety.answer.yes' : 'compliance.safety.answer.no')}
                </label>
              ))}
            </div>
          </fieldset>

          {item.answer === 'Present' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {withDevices && (
                <div className="space-y-1">
                  <Label htmlFor={`${idPrefix}-quantity`}>
                    {t(code === 'FireExtinguishers' ? 'compliance.safety.fields.extinguisherCount' : 'compliance.safety.fields.deviceCount')}
                  </Label>
                  <Input
                    id={`${idPrefix}-quantity`}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={item.quantity}
                    onChange={(e) => onChange({ quantity: e.target.value })}
                  />
                </div>
              )}
              {withDevices && (
                <div className="space-y-1">
                  <Label htmlFor={`${idPrefix}-location`}>{t('compliance.safety.fields.location')}</Label>
                  <Input
                    id={`${idPrefix}-location`}
                    maxLength={200}
                    value={item.location}
                    onChange={(e) => onChange({ location: e.target.value })}
                  />
                </div>
              )}
              {detector && (
                <div className="space-y-1">
                  <Label htmlFor={`${idPrefix}-type`}>{t('compliance.safety.fields.detectorType')}</Label>
                  <select
                    id={`${idPrefix}-type`}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={item.detectorType}
                    onChange={(e) => onChange({ detectorType: e.target.value as SafetyDetectorType | '' })}
                  >
                    <option value="">{t('compliance.safety.fields.notSpecified')}</option>
                    {SAFETY_DETECTOR_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`compliance.safety.detectorType.${type}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {code !== 'EmergencyInstructions' && (
                <div className="space-y-1">
                  <Label htmlFor={`${idPrefix}-checked-on`}>{t(`compliance.safety.items.${code}.dateLabel`)}</Label>
                  <Input
                    id={`${idPrefix}-checked-on`}
                    type="date"
                    value={item.checkedOn}
                    onChange={(e) => onChange({ checkedOn: e.target.value })}
                    aria-describedby={`${idPrefix}-date-hint`}
                  />
                  <p id={`${idPrefix}-date-hint`} className="text-xs text-muted-foreground">
                    {t('compliance.safety.fields.dateHint')}
                  </p>
                </div>
              )}
              {detector && (
                <div className="space-y-1">
                  <Label htmlFor={`${idPrefix}-expires-on`}>{t('compliance.safety.fields.sensorEndOfLife')}</Label>
                  <Input
                    id={`${idPrefix}-expires-on`}
                    type="date"
                    value={item.expiresOn}
                    onChange={(e) => onChange({ expiresOn: e.target.value })}
                  />
                </div>
              )}
              {code === 'SystemsCompliance' && (
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`${idPrefix}-notes`}>{t('compliance.safety.fields.notes')}</Label>
                  <Textarea
                    id={`${idPrefix}-notes`}
                    maxLength={500}
                    value={item.notes}
                    onChange={(e) => onChange({ notes: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-1 sm:col-span-2">
                <p className="text-sm font-medium">{t('compliance.safety.fields.evidence')}</p>
                {item.evidenceDocumentId ? (
                  <p className="flex items-center gap-2 text-sm" data-testid={`safety-item-${code}-evidence`}>
                    <Paperclip className="h-4 w-4" />
                    <span className="truncate">{item.evidenceFileName ?? t('compliance.safety.fields.evidenceAttached')}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onChange({ evidenceDocumentId: null, evidenceFileName: null })}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      {t('compliance.safety.fields.removeEvidence')}
                    </Button>
                  </p>
                ) : (
                  <>
                    <input
                      ref={fileInput}
                      type="file"
                      accept={EVIDENCE_ACCEPT}
                      className="hidden"
                      data-testid={`safety-item-${code}-evidence-input`}
                      onChange={(e) => void handleEvidence(e.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={upload.isPending}
                      onClick={() => fileInput.current?.click()}
                    >
                      {upload.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Paperclip className="mr-2 h-4 w-4" />
                      )}
                      {t('compliance.safety.fields.uploadEvidence')}
                    </Button>
                  </>
                )}
                <p className="text-xs text-muted-foreground">{t('compliance.safety.fields.evidenceHint')}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
