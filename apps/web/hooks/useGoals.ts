import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useGoals(patientId: string) {
  return useQuery({
    queryKey: ['goals', patientId],
    queryFn: () => api.goals.list(patientId),
    enabled: !!patientId,
  });
}

export function useGoalsSummary(patientId: string) {
  return useQuery({
    queryKey: ['goals', patientId, 'summary'],
    queryFn: () => api.goals.summary(patientId),
    enabled: !!patientId,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => api.goals.create(dto),
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: ['goals', data.patientId] }),
  });
}

export function useAddCheckpoint(goalId: string, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ value, note }: { value: number; note?: string }) =>
      api.goals.addCheckpoint(goalId, value, note),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['goals', patientId] }),
  });
}

export function useMarkGoalAchieved(goalId: string, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.goals.markAchieved(goalId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['goals', patientId] }),
  });
}

export function useDeleteGoal(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => api.goals.delete(goalId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['goals', patientId] }),
  });
}
