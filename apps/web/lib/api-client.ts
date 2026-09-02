import { createBrowserClient } from '@supabase/ssr';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Precisa ser o mesmo cliente do login e do AuthGuard (@supabase/ssr, sessão em
// cookie). Com o createClient de @supabase/supabase-js, a sessão era procurada
// no localStorage: o login funcionava, mas getSession() aqui devolvia null e
// TODA chamada autenticada morria em "Não autenticado" — o app inteiro, não só
// uma tela.
const supabase = createBrowserClient(
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

// A API roda no plano gratuito do Render, que hiberna após ~15 min sem tráfego.
// O primeiro request depois disso espera o container subir (~50s), então um
// teto único de 30s transformava todo primeiro acesso do dia em erro — e ainda
// culpava a conexão do usuário na mensagem.
const REQUEST_TIMEOUT_MS = 30_000;
const COLD_START_TIMEOUT_MS = 75_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Timeout ou queda de rede — casos em que vale reesperar por cold start. */
function isTransport(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && err.name === 'AbortError');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const token = await getToken();
  const url = `${API_BASE}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(url, init, timeoutMs);
  } catch (err: unknown) {
    if (!isTransport(err)) throw err;

    // Provável hibernação: repete uma vez com orçamento de cold start.
    try {
      res = await fetchWithTimeout(url, init, COLD_START_TIMEOUT_MS);
    } catch (retryErr: unknown) {
      if (isTransport(retryErr)) {
        throw new ApiError(
          'O servidor demorou a responder. Ele hiberna quando fica sem uso — tente novamente em alguns segundos.',
          504,
          path,
        );
      }
      throw retryErr;
    }
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = (payload as Record<string, string>)['message'] ?? res.statusText ?? 'Erro na requisição';
    throw new ApiError(message, res.status, path);
  }

  return res.json() as Promise<T>;
}

/**
 * Acorda a API sem bloquear a UI. Chamado no carregamento do app: enquanto o
 * usuário faz login, o container já está subindo, e a primeira tela com dados
 * costuma encontrar a instância de pé.
 *
 * `/health` é @Public() — não exige token, então roda antes da sessão existir.
 */
export function warmUp(): void {
  fetchWithTimeout(`${API_BASE}/health`, { method: 'GET' }, COLD_START_TIMEOUT_MS)
    .catch(() => undefined);
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
    // Transcrição de consulta gravada. Payload grande + Gemini processando o
    // áudio inteiro: o teto padrão de 30s do cliente não cobre.
    audioIntake: (
      kind: 'nutritional' | 'physical',
      body: { audioBase64: string; mimeType: string },
    ) => request<{
      transcricao: string;
      campos: Record<string, unknown>;
      observacoes: string;
      tokensConsumed: number;
    }>('POST', `/assessments/${kind}/audio-intake`, body, 180_000),
    createPhysical: (dto: any) => api.post<any>('/assessments/physical', dto),
    listPhysical: (patientId: string) => api.get<any[]>(`/assessments/physical/patient/${patientId}`),
    getPhysical: (id: string) => api.get<any>(`/assessments/physical/${id}`),
    updatePhysical: (id: string, dto: any) => api.patch<any>(`/assessments/physical/${id}`, dto),
    finalizePhysical: (id: string) => api.patch<any>(`/assessments/physical/${id}/finalize`),
  },

  // Supplementation
  // Agenda de consultas
  appointments: {
    list: (params: { de?: string; ate?: string; patientId?: string } = {}) => {
      const q = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as [string, string][],
      ).toString();
      return api.get<any[]>(`/appointments${q ? `?${q}` : ''}`);
    },
    get: (id: string) => api.get<any>(`/appointments/${id}`),
    create: (dto: any) => api.post<any>('/appointments', dto),
    update: (id: string, dto: any) => api.patch<any>(`/appointments/${id}`, dto),
    // Telessaude: sem `link`, o backend gera uma sala; com `link`, usa o dela.
    definirSala: (id: string, link?: string) =>
      api.patch<any>(`/appointments/${id}/sala`, link ? { link } : {}),
    removerSala: (id: string) => api.delete<any>(`/appointments/${id}/sala`),
    mudarStatus: (id: string, status: string, motivo?: string) =>
      api.patch<any>(`/appointments/${id}/status`, { status, motivo }),
    horariosLivres: (dia: string, duracaoMin?: number) =>
      api.get<string[]>(
        `/appointments/horarios-livres?dia=${encodeURIComponent(dia)}`
        + (duracaoMin ? `&duracaoMin=${duracaoMin}` : ''),
      ),
  },

  // Anamnese pre-consulta. A rota PUBLICA (/publico/anamnese/:token) nao passa
  // por aqui de proposito: este cliente anexa o token do Supabase, e a pagina
  // do paciente nao tem sessao.
  preConsult: {
    list: (patientId?: string) =>
      api.get<any[]>(`/pre-consult${patientId ? `?patientId=${patientId}` : ''}`),
    get: (id: string) => api.get<any>(`/pre-consult/${id}`),
    create: (dto: any) => api.post<any>('/pre-consult', dto),
    cancelar: (id: string) => api.patch<any>(`/pre-consult/${id}/cancelar`, {}),
  },

  // Diario alimentar. A rota PUBLICA (/publico/diario/:token) nao passa por
  // aqui: este cliente anexa o token do Supabase e a pagina do paciente nao
  // tem sessao.
  foodDiary: {
    links: (patientId?: string) =>
      api.get<any[]>(`/food-diary/links${patientId ? `?patientId=${patientId}` : ''}`),
    criarLink: (dto: any) => api.post<any>('/food-diary/links', dto),
    revogarLink: (id: string) => api.patch<any>(`/food-diary/links/${id}/revogar`, {}),
    registros: (patientId: string, params: { de?: string; ate?: string } = {}) => {
      const q = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as [string, string][],
      ).toString();
      return api.get<any>(`/food-diary/patient/${patientId}${q ? `?${q}` : ''}`);
    },
    comentar: (id: string, comentario: string) =>
      api.patch<any>(`/food-diary/entries/${id}/comentario`, { comentario }),
  },

  // Financeiro — registro de recebimento. Nao ha meio de pagamento aqui:
  // nenhuma rota cobra, integra gateway ou toca dado de cartao.
  charges: {
    list: (params: {
      status?: string; patientId?: string; de?: string; ate?: string;
    } = {}) => {
      const q = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as [string, string][],
      ).toString();
      return api.get<any[]>(`/charges${q ? `?${q}` : ''}`);
    },
    resumo: (mes?: string) => api.get<any>(`/charges/resumo${mes ? `?mes=${mes}` : ''}`),
    get: (id: string) => api.get<any>(`/charges/${id}`),
    create: (dto: any) => api.post<any>('/charges', dto),
    update: (id: string, dto: any) => api.patch<any>(`/charges/${id}`, dto),
    pagar: (id: string, dto: any) => api.patch<any>(`/charges/${id}/pagar`, dto),
    isentar: (id: string, motivo?: string) =>
      api.patch<any>(`/charges/${id}/isentar`, { motivo }),
    cancelar: (id: string, motivo: string) =>
      api.patch<any>(`/charges/${id}/cancelar`, { motivo }),
  },

  // Planos alimentares
  mealPlans: {
    list: (patientId: string) => api.get<any[]>(`/meal-plans/patient/${patientId}`),
    get: (id: string) => api.get<any>(`/meal-plans/${id}`),
    modelos: () => api.get<any[]>('/meal-plans/modelos'),
    salvarComoModelo: (id: string, nome?: string) =>
      api.post<any>(`/meal-plans/${id}/salvar-como-modelo`, { nome }),
    aplicarModelo: (modeloId: string, dto: any) =>
      api.post<any>(`/meal-plans/modelos/${modeloId}/aplicar`, dto),
    listaCompras: (id: string, dias?: number) =>
      api.get<any>(`/meal-plans/${id}/lista-compras${dias ? `?dias=${dias}` : ''}`),
    create: (dto: any) => api.post<any>('/meal-plans', dto),
    update: (id: string, dto: any) => api.patch<any>(`/meal-plans/${id}`, dto),
    remove: (id: string) => api.delete<any>(`/meal-plans/${id}`),
    duplicate: (id: string, nome?: string) =>
      api.post<any>(`/meal-plans/${id}/duplicate`, { nome }),
    addItem: (id: string, dto: any) => api.post<any>(`/meal-plans/${id}/items`, dto),
    removeItem: (id: string, itemId: string) =>
      api.delete<any>(`/meal-plans/${id}/items/${itemId}`),
  },

  supplementation: {
    list: (patientId: string) => api.get<any[]>(`/supplementation/patient/${patientId}`),
    create: (dto: any) => api.post<any>('/supplementation', dto),
    update: (id: string, dto: any) => api.patch<any>(`/supplementation/${id}`, dto),
    deactivate: (id: string) => api.patch<any>(`/supplementation/${id}/deactivate`),
    analyze: (patientId: string) => api.post<any>(`/supplementation/patient/${patientId}/analyze`),
  },

  // Laboratory
  // Portal do paciente — lacuna 2. A rota PUBLICA (/publico/portal/:token) nao
  // passa por aqui: este cliente anexa o token do Supabase.
  patientPortal: {
    links: (patientId?: string) =>
      api.get<any[]>(`/patient-portal/links${patientId ? `?patientId=${patientId}` : ''}`),
    criarLink: (dto: any) => api.post<any>('/patient-portal/links', dto),
    revogar: (id: string) => api.patch<any>(`/patient-portal/links/${id}/revogar`, {}),
  },

  // Fotos de evolucao corporal — lacuna 11. Nao ha rota publica: paciente nao
  // envia nem ve foto corporal por link.
  progressPhotos: {
    list: (patientId: string) => api.get<any[]>(`/progress-photos/patient/${patientId}`),
    criar: (dto: any) => api.post<any>('/progress-photos', dto),
    anotar: (id: string, observacao: string) =>
      api.patch<any>(`/progress-photos/${id}/observacao`, { observacao }),
    remover: (id: string) => api.delete<any>(`/progress-photos/${id}`),
  },

  // Supervisao de estagiario — lacuna 15.
  supervision: {
    list: (params: { status?: string; estudanteId?: string } = {}) => {
      const q = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as [string, string][],
      ).toString();
      return api.get<any[]>(`/supervision${q ? `?${q}` : ''}`);
    },
    doRecurso: (recurso: string, recursoId: string) =>
      api.get<any>(`/supervision/recurso/${recurso}/${recursoId}`),
    solicitar: (dto: any) => api.post<any>('/supervision', dto),
    decidir: (id: string, dto: any) => api.patch<any>(`/supervision/${id}/decidir`, dto),
    pendentes: () => api.get<any>('/supervision/pendentes/contagem'),
  },

  laboratory: {
    list: (patientId: string) => api.get<any[]>(`/laboratory/patient/${patientId}`),
    latest: (patientId: string) => api.get<any>(`/laboratory/patient/${patientId}/latest`),
    create: (dto: any) => api.post<any>('/laboratory', dto),
    // Devolve RASCUNHO para conferencia — nao grava nada.
    extrairPdf: (pdfBase64: string) =>
      api.post<any>('/laboratory/extrair-pdf', { pdfBase64 }),
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

  // Painel administrativo (role admin / institutional_manager)
  admin: {
    metrics: () => api.get<{
      totalWorkspaces: number; activeWorkspaces: number;
      totalUsers: number; activeUsers: number;
      totalPatients: number; tokensConsumedThisMonth: number; mrrBrl: number;
      moduleUsage: Array<{ operation: string; uses: string; tokens_consumed: string }>;
    }>('/admin/metrics'),

    listWorkspaces: (params?: { page?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return api.get<{
        items: Array<{
          id: string; name: string; plan: string; token_balance: number; token_reserved: number;
          is_active: boolean; created_at: string; user_count: string; patient_count: string;
        }>;
        total: number; page: number; limit: number; pages: number;
      }>(`/admin/workspaces${query ? `?${query}` : ''}`);
    },

    adjustTokens: (workspaceId: string, amount: number, reason: string) =>
      api.patch<any>(`/admin/workspaces/${workspaceId}/tokens`, { amount, reason }),
    suspendWorkspace: (workspaceId: string) =>
      api.patch<any>(`/admin/workspaces/${workspaceId}/suspend`),
    reactivateWorkspace: (workspaceId: string) =>
      api.patch<any>(`/admin/workspaces/${workspaceId}/reactivate`),

    auditLogs: (params?: {
      page?: number; limit?: number; workspaceId?: string;
      userId?: string; resource?: string; from?: string; to?: string;
    }) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params ?? {})) {
        if (v !== undefined && v !== '') qs.set(k, String(v));
      }
      const query = qs.toString();
      return api.get<{
        items: Array<{
          id: string; workspace_id: string | null; user_id: string | null;
          patient_id: string | null; action: string; resource: string;
          resource_id: string | null; ip_address: string | null;
          success: boolean; created_at: string; user_email: string | null;
        }>;
        total: number; page: number; limit: number; pages: number;
      }>(`/admin/audit-logs${query ? `?${query}` : ''}`);
    },

    scientificBaseHealth: () => api.get<Array<{
      category: string; lastUpdatedAt: string; daysSinceUpdate: number;
      isStale: boolean; totalReferences: number; highEvidenceCount: number;
    }>>('/admin/scientific-base/health'),
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
