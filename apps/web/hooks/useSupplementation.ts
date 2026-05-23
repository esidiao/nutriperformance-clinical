import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useSupplementation(patientId: string) {
  return useQuery({
    queryKey: ['supplementation', patientId],
    queryFn: () => api.supplementation.list(patientId),
    enabled: !!patientId,
  });
}

export function useCreateSupplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => api.supplementation.create(dto),
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: ['supplementation', data.patientId] }),
  });
}

export function useUpdateSupplement(id: string, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => api.supplementation.update(id, dto),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['supplementation', patientId] }),
  });
}

export function useDeactivateSupplement(id: string, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.supplementation.deactivate(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['supplementation', patientId] }),
  });
}

export function useAnalyzeSupplementation(patientId: string) {
  return useMutation({
    mutationFn: () => api.supplementation.analyze(patientId),
  });
}
