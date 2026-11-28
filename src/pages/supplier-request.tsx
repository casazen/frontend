import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShowcaseBookingGate } from '@/components/supplier-site/booking-gate';
import { useViewPolling } from '@/components/supplier-site/inquiry/use-view-polling';
import { RequestGate } from '@/components/supplier-site/request/request-gate';
import { RequestView } from '@/components/supplier-site/request/request-view';
import { useSupplierSite } from '@/components/supplier-site/site-context';
import { SITE_STYLES } from '@/lib/supplier-site/style-config';
import { useBookingRequest } from '@/queries/use-public-supplier-booking';
import '@/styles/supplier-site-booking.css';
import '@/styles/supplier-site-inquiry.css';

const POLL_MS = 30_000;
const POLL_MAX_MS = 120_000;

function RequestArea() {
  const { model } = useSupplierSite();
  const [search] = useSearchParams();
  const request = useBookingRequest(model.slug);
  const view = request.session?.view ?? null;

  useViewPolling({
    enabled: view !== null && view.kind === 'Custom' && (view.status === 'Richiesto' || view.thread?.canWrite === true),
    baseMs: POLL_MS,
    maxMs: POLL_MAX_MS,
    tick: request.refresh,
  });

  const site = useMemo(
    () => ({
      typicalResponseMinutes: model.trust.find((item) => item.kind === 'response')?.minutes ?? null,
      buttonColor: model.buttonColor ?? SITE_STYLES[model.style].cta,
    }),
    [model.trust, model.buttonColor, model.style],
  );

  if (request.session) {
    return <RequestView view={request.session.view} failure={request.failure} pending={request.pending} act={request.act} quiet={request.quiet} site={site} />;
  }
  return <RequestGate initialCode={search.get('code') ?? ''} pending={request.pending} failure={request.failure} onFind={(code, email) => void request.find(code, email)} />;
}

export function SupplierRequestPage() {
  return (
    <ShowcaseBookingGate>
      <RequestArea />
    </ShowcaseBookingGate>
  );
}
