import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { BulkActivateRequest, BulkChoice, BulkSelection } from '@/types/onboarding.types';
import { ONBOARDING_FLOWS_KEY } from './use-onboarding-flows';
import { invalidateOnboarding } from './use-onboarding-plan';

/** Everything the bulk configuration reads (E10/F02, NF-105): the progress and the pilot group. */
export const ONBOARDING_BULK_KEY = ['onboarding', 'bulk'] as const;
const PILOT_KEY = [...ONBOARDING_BULK_KEY, 'pilot'] as const;

/** How often the progress is read again while the page is open (UX: «142 di 250 pronte» follows what the agency does on other pages). */
export const BULK_PROGRESS_REFETCH_MS = 15_000;

/**
 * What a change of the bulk configuration touches (E10/F03/US03/T02): the progress and the pilot group, the lists of the properties of every flow, the plan and
 * the path, the activation checklist and the «Da fare» list. Only the screens that show them (an active query) ask the server again.
 */
function invalidateBulk(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ONBOARDING_BULK_KEY });
  void queryClient.invalidateQueries({ queryKey: ONBOARDING_FLOWS_KEY });
  invalidateOnboarding(queryClient);
}

/**
 * «`ready` of `total` ready», the four counts of each flow and the pilot group (`GET /onboarding/bulk/progress`), read again every 15 seconds while the page is
 * open. The polling is not endless: it pauses while the tab is hidden (the default of TanStack Query) and stops at the first failure (a 403, a 404 or a server
 * that is down is not asked again every 15 seconds; a retry of the person, or the focus coming back to the window, reads it again and starts it again).
 * Organization administrator only: a page that anyone can open passes `enabled: false` for the others and sends nothing.
 */
export function useBulkProgress(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...ONBOARDING_BULK_KEY, 'progress'],
    queryFn: () => onboardingApi.bulkProgress(),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
    staleTime: 10 * 1000,
    refetchInterval: (query) => (query.state.status === 'error' ? false : BULK_PROGRESS_REFETCH_MS),
  });
}

/**
 * How many properties a selection reaches, with a sample of 20 (`POST /onboarding/bulk/preview`). It reads and writes nothing, and the selection is ids and codes of
 * comuni: the mutation is dropped as soon as nothing observes it (`gcTime: 0`) and a failure is kept without the request that was sent (`withoutRequest`).
 */
export function useBulkPreview() {
  return useMutation({
    mutationFn: async (selection: BulkSelection) => {
      try {
        return await onboardingApi.bulkPreview(selection);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
  });
}

interface BulkApplyVariables {
  selection: BulkSelection;
  choice: BulkChoice;
  /** `false` is the check (a dry run: the server writes nothing and says what each property would do); `true` is the apply. Never both asked at once. */
  confirmed: boolean;
}

/**
 * Applies one choice to a selection (`POST /onboarding/bulk/apply`), in two steps the screen never merges: the check first (`dryRun`, nothing is written), then
 * the same call confirmed. It touches many properties at once, so the answer is not kept (`gcTime: 0`) and a failure is kept without the request that was
 * sent (`withoutRequest`). Only a confirmed call changes anything, so only it makes the other screens read again (also when it fails: it may have done a part).
 * 422 `onboarding_selection_invalid`, `onboarding_selection_too_large`, `onboarding_choice_invalid`.
 */
export function useBulkApply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ selection, choice, confirmed }: BulkApplyVariables) => {
      try {
        return await onboardingApi.bulkApply({ selection, choice, dryRun: !confirmed, confirmed });
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: (_data, _error, variables) => {
      if (variables.confirmed) invalidateBulk(queryClient);
    },
  });
}

/** The pilot group: its members, the recommended minimum and the maximum, and how each flow has got on it (`GET /onboarding/bulk/pilot`). Read again at every visit. */
export function usePilotGroup(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: PILOT_KEY,
    queryFn: () => onboardingApi.getPilot(),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
    staleTime: 10 * 1000,
  });
}

/**
 * Sets the pilot group (`PUT /onboarding/bulk/pilot`): 1 to the maximum properties (an empty list is a 422, never «no pilot group»; more than the maximum is
 * 422 `pilot_group_too_large`; an id that is not a property of the agency is 404 `onboarding_property_not_found` and nothing is written). The answer is the group
 * as it stands and is put in the cache at once.
 */
export function useSetPilotGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propertyIds: string[]) => {
      try {
        return await onboardingApi.setPilot(propertyIds);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: (pilot) => queryClient.setQueryData(PILOT_KEY, pilot),
    onSettled: () => invalidateBulk(queryClient),
  });
}

/**
 * Activates flows on a cohort, the pilot group or the rest (`POST /onboarding/bulk/activate`): the server checks the prerequisites of each property again and
 * answers one outcome per property and flow. It touches many properties, so the answer is not kept (`gcTime: 0`) and a failure is kept without its request. The
 * others wait for the pilot group: 409 `pilot_group_not_active` while it is not set or not active in every flow asked. 422 `onboarding_flows_empty`,
 * `onboarding_pilot_group_empty`, `onboarding_cohort_invalid`. The other screens read again after it, also when it fails (it may have done a part).
 */
export function useBulkActivate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BulkActivateRequest) => {
      try {
        return await onboardingApi.bulkActivate(request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => invalidateBulk(queryClient),
  });
}

interface ImportVariables {
  /** The file as the person chose it: the page never opens it, the server reads it. */
  file: File;
  /** `true` checks every row and writes nothing; `false` imports only the valid rows. */
  dryRun: boolean;
}

/**
 * Checks or imports the file of the data that changes from one property to the next (`POST /onboarding/bulk/import?dryRun=`). The file may hold a lock code, so
 * the mutation is dropped as soon as nothing observes it (`gcTime: 0`: the cache of the mutations does not keep the file nor its answer) and a failure is kept
 * without the request that was sent (`withoutRequest`: an error of axios holds the body, the file). The address carries only `dryRun`. Only an import changes
 * anything, so only it makes the other screens read again (also when it fails). 413 `import_file_too_large`, 415 `import_file_type_unsupported`, 422
 * `import_too_many_rows`, `import_file_unreadable`, `import_file_empty`, `import_columns_unrecognized`.
 */
export function useImportProperties() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, dryRun }: ImportVariables) => {
      try {
        return await onboardingApi.importPropertyData(file, dryRun);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: (_data, _error, variables) => {
      if (!variables.dryRun) invalidateBulk(queryClient);
    },
  });
}
