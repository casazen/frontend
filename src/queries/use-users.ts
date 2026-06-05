import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UsersApi } from '@/api/users.api';
import type { RentalType, UpdateProfileRequest, UserRole } from '@/types';
import { toast } from 'sonner';

const USERS_KEY = 'users';
const ME_KEY = 'me';

interface GetUsersParams {
  page?: number;
  pageSize?: number;
  role?: string;
  isActive?: boolean;
  search?: string;
}

export function useUsers(params?: GetUsersParams) {
  return useQuery({
    queryKey: [USERS_KEY, params],
    queryFn: () => UsersApi.getUsers(params ?? {}),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: [USERS_KEY, id],
    queryFn: () => UsersApi.getUserById(id),
    enabled: !!id,
  });
}

export function useMe() {
  return useQuery({
    queryKey: [ME_KEY],
    queryFn: () => UsersApi.getMe(),
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => UsersApi.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ME_KEY] });
      toast.success('Profilo aggiornato con successo');
    },
    onError: () => {
      toast.error('Impossibile aggiornare il profilo');
    },
  });
}

export function useChangeUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      UsersApi.changeRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      toast.success('Ruolo aggiornato con successo');
    },
    onError: () => {
      toast.error('Impossibile aggiornare il ruolo');
    },
  });
}

export function useChangeUserRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: UserRole[] }) =>
      UsersApi.changeRoles(id, roles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      toast.success('Ruoli aggiornati con successo');
    },
    onError: () => {
      toast.error('Impossibile aggiornare i ruoli');
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rentalType: RentalType) => UsersApi.postOnboarding(rentalType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ME_KEY] });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => UsersApi.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      toast.success('Utente disattivato con successo');
    },
    onError: () => {
      toast.error('Impossibile disattivare l\'utente');
    },
  });
}
