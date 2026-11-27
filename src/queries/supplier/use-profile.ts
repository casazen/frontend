import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acceptSupplierTos, completeSupplierActivation, saveSupplierActivationStep, fetchSupplierActivation, fetchSupplierProfile, updateSupplierProfile, uploadSupplierPhotos } from '@/services/supplier-api';

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
      queryClient.setQueryData(['supplier', 'profile'], updated);
      queryClient.invalidateQueries({ queryKey: ['supplier'] });
    },
  });
}


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
