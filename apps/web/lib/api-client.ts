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

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  const token = await getToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('A requisição excedeu o tempo limite. Verifique sua conexão.', 408, path);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = (payload as Record<string, string>)['message'] ?? res.statusText ?? 'Erro na requisição';
    throw new ApiError(message, res.status, path);
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
    list: (params?: { page?: number; limit?: number; code?: string; active?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.code) qs.set('code', params.code);
      if (params?.active !== undefined) qs.set('active', String(params.active));
      const query = qs.toString();
      return api.get<{ items: any[]; total: number; page: number; pages: number; limit: number }>(
        `/patients${query ? `?${query}` : ''}`,
      );
    },
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

  // Curadoria / governança das bases (admin)
  curation: {
    overview: () => api.get<{
      foods: { byConfiabilidade: Array<{ confiabilidade: string; n: number }>; bySource: Array<{ fonte: string; n: number }> };
      products: { total: number };
      rag: { byFonte: Array<{ fonte: string; n: number }> };
      dataSources: Array<{ nome: string; versao: string | null; licenca: string | null; ultimo_import: string | null }>;
      recentImports: Array<{ fonte: string; linhas_inseridas: number; linhas_atualizadas: number; linhas_rejeitadas: number; created_at: string }>;
    }>('/curation/overview'),
    listFoods: (params?: { status?: string; q?: string; page?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.q) qs.set('q', params.q);
      if (params?.page) qs.set('page', String(params.page));
      const query = qs.toString();
      return api.get<{ items: any[]; total: number; page: number; pages: number }>(`/curation/foods${query ? `?${query}` : ''}`);
    },
    updateFood: (id: string, dto: { confiabilidade?: string; ativo?: boolean }) =>
      api.patch<any>(`/curation/foods/${id}`, dto),
  },

  // Assistente nutricional (RAG com fonte)
  assistant: {
    ask: (question: string) => api.post<{
      answer: string;
      sources: Array<{ fonte: string; fonteRef: string | null; confiabilidade: string; score: number }>;
      tokensConsumed: number;
    }>('/assistant/ask', { question }),
  },

  // Supplements catalog (NIH DSLD — domínio público, cache local)
  supplementsCatalog: {
    search: (q: string, limit = 10) => api.get<Array<{
      dsldId: string; nome: string | null; marca: string | null; formaFarmaceutica: string | null;
      ingredientesAtivos: Array<{ name: string; group?: string; notes?: string }>;
      flags: string[]; advertencias: string[]; pais: string; fonte: string; confiabilidade: string; licenca: string;
    }>>(`/supplements-catalog/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  },

  // Products (industrializados — Open Food Facts, cache local)
  products: {
    byBarcode: (ean: string) => api.get<{
      id: string; codigoBarras: string; marca: string | null; nomeComercial: string | null;
      ingredientes: string | null; alergenos: string[]; tabelaNutricional: Record<string, number>;
      aditivos: string[]; nutriScore: string | null; novaClassificacao: number | null;
      pais: string | null; imagemRotuloUrl: string | null; alertaNutricional: string[];
      fonte: string; confiabilidade: string; licenca: string; origem: 'cache' | 'openfoodfacts';
    }>(`/products/barcode/${encodeURIComponent(ean)}`),
    search: (q: string, limit = 20) => api.get<any[]>(`/products/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  },

  // Foods (base de composição — TACO/TBCA/USDA)
  foods: {
    search: (q: string, limit = 15) =>
      api.get<Array<{
        id: string; nome: string; grupoAlimentar: string | null; porcaoPadraoG: number;
        energiaKcal: number | null; proteinasG: number | null; carboidratosG: number | null; lipidiosG: number | null;
        sodioMg: number | null; fibrasG: number | null; fonte: string; fonteVersao: string | null; confiabilidade: string;
      }>>(`/foods/search?q=${encodeURIComponent(q)}&limit=${limit}`),
    get: (id: string) => api.get<any>(`/foods/${id}`),
    compare: (ids: string[]) => api.get<any[]>(`/foods/compare?ids=${ids.map(encodeURIComponent).join(',')}`),
    usda: (q: string, limit = 12) => api.get<Array<{
      id: string; nome: string; grupoAlimentar: string | null; energiaKcal: number | null;
      proteinasG: number | null; carboidratosG: number | null; lipidiosG: number | null;
      fibrasG: number | null; sodioMg: number | null; ferroMg: number | null;
      fonte: string; confiabilidade: string;
    }>>(`/foods/usda?q=${encodeURIComponent(q)}&limit=${limit}`),
  },

  // Dashboard
  dashboard: {
    stats: () => api.get<{
      patients: { total: number; active: number; withAlerts: number };
      alerts: { pending: number; critical: number };
      reports: { total: number };
      workspace: { plan: string; tokenBalance: number; tokenReserved: number };
      pendingAlerts: Array<{ id: string; severity: string; title: string; description: string; patientCode: string | null; createdAt: string }>;
      recentActivity: Array<{ operation: string; module: string | null; amount: number; description: string; createdAt: string }>;
    }>('/dashboard/stats'),
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
