import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { marketingStudioApi } from '@/api/marketing-studio.api';
import { Button } from '@/components/ui/button';
import { CRM_GUESTS_KEY } from '@/queries/crm';
import { useProperties } from '@/queries/use-properties';
import {
  IMPORT_FIELDS,
  canImport,
  detectColumns,
  importFileProblem,
  wireMapping,
  type ColumnMapping,
  type ImportBasis,
  type ImportField,
} from './import-columns';
import { ColumnsStep, FileStep, ImportDone, OriginStep, PermissionStep } from './import-steps';
import { LayerWizard } from './layer-wizard';
import { marketingErrorText } from './marketing-error';
import { propertyOption } from './property-options';

type StepId = 'file' | 'columns' | 'permission' | 'origin';

const STEP_IDS: readonly StepId[] = ['file', 'columns', 'permission', 'origin'];

export interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGroup?: () => void;
}

export function ImportWizard(props: ImportWizardProps) {
  return props.open ? <ImportWizardBody {...props} /> : null;
}

function ImportWizardBody({ onOpenChange, onCreateGroup }: ImportWizardProps) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const properties = useProperties({ mode: 'short' });
  const propertyOptions = useMemo(() => (properties.data ?? []).map(propertyOption), [properties.data]);

  const [step, setStep] = useState<StepId>('file');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<'type' | 'size' | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [detected, setDetected] = useState<ColumnMapping>({});
  const [basis, setBasis] = useState<ImportBasis | null>(null);
  const [chosenProperty, setChosenProperty] = useState('');
  const [source, setSource] = useState('');

  const propertyId = chosenProperty || (propertyOptions.length === 1 ? propertyOptions[0].id : '');

  const preview = useMutation({
    mutationFn: marketingStudioApi.previewImport,
    onSuccess: (data) => {
      const found = detectColumns(data.headers);
      setMapping(found);
      setDetected(found);
    },
  });
  const submit = useMutation({
    mutationFn: () => marketingStudioApi.importGuests(file as File, wireMapping(mapping), propertyId, basis as ImportBasis, source.trim()),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['segments'] });
      void client.invalidateQueries({ queryKey: CRM_GUESTS_KEY });
    },
  });

  const forgetFile = () => {
    preview.reset();
    submit.reset();
    setMapping({});
    setDetected({});
  };

  const pickFile = (next: File) => {
    forgetFile();
    const found = importFileProblem(next);
    setProblem(found);
    if (found) {
      setFile(null);
      return;
    }
    setFile(next);
    preview.mutate(next);
  };

  const clearFile = () => {
    forgetFile();
    setProblem(null);
    setFile(null);
  };

  const changeColumn = (field: ImportField, column: number | null) => {
    setMapping((current) => {
      const nextMapping = { ...current };
      if (column === null) delete nextMapping[field];
      else nextMapping[field] = column;
      return nextMapping;
    });
  };

  const stepList = STEP_IDS.map((id) => ({ id, label: t(`marketingHub.importWizard.steps.${id}`) }));
  const stepIndex = STEP_IDS.indexOf(step);
  const title = t('marketingHub.importWizard.title');
  const headers = preview.data?.headers ?? [];

  if (submit.data) {
    const result = submit.data;
    return (
      <LayerWizard
        open
        onOpenChange={onOpenChange}
        icon={Upload}
        title={title}
        steps={stepList}
        stepIndex={STEP_IDS.length - 1}
        showStepper={false}
        heading={t('marketingHub.importWizard.done.title')}
        testId="import-wizard"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-4">
            <Button type="button" variant={result.imported > 0 ? 'outline' : 'default'} onClick={() => onOpenChange(false)} data-testid="import-wizard-close">
              {t('marketingHub.layer.close')}
            </Button>
            {result.imported > 0 ? (
              <Button asChild variant="outline">
                <Link to="/app/short-rent/crm/guests" onClick={() => onOpenChange(false)}>
                  {t('marketingHub.importWizard.done.guests')}
                </Link>
              </Button>
            ) : null}
            {result.imported > 0 && onCreateGroup ? (
              <Button type="button" onClick={onCreateGroup} data-testid="import-wizard-group">
                {t('marketingHub.importWizard.done.group')}
              </Button>
            ) : null}
          </div>
        }
      >
        <ImportDone result={result} />
      </LayerWizard>
    );
  }

  const permissionReady = basis !== null && (basis !== 'softOptIn' || mapping.lastStay !== undefined);
  const originReady = propertyId !== '' && source.trim() !== '';
  const goOn = t('marketingHub.layer.continue');

  const next =
    step === 'file'
      ? { label: goOn, onClick: () => setStep('columns'), disabled: !preview.data, loading: preview.isPending }
      : step === 'columns'
        ? { label: goOn, onClick: () => setStep('permission'), disabled: !canImport(mapping) }
        : step === 'permission'
          ? { label: goOn, onClick: () => setStep('origin'), disabled: !permissionReady }
          : { label: t('marketingHub.importWizard.origin.submit'), onClick: () => submit.mutate(), disabled: !originReady, loading: submit.isPending, icon: <Upload /> };

  return (
    <LayerWizard
      open
      onOpenChange={onOpenChange}
      icon={Upload}
      title={title}
      steps={stepList}
      stepIndex={stepIndex}
      heading={t(`marketingHub.importWizard.${step}.title`)}
      purpose={t(`marketingHub.importWizard.${step}.purpose`)}
      busy={preview.isPending || submit.isPending}
      onBack={step === 'file' ? undefined : () => setStep(STEP_IDS[stepIndex - 1])}
      onStepSelect={(index) => {
        if (index < stepIndex) setStep(STEP_IDS[index]);
      }}
      next={next}
      testId="import-wizard"
    >
      {step === 'file' ? (
        <FileStep
          file={file}
          reading={preview.isPending}
          rows={preview.data ? preview.data.totalRows : null}
          problem={problem}
          error={preview.isError ? marketingErrorText(preview.error, t, t('marketingHub.errors.importReadFailed')) : null}
          onFile={pickFile}
          onClear={clearFile}
        />
      ) : null}

      {step === 'columns' && preview.data ? (
        <ColumnsStep headers={headers} sample={preview.data.sample} mapping={mapping} detected={detected} onChange={changeColumn} />
      ) : null}

      {step === 'permission' ? (
        <PermissionStep basis={basis} headers={headers} mapping={mapping} onBasis={setBasis} onLastStay={(column) => changeColumn('lastStay', column)} />
      ) : null}

      {step === 'origin' && basis && file ? (
        <OriginStep
          basis={basis}
          properties={propertyOptions}
          loadingProperties={properties.isPending}
          propertiesError={properties.isError ? marketingErrorText(properties.error, t) : null}
          propertyId={propertyId}
          onProperty={setChosenProperty}
          source={source}
          onSource={setSource}
          fileName={file.name}
          rows={preview.data?.totalRows ?? 0}
          fields={IMPORT_FIELDS.filter((field) => mapping[field] !== undefined)}
          error={submit.isError ? marketingErrorText(submit.error, t, t('marketingHub.errors.importFailed')) : null}
        />
      ) : null}
    </LayerWizard>
  );
}
