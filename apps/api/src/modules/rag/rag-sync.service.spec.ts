import { RagSyncService } from './rag-sync.service';

describe('RagSyncService', () => {
  let dataSource: any;
  let ragService: any;
  let service: RagSyncService;

  const FOOD = {
    id: 'f1', nome_padronizado: 'Arroz', grupo_alimentar: 'Cereais', porcao_padrao_g: 100,
    energia_kcal: 128, proteinas_g: 2.5, carboidratos_g: 28, lipidios_g: 0.2,
    fibras_g: 1.6, sodio_mg: 1, ferro_mg: 0.1, calcio_mg: 4, potassio_mg: 26,
    magnesio_mg: 2, zinco_mg: 0.5, fonte: 'taco',
  };

  /** Fila de respostas para as chamadas SQL, na ordem em que o service as faz. */
  function withQueries(...results: any[]) {
    const q = jest.fn();
    results.forEach((r) => q.mockResolvedValueOnce(r));
    q.mockResolvedValue([]);
    dataSource = { query: q };
    ragService = { indexChunk: jest.fn().mockResolvedValue(undefined) };
    service = new RagSyncService(dataSource, ragService);
    return q;
  }

  beforeEach(() => jest.useFakeTimers({ advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

  it('devolve null quando não consegue o advisory lock (outra instância rodando)', async () => {
    withQueries([{ locked: false }]);
    await expect(service.syncMissingFoods()).resolves.toBeNull();
  });

  it('não segura o lock quando não o adquiriu', async () => {
    const q = withQueries([{ locked: false }]);
    await service.syncMissingFoods();
    const unlocks = q.mock.calls.filter((c) => String(c[0]).includes('pg_advisory_unlock'));
    expect(unlocks).toHaveLength(0);
  });

  it('devolve contagem zerada quando não há alimento pendente', async () => {
    withQueries([{ locked: true }], []);
    await expect(service.syncMissingFoods()).resolves.toEqual({
      candidatos: 0, indexados: 0, falhas: 0,
    });
  });

  it('indexa os pendentes e resume o resultado', async () => {
    withQueries([{ locked: true }], [FOOD, { ...FOOD, id: 'f2' }]);
    const res = await service.syncMissingFoods();
    expect(ragService.indexChunk).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ candidatos: 2, indexados: 2, falhas: 0 });
  });

  it('conta falhas isoladas sem abortar o lote', async () => {
    withQueries([{ locked: true }], [FOOD, { ...FOOD, id: 'f2' }]);
    ragService.indexChunk
      .mockRejectedValueOnce(new Error('quota Gemini'))
      .mockResolvedValueOnce(undefined);

    const res = await service.syncMissingFoods();
    expect(res).toEqual({ candidatos: 2, indexados: 1, falhas: 1 });
  });

  it('libera o advisory lock mesmo quando a query de alimentos falha', async () => {
    const q = jest.fn()
      .mockResolvedValueOnce([{ locked: true }])
      .mockRejectedValueOnce(new Error('conexão caiu'))
      .mockResolvedValue([]);
    dataSource = { query: q };
    service = new RagSyncService(dataSource, { indexChunk: jest.fn() } as any);

    await expect(service.syncMissingFoods()).rejects.toThrow('conexão caiu');
    const unlocks = q.mock.calls.filter((c) => String(c[0]).includes('pg_advisory_unlock'));
    expect(unlocks).toHaveLength(1);
  });

  it('respeita o limite recebido do endpoint externo', async () => {
    const q = withQueries([{ locked: true }], []);
    await service.syncMissingFoods(25);
    const selectCall = q.mock.calls.find((c) => String(c[0]).includes('FROM foods'));
    expect(selectCall[1]).toEqual([25]);
  });

  it('só indexa alimentos ativos e com confiabilidade definida', async () => {
    const q = withQueries([{ locked: true }], []);
    await service.syncMissingFoods();
    const sql = String(q.mock.calls.find((c) => String(c[0]).includes('FROM foods'))[0]);
    expect(sql).toContain('f.ativo = true');
    expect(sql).toContain("f.confiabilidade <> 'pendente'");
  });
});
