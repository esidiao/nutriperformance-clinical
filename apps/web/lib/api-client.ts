import { createClient } from '@supabase/supabase-js';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Não autenticado');
  return session.access_token;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Erro na requisição');
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),

  // Patients
  patients: {
    list: () => api.get<any[]>('/patients'),
    get: (id: string) => api.get<any>(`/patients/${id}`),
    create: (dto: any) => api.post<any>('/patients', dto),
    update: (id: string, dto: any) => api.patch<any>(`/patients/${id}`, dto),
    requestDeletion: (id: string) => api.post<any>(`/patients/${id}/deletion-request`),
  },

  // Assessments
  assessments: {
    createNutritional: (dto: any) => api.post<any>('/assessments/nutritional', dto),
    listNutritional: (patientId: string) => api.get<any[]>(`/assessments/nutritional/patient/${patientId}`),
    getNutritional: (id: string) => api.get<any>(`/assessments/nutritional/${id}`),
    updateNutritional: (id: string, dto: any) => api.patch<any>(`/assessments/nutritional/${id}`, dto),
    finalizeNutritional: (id: string) => api.patch<any>(`/assessments/nutritional/${id}/finalize`),
    aiSummary: (id: string) => api.post<any>(`/assessments/nutritional/${id}/ai-summary`),
    createPhysical: (dto: any) => api.post<any>('/assessments/physical', dto),
    listPhysical: (patientId: string) => api.get<any[]>(`/assessments/physical/patient/${patientId}`),
    getPhysical: (id: string) => api.get<any>(`/assessments/physical/${id}`),
    updatePhysical: (id: string, dto: any) => api.patch<any>(`/assessments/physical/${id}`, dto),
    finalizePhysical: (id: string) => api.patch<any>(`/assessments/physical/${id}/finalize`),
  },

  // Supplementation
  supplementation: {
    list: (patientId: string) => api.get<any[]>(`/supplementation/patient/${patientId}`),
    create: (dto: any) => api.post<any>('/supplementation', dto),
    update: (id: string, dto: any) => api.patch<any>(`/supplementation/${id}`, dto),
    deactivate: (id: string) => api.patch<any>(`/supplementation/${id}/deactivate`),
    analyze: (patientId: string) => api.post<any>(`/supplementation/patient/${patientId}/analyze`),
  },

  // Laboratory
  laboratory: {
    list: (patientId: string) => api.get<any[]>(`/laboratory/patient/${patientId}`),
    latest: (patientId: string) => api.get<any>(`/laboratory/patient/${patientId}/latest`),
    create: (dto: any) => api.post<any>('/laboratory', dto),
    update: (id: string, dto: any) => api.patch<any>(`/laboratory/${id}`, dto),
    analyze: (id: string, supplementContext?: string[]) =>
      api.post<any>(`/laboratory/${id}/analyze`, { supplementContext }),
  },

  // Interactions
  interactions: {
    analyze: (dto: any) => api.post<any>('/interactions/analyze', dto),
    listByPatient: (patientId: string) => api.get<any[]>(`/interactions/patient/${patientId}`),
  },

  // Bioavailability
  bioavailability: {
    analyze: (dto: any) => api.post<any>('/bioavailability/analyze', dto),
    listByPatient: (patientId: string) => api.get<any[]>(`/bioavailability/patient/${patientId}`),
  },

  // Goals
  goals: {
    list: (patientId: string) => api.get<any[]>(`/goals/patient/${patientId}`),
    summary: (patientId: string) => api.get<any>(`/goals/patient/${patientId}/summary`),
    create: (dto: any) => api.post<any>('/goals', dto),
    update: (id: string, dto: any) => api.patch<any>(`/goals/${id}`, dto),
    addCheckpoint: (id: string, value: number, note?: string) =>
      api.post<any>(`/goals/${id}/checkpoint`, { value, note }),
    markAchieved: (id: string) => api.patch<any>(`/goals/${id}/achieve`),
    delete: (id: string) => api.delete<any>(`/goals/${id}`),
  },

  // Alerts
  alerts: {
    list: (patientId: string) => api.get<any[]>(`/alerts/${patientId}`),
    resolve: (alertId: string, notes?: string) =>
      api.patch<any>(`/alerts/${alertId}/resolve`, { notes }),
  },

  // Tokens
  tokens: {
    balance: () => api.get<any>('/tokens/balance'),
    history: () => api.get<any[]>('/tokens/history'),
    costs: () => api.get<any[]>('/tokens/costs'),
  },

  // Reports
  reports: {
    generate: (dto: any) => api.post<any>('/reports/generate', dto),
  },

  // Scientific base
  scientificBase: {
    health: () => api.get<any[]>('/scientific-base/health'),
    search: (q: string, category?: string) =>
      api.get<any[]>(`/scientific-base/search?q=${encodeURIComponent(q)}${category ? `&category=${category}` : ''}`),
  },

  supabase,
};
