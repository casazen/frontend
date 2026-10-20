import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acceptSupplierTos, completeSupplierActivation, saveSupplierActivationStep, fetchSupplierActivation, fetchSupplierShowcasePreview, fetchSupplierProfile, updateSupplierProfile, uploadSupplierPhotos } from '@/services/supplier-api';

export function useSupplierActivation() {
  return useQuery({
    queryKey: ['supplier', 'activation'],
    queryFn: fetchSupplierActivation,
  });
}


export function useSupplierProfile() {
  return useQuery({
    queryKey: ['supplier', 'profile'],
    queryFn: fetchSupplierProfile,
  });
}


export function useCompleteSupplierActivation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tosAccepted, tosVersion }: { tosAccepted: boolean; tosVersion: string }) =>
      completeSupplierActivation(tosAccepted, tosVersion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier'] });
    },
  });
}


/** Saves the wizard step; the activation status is not refetched (the wizard keeps its own step while it is open). */
export function useSaveSupplierActivationStep() {
  return useMutation({ mutationFn: saveSupplierActivationStep });
}


export function useAcceptSupplierTos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptSupplierTos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier'] });
    },
  });
}


export function useUpdateSupplierProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSupplierProfile,
    onSuccess: (updated) => {
      // Update the profile cache immediately with the response from the server.
      // This avoids a stale-data window caused by staleTime + refetchOnMount.
      queryClient.setQueryData(['supplier', 'profile'], updated);
      queryClient.invalidateQueries({ queryKey: ['supplier'] });
    },
  });
}


/**
 * True while the caller's supplier profile is suspended (SU-12): the console then shows a banner and offers no action
 * on the requests. Unknown (loading, error) counts as not suspended: the API refuses the action anyway.
 */
export function useSupplierSuspended(): boolean {
  const { data } = useSupplierProfile();
  return data?.status === 'Suspended';
}


export function useUploadSupplierPhotos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadSupplierPhotos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', 'profile'] });
    },
  });
}


/** The owner's preview of the public showcase (SU-13). */
export function useSupplierShowcasePreview() {
  return useQuery({
    queryKey: ['supplier', 'showcase'],
    queryFn: fetchSupplierShowcasePreview,
  });
}
