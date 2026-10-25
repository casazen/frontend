import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useFormContext, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FileSearch } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { LeaseDraftFlow, LeaseReading, LeaseReadingField } from '@/types';
import { WIZARD_BUTTON } from './lease-wizard-frame';
import { markReadSeen, readSeenId, seenReads, seenStoreKey } from './reading-seen';
import { flowStep, type WizardValues } from './wizard-model';

/**
 * What the reading of the contract the owner uploaded did to the draft (NL-DOCS), for the steps that show its values: which fields it
 * wrote (`Read`) and which it found different from what was typed (`Conflict`), by the names the server gives them, and the flow, so
 * that a step the person has been through (`Done`) stops saying «controlla». The server sends names and fates, never the values.
 */
interface ReadingIndex {
  fields: readonly LeaseReadingField[];
  flow: LeaseDraftFlow;
  /** Where the values the person already changed are remembered, so that their mark does not come back (`reading-seen`); none without a reading. */
  storeKey: string | null;
}

const ReadingContext = createContext<ReadingIndex | null>(null);

export function ReadingProvider({
  reading,
  flow,
  leaseId,
  children,
}: {
  reading: LeaseReading | null;
  flow: LeaseDraftFlow;
  leaseId: string;
  children: ReactNode;
}) {
  const value = useMemo<ReadingIndex>(
    () => ({
      fields: reading?.state === 'Done' ? reading.fields : [],
      flow,
      storeKey: reading?.contractDocumentId ? seenStoreKey(leaseId, reading.contractDocumentId) : null,
    }),
    [reading, flow, leaseId],
  );
  return <ReadingContext.Provider value={value}>{children}</ReadingContext.Provider>;
}

interface ReadMarkProps {
  /** The step the field is in: once the person has been through it the note goes (its values were looked at). */
  step: 2 | 3 | 4;
  /** The names the server gave to what it read, for this block of the screen. */
  fields: readonly string[];
  /** The entry of the draft when the block is a person; none for a value of the contract. */
  partyId?: string;
  /** The field (or the group of fields) of the form: once the person changes it the note goes. */
  name: FieldPath<WizardValues>;
}

/**
 * A quiet line under a value, or a person, that the contract filled in: «letto dal contratto — controlla»; and, where the contract says
 * something else than what the person had typed, that it does (the typed value stays). Nothing when the contract was not read, when it
 * agrees, when the step is done or when the person already changed the value — also after the draft is read again, which makes the saved
 * value the starting point of the form (NL-DOCS-FU9: the change is remembered for the tab, see `reading-seen`).
 */
export function ReadMark({ step, fields, partyId, name }: ReadMarkProps) {
  const { t } = useTranslation();
  const context = useContext(ReadingContext);
  const { getFieldState, formState } = useFormContext<WizardValues>();
  const seenId = readSeenId(partyId, fields);
  const changed = getFieldState(name, formState).isDirty;
  const storeKey = context?.storeKey ?? null;
  useEffect(() => {
    if (storeKey && changed) markReadSeen(storeKey, seenId);
  }, [storeKey, changed, seenId]);

  if (!context || partyId === '' || flowStep(context.flow, step)?.state === 'Done' || changed || (storeKey !== null && seenReads(storeKey).has(seenId))) return null;

  const mine = context.fields.filter((item) => fields.includes(item.field) && (partyId === undefined ? item.partyId === null : item.partyId === partyId));
  const conflict = mine.some((item) => item.state === 'Conflict');
  const read = mine.filter((item) => item.state === 'Read');
  if (!conflict && read.length === 0) return null;

  const lines = [
    ...(read.length > 0 ? [read.every((item) => item.derived) ? 'derived' : 'mark'] : []),
    ...(conflict ? ['conflict'] : []),
  ];
  return (
    <div className="space-y-0.5" data-testid="lease-read-mark">
      {lines.map((line) => (
        <p key={line} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <FileSearch aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">{t(`leaseWizard.documents.read.${line}`)}</span>
        </p>
      ))}
    </div>
  );
}

/** The codes the server gives to a document it could not read; each has its sentence. */
const FAILURES: ReadonlySet<string> = new Set(['file_missing', 'no_text', 'nothing_found', 'ocr_unavailable', 'unreadable']);

/**
 * What the person is told once, on top of the wizard, about the contract they uploaded. `held`: the reading ended while the wizard was
 * already open, so its values are on the server and not yet in the form (NL-DOCS-FU8): the wizard says so with `ReadingArrivedNotice`,
 * and this does not claim that the data are filled in.
 */
export function ReadingBanner({ reading, flow, held = false }: { reading: LeaseReading | undefined; flow: LeaseDraftFlow; held?: boolean }) {
  const { t } = useTranslation();
  if (!reading || reading.state === 'None') return null;

  if (reading.state === 'Reading') {
    return (
      <Alert variant="info" data-testid="lease-reading-ongoing">
        {t('leaseWizard.documents.read.ongoing')}
      </Alert>
    );
  }

  if (reading.state === 'Failed') {
    const code = reading.documents.find((document) => document.error)?.error;
    return (
      <Alert variant="warning" data-testid="lease-reading-failed">
        {t(`leaseWizard.documents.read.failed.${code && FAILURES.has(code) ? code : 'default'}`)}
      </Alert>
    );
  }

  const wrongProperty = reading.fields.some((item) => item.field === 'property' && item.state === 'Conflict');
  const filled = reading.fields.some((item) => item.state === 'Read');
  return (
    <>
      {wrongProperty ? (
        <Alert variant="warning" data-testid="lease-reading-property">
          {t('leaseWizard.documents.read.property')}
        </Alert>
      ) : null}
      {filled && !held && flowStep(flow, 4)?.state !== 'Done' ? (
        <Alert variant="info" data-testid="lease-reading-done">
          {t('leaseWizard.documents.read.banner')}
        </Alert>
      ) : null}
    </>
  );
}

/**
 * The reading of the contract ended while the person was filling the wizard in by hand: nothing of what they wrote is touched and the
 * draft is not read again under their hands (that lost their last keystrokes, or gave a conflict of version). The values read are shown
 * when the person asks (NL-DOCS-FU8).
 */
export function ReadingArrivedNotice({ onShow, busy }: { onShow: () => void; busy: boolean }) {
  const { t } = useTranslation();
  return (
    <Alert
      variant="info"
      data-testid="lease-reading-arrived"
      action={
        <Button type="button" size="sm" variant="outline" className={WIZARD_BUTTON} loading={busy} onClick={onShow} data-testid="lease-reading-show">
          {t('leaseRound.reading.show')}
        </Button>
      }
    >
      {t('leaseRound.reading.arrived')}
    </Alert>
  );
}
