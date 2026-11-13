import { useState } from 'react';
import { isAxiosError } from 'axios';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { leasesApi } from '@/api/leases.api';
import { useTriggerRegistration } from '@/queries/use-leases';
import type { LeaseDetail, RliChecklist } from '@/types';

/** Shared payment-first registration flow for the wizard and the lease sheet. The API verifies payment before filing. */
export function useRegistrationFlow(lease: LeaseDetail, checklist: RliChecklist | undefined) {
  const { t } = useTranslation();
  const triggerRegistration = useTriggerRegistration();
  const [preparationOpen, setPreparationOpen] = useState(false);
  const [delegaOpen, setDelegaOpen] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // The provider path exists only when the API says so (flag on and configured provider, LT-01); otherwise manual.
  const providerFilingAvailable = checklist?.providerFilingAvailable === true && !lease.isConcordatoFacileSource;

  const checkoutSucceeded = searchParams.get('registrationCheckout') === 'success';
  const dialogOpen = delegaOpen || (checkoutSucceeded && providerFilingAvailable);

  const handleDelegaOpenChange = (open: boolean) => {
    setDelegaOpen(open);
    if (!open && checkoutSucceeded) {
      const next = new URLSearchParams(searchParams);
      next.delete('registrationCheckout');
      setSearchParams(next, { replace: true });
    }
  };

  // The mutation reports its own errors (toast with the server's reason): only swallow the rejection.
  const handleDelegaConfirm = async (payload: { tosVersion: string; attestationAccepted: boolean }) => {
    try {
      await triggerRegistration.mutateAsync({
        id: lease.id,
        tosVersion: payload.tosVersion,
        attestationAccepted: payload.attestationAccepted,
      });
    } catch {
      // Keep the delegation open so payment settlement delays can be retried.
      return;
    }
    handleDelegaOpenChange(false);
  };

  const performCheckout = async (paid: boolean) => {
    if (paid) { setPreparationOpen(false); setDelegaOpen(true); return; }
    setStartingCheckout(true);
    try {
      const checkout = await leasesApi.createRegistrationCheckout(lease.id);
      window.location.assign(checkout.sessionUrl);
    } catch (error) {
      if (isAxiosError(error) && getProblemCode(error.response?.data) === 'openapi_registration_already_paid') {
        setPreparationOpen(false);
        setDelegaOpen(true);
      } else toast.error(getProblemMessage(error, t) ?? t('leaseWizard.after.registration.checkoutError'));
      setStartingCheckout(false);
    }
  };

  return {
    providerFilingAvailable,
    startCheckout: () => setPreparationOpen(true),
    preparationProps: {
      leaseId: lease.id,
      open: preparationOpen,
      onOpenChange: setPreparationOpen,
      onPrepared: performCheckout,
      isStartingCheckout: startingCheckout,
    },
    startingCheckout,
    openDelega: () => setDelegaOpen(true),
    dialogProps: {
      open: dialogOpen,
      onOpenChange: handleDelegaOpenChange,
      onConfirm: handleDelegaConfirm,
      isSubmitting: triggerRegistration.isPending,
    },
  };
}
