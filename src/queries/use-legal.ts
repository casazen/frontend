import { useQuery } from '@tanstack/react-query';
import { LegalApi } from '@/api/legal.api';

export function useLegalDocuments() {
  const tos = useQuery({ queryKey: ['legal', 'tos'], queryFn: () => LegalApi.getTos() });
  const privacy = useQuery({ queryKey: ['legal', 'privacy'], queryFn: () => LegalApi.getPrivacy() });
  const dpa = useQuery({ queryKey: ['legal', 'dpa'], queryFn: () => LegalApi.getDpa() });
  const subprocessors = useQuery({
    queryKey: ['legal', 'subprocessors'],
    queryFn: () => LegalApi.getSubprocessors(),
  });

  const isLoading = tos.isLoading || privacy.isLoading || dpa.isLoading || subprocessors.isLoading;
  const isError = tos.isError || privacy.isError || dpa.isError || subprocessors.isError;

  return {
    tos: tos.data,
    privacy: privacy.data,
    dpa: dpa.data,
    subprocessors: subprocessors.data,
    isLoading,
    isError,
  };
}
