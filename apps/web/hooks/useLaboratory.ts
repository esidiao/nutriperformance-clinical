import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useLaboratoryExams(patientId: string) {
  return useQuery({
    queryKey: ['laboratory', patientId],
    queryFn: () => api.laboratory.list(patientId),
    enabled: !!patientId,
  });
}

export function useLatestLaboratoryExam(patientId: string) {
  return useQuery({
    queryKey: ['laboratory', patientId, 'latest'],
    queryFn: () => api.laboratory.latest(patientId),
    enabled: !!patientId,
  });
}

export function useCreateLaboratoryExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => api.laboratory.create(dto),
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: ['laboratory', data.patientId] }),
  });
}

export function useUpdateLaboratoryExam(id: string, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => api.laboratory.update(id, dto),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['laboratory', patientId] }),
  });
}

export function useAnalyzeLaboratory(id: string) {
  return useMutation({
    mutationFn: (supplementContext?: string[]) =>
      api.laboratory.analyze(id, supplementContext),
  });
}
