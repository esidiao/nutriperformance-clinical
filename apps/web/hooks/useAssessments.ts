import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// ── Nutritional ──────────────────────────────────────────────────────────────

export function useNutritionalAssessments(patientId: string) {
  return useQuery({
    queryKey: ['assessments', 'nutritional', patientId],
    queryFn: () => api.assessments.listNutritional(patientId),
    enabled: !!patientId,
  });
}

export function useNutritionalAssessment(id: string) {
  return useQuery({
    queryKey: ['assessments', 'nutritional', 'detail', id],
    queryFn: () => api.assessments.getNutritional(id),
    enabled: !!id,
  });
}

export function useCreateNutritionalAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => api.assessments.createNutritional(dto),
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: ['assessments', 'nutritional', data.patientId] }),
  });
}

export function useUpdateNutritionalAssessment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => api.assessments.updateNutritional(id, dto),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['assessments', 'nutritional', 'detail', id] }),
  });
}

export function useFinalizeNutritionalAssessment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.assessments.finalizeNutritional(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['assessments', 'nutritional', 'detail', id] }),
  });
}

export function useNutritionalAiSummary(id: string) {
  return useMutation({
    mutationFn: () => api.assessments.aiSummary(id),
  });
}

// ── Physical ─────────────────────────────────────────────────────────────────

export function usePhysicalAssessments(patientId: string) {
  return useQuery({
    queryKey: ['assessments', 'physical', patientId],
    queryFn: () => api.assessments.listPhysical(patientId),
    enabled: !!patientId,
  });
}

export function usePhysicalAssessment(id: string) {
  return useQuery({
    queryKey: ['assessments', 'physical', 'detail', id],
    queryFn: () => api.assessments.getPhysical(id),
    enabled: !!id,
  });
}

export function useCreatePhysicalAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => api.assessments.createPhysical(dto),
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: ['assessments', 'physical', data.patientId] }),
  });
}

export function useUpdatePhysicalAssessment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => api.assessments.updatePhysical(id, dto),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['assessments', 'physical', 'detail', id] }),
  });
}
