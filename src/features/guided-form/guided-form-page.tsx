import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileQuestion, Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useSeoMeta } from '@/lib/seo-meta';
import { useCfSimulatorCreatePractice, useCfSimulatorLink } from '@/queries/use-cf-simulator';
import type { CfPracticeStatus } from '@/types/concordatofacile.types';
import type { CfSimulatorLinkResponse } from '@/types/cf-simulator.types';
import { GuidedFormSubmitted } from './guided-form-panel';
import {
  hasSignedParams,
  readGuidedFormLink,
  readSavedPractice,
  savePractice,
  withoutSignedParams,
  type GuidedFormLink,
  type SubmittedPractice,
} from './lib/guided-form-link';

/**
 * `/guided-form`: the module that the signed link of a contract opens in the test environments (CF-SIM). The real service that prepares
 * the contract has no test environment of its own, so this page plays it: it checks the link the way the service does, takes the
 * practice in when the person sends it, and offers a test panel to move the practice through its states and to download the sample
 * documents. Public, like the real module (no sign-in); outside the test environments the API answers 404 and the page says it is not
 * available. The signed parameters leave the address as soon as the page has read them.
 */
export function GuidedFormPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  useSeoMeta({ title: t('guidedForm.title'), noindex: true });

  // The link as it arrived, read once; the practice sent from this tab, if the page is opened again without a link (a reload).
  const [link] = useState<GuidedFormLink>(() => readGuidedFormLink(searchParams));
  const [practice, setPractice] = useState<SubmittedPractice | null>(() => (link.hasParams ? null : readSavedPractice()));
  const check = useCfSimulatorLink(link.params, practice === null);

  useEffect(() => {
    if (hasSignedParams(searchParams)) setSearchParams(withoutSignedParams(searchParams), { replace: true });
  }, [searchParams, setSearchParams]);

  const sent = (next: SubmittedPractice) => {
    savePractice(next);
    setPractice(next);
  };

  const statusChanged = (status: CfPracticeStatus) => {
    if (!practice) return;
    sent({ ...practice, status });
  };

  if (practice) {
    return (
      <Shell>
        <TestNotice />
        <GuidedFormSubmitted practice={practice} onStatusChanged={statusChanged} />
      </Shell>
    );
  }

  if (check.isError && getHttpStatus(check.error) === 404) {
    return (
      <Shell>
        <Card data-testid="guided-form-unavailable">
          <CardHeader className="items-center text-center">
            <FileQuestion aria-hidden="true" className="mb-2 size-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold leading-tight tracking-tight">{t('guidedForm.unavailable')}</h1>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (check.isError) {
    return (
      <Shell>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p role="alert" className="text-sm text-destructive" data-testid="guided-form-load-error">
              {getProblemMessage(check.error, t) ?? t('guidedForm.loadError')}
            </p>
            <Button variant="outline" onClick={() => void check.refetch()}>
              {t('guidedForm.retry')}
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (!check.data) {
    return (
      <Shell>
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status" data-testid="guided-form-loading">
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          {t('guidedForm.checking')}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <TestNotice />
      <GuidedFormCard link={link} check={check.data} onSent={sent} />
    </Shell>
  );
}

/** One column on a quiet background: the module has no menu, it is a page of its own. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen justify-center bg-muted/40 p-4" data-testid="guided-form-page">
      <div className="w-full min-w-0 max-w-xl space-y-4 py-6">{children}</div>
    </main>
  );
}

/** What the person must know before anything: this is a test, nothing leaves CasaZen's test environment. */
function TestNotice() {
  const { t } = useTranslation();
  return (
    <Alert variant="info" data-testid="guided-form-test-notice">
      {t('guidedForm.testNotice')}
    </Alert>
  );
}

interface GuidedFormCardProps {
  link: GuidedFormLink;
  check: CfSimulatorLinkResponse;
  onSent: (practice: SubmittedPractice) => void;
}

/** The module before the practice is sent: the municipality received, whether the link is good, and the one button. */
function GuidedFormCard({ link, check, onSent }: GuidedFormCardProps) {
  const { t } = useTranslation();
  const create = useCfSimulatorCreatePractice();
  const comune = check.comune ?? link.params.comune ?? null;
  const provincia = check.provincia ?? link.params.provincia ?? null;

  const send = () => {
    create.mutate(link.params, {
      onSuccess: (created) =>
        onSent({
          practiceId: created.practiceId,
          controlToken: created.controlToken,
          status: created.status,
          linked: created.linked,
          leaseId: check.valid ? check.leaseId : null,
        }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <h1 className="text-2xl font-semibold leading-none tracking-tight">{t('guidedForm.title')}</h1>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('guidedForm.comune')}</dt>
          <dd className="font-medium" data-testid="guided-form-comune">
            {comune ?? t('guidedForm.notNamed')}
          </dd>
          <dt className="text-muted-foreground">{t('guidedForm.provincia')}</dt>
          <dd className="font-medium" data-testid="guided-form-provincia">
            {provincia ?? t('guidedForm.notNamed')}
          </dd>
        </dl>
        {check.valid ? (
          <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--color-success-foreground,#166534)]" data-testid="guided-form-link-valid">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            {t('guidedForm.linkValid')}
          </p>
        ) : (
          <Alert variant="warning" data-testid="guided-form-link-invalid">
            {t('guidedForm.linkInvalid')}
          </Alert>
        )}
        {create.isError ? (
          <p role="alert" className="text-sm text-destructive" data-testid="guided-form-submit-error">
            {getProblemMessage(create.error, t) ?? t('guidedForm.submitError')}
          </p>
        ) : null}
        <Button block size="lg" onClick={send} loading={create.isPending} data-testid="guided-form-submit">
          {t('guidedForm.submit')}
        </Button>
      </CardContent>
    </Card>
  );
}
