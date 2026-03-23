import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '@/api/properties.api';
import type {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertySearchParams,
} from '@/types';
import { toast } from 'sonner';

const PROPERTIES_KEY = 'properties';

export function useProperties(params?: Record<string, any>) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, params],
    queryFn: () => propertiesApi.getAll(params),
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, id],
    queryFn: () => propertiesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePropertyDto) => propertiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      toast.success('Property created successfully');
    },
    onError: () => {
      toast.error('Failed to create property');
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePropertyDto }) =>
      propertiesApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.id] });
      toast.success('Property updated successfully');
    },
    onError: () => {
      toast.error('Failed to update property');
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => propertiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      toast.success('Property deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete property');
    },
  });
}

export function useSearchProperties(params?: PropertySearchParams) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, 'search', params],
    queryFn: () => propertiesApi.search(params || {}),
    enabled: !!params,
  });
}
