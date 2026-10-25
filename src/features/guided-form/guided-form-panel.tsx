import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, Upload } from 'lucide-react';
import { CfStatusBadge } from '@/components/cf-status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { getProblemMessage } from '@/lib/api-errors';
import { useCfSimulatorDocument, useCfSimulatorSetStatus } from '@/queries/use-cf-simulator';
import {
  CF_SIMULATOR_CLOSE_REASONS,
  CF_SIMULATOR_PANEL_DOCUMENTS,
  CF_SIMULATOR_STATUSES,
  type CfSimulatorCloseReason,
  type CfSimulatorStatus,
} from '@/types/cf-simulator.types';
import type { CfPracticeStatus } from '@/types/concordatofacile.types';
import { guidedFormContractPath, guidedFormUploadPath, type SubmittedPractice } from './lib/guided-form-link';

function asSettableStatus(status: CfPracticeStatus): CfSimulatorStatus {
  return CF_SIMULATOR_STATUSES.find((candidate) => candidate === status) ?? 'Received';
}

interface SubmittedViewProps {
  practice: SubmittedPractice;
  /** The state the practice has now: the page keeps it (and the tab remembers it). */
  onStatusChanged: (status: CfPracticeStatus) => void;
}

/**
 * What the module shows once the practice is sent: its number and state, and the test panel where whoever is trying the round does what the
 * service would do (moves the practice through its states and sends the documents by e-mail, here downloaded), then the way back into
 * CasaZen: the page that takes the documents in (`?practice=`) and the page of the contract.
 */
export function GuidedFormSubmitted({ practice, onStatusChanged }: SubmittedViewProps) {
  const { t } = useTranslation();
  const setStatus = useCfSimulatorSetStatus(practice.practiceId);
  const download = useCfSimulatorDocument(practice.practiceId, practice.controlToken);
  const [nextStatus, setNextStatus] = useState<CfSimulatorStatus>(() => asSettableStatus(practice.status));
  const [closeReason, setCloseReason] = useState<CfSimulatorCloseReason>('other');

  const apply = () => {
    setStatus.mutate(
      {
        controlToken: practice.controlToken,
        status: nextStatus,
        closeReason: nextStatus === 'ClosedWithoutAttestation' ? closeReason : undefined,
      },
      { onSuccess: (updated) => onStatusChanged(updated.status) },
    );
  };

  return (
    <>
      <Card data-testid="guided-form-submitted">
        <CardHeader>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">{t('guidedForm.submitted')}</h1>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('guidedForm.practiceNumber')}</dt>
            <dd className="break-all font-mono font-medium" data-testid="guided-form-practice-id">
              {practice.practiceId}
            </dd>
            <dt className="text-muted-foreground">{t('guidedForm.practiceStatus')}</dt>
            <dd>
              <CfStatusBadge status={practice.status} />
            </dd>
          </dl>
          <p className="text-sm text-muted-foreground" data-testid="guided-form-linked">
            {practice.linked ? t('guidedForm.practiceLinked') : t('guidedForm.practiceNotLinked')}
          </p>
        </CardContent>
      </Card>

      <Card data-testid="guided-form-panel">
        <CardHeader>
          <h2 className="text-lg font-semibold leading-none tracking-tight">{t('guidedForm.panel.title')}</h2>
          <CardDescription>{t('guidedForm.panel.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <Field label={t('guidedForm.status')}>
              <Select
                value={nextStatus}
                onChange={(event) => {
                  setNextStatus(event.target.value as CfSimulatorStatus);
                  setStatus.reset();
                }}
                data-testid="guided-form-status"
              >
                {CF_SIMULATOR_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`concordatofacile.status.statusLabels.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>
            {nextStatus === 'ClosedWithoutAttestation' ? (
              <Field label={t('guidedForm.closeReason')}>
                <Select
                  value={closeReason}
                  onChange={(event) => {
                    setCloseReason(event.target.value as CfSimulatorCloseReason);
                    setStatus.reset();
                  }}
                  data-testid="guided-form-close-reason"
                >
                  {CF_SIMULATOR_CLOSE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {t(`guidedForm.closeReasons.${reason}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Button variant="outline" onClick={apply} loading={setStatus.isPending} data-testid="guided-form-apply">
              {t('guidedForm.apply')}
            </Button>
            {setStatus.isSuccess ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t('guidedForm.applied')}
              </p>
            ) : null}
            {setStatus.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {getProblemMessage(setStatus.error, t) ?? t('guidedForm.applyError')}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t('guidedForm.documents.title')}</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {CF_SIMULATOR_PANEL_DOCUMENTS.map((kind) => (
                <Button
                  key={kind}
                  variant="outline"
                  size="sm"
                  onClick={() => download.mutate(kind)}
                  loading={download.isPending && download.variables === kind}
                  data-testid={`guided-form-download-${kind}`}
                >
                  <Download aria-hidden="true" className="size-4" />
                  {t(`guidedForm.documents.${kind}`)}
                </Button>
              ))}
            </div>
            {download.isError ? (
              <Alert variant="danger">{getProblemMessage(download.error, t) ?? t('guidedForm.documentError')}</Alert>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg" className="sm:flex-1">
          <a href={guidedFormUploadPath(practice.practiceId)} data-testid="guided-form-upload">
            <Upload aria-hidden="true" className="size-4" />
            {t('guidedForm.uploadData')}
          </a>
        </Button>
        {practice.leaseId ? (
          <Button asChild size="lg" variant="outline" className="sm:flex-1">
            <a href={guidedFormContractPath(practice.leaseId)} data-testid="guided-form-back">
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t('guidedForm.backToContract')}
            </a>
          </Button>
        ) : null}
      </div>
    </>
  );
}
