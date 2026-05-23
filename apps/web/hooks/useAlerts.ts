import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useAlerts(patientId: string) {
  return useQuery({
    queryKey: ['alerts', patientId],
    queryFn: () => api.alerts.list(patientId),
    enabled: !!patientId,
    refetchInterval: 30_000, // poll every 30s for new critical alerts
  });
}

export function useResolveAlert(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, notes }: { alertId: string; notes?: string }) =>
      api.alerts.resolve(alertId, notes),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['alerts', patientId] }),
  });
}
