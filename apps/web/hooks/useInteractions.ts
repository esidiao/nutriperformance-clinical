import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useInteractions(patientId: string) {
  return useQuery({
    queryKey: ['interactions', patientId],
    queryFn: () => api.interactions.listByPatient(patientId),
    enabled: !!patientId,
  });
}

export function useAnalyzeInteractions(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => api.interactions.analyze(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interactions', patientId] });
      qc.invalidateQueries({ queryKey: ['alerts', patientId] });
    },
  });
}
