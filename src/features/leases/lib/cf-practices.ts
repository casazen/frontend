import { useCfAccess, useCfStatus } from '@/queries/use-concordatofacile';

/** A practice of the service that is closed without an attestation: the form can be filled in again. Any other one is under way or done. */
const CLOSED_PRACTICE = 'ClosedWithoutAttestation';

/**
 * The practices of the lease the sheet follows, as the server reads them (CF-FLOW, CF-DONE): the access says whether the form was ever
 * opened and only then the status is asked, so a lease that never reached the form costs the service no reading. `running` is the practice
 * that is under way or done (the first one that is not closed); `closed` the newest one that was closed without an attestation, when
 * there is no running one. Both are `undefined` while the status is not known.
 */
export function useCfPractices(leaseId: string) {
  const access = useCfAccess(leaseId);
  const opened = access.data?.hasAccess === true && Boolean(access.data.linkOpenedAt);
  // Asked only where there is an access and the form was opened at least once: before that there is nothing to read.
  const status = useCfStatus(leaseId, { enabled: opened });
  const running = status.data?.practices.find((practice) => practice.status !== CLOSED_PRACTICE);
  // No practice under way: the last one that was closed (the newest), to say what became of it.
  const closed = status.data?.practices
    .filter((practice) => practice.status === CLOSED_PRACTICE)
    .sort((a, b) => (Date.parse(b.statusChangedAt) || 0) - (Date.parse(a.statusChangedAt) || 0))[0];
  return { access, opened, status, running, closed };
}
