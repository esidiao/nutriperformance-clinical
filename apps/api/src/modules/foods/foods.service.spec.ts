import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { FoodsService } from './foods.service';
import { Food } from './food.entity';
import { RagService } from '../rag/rag.service';

describe('FoodsService', () => {
  let service: FoodsService;
  const mockRepo = { createQueryBuilder: jest.fn(), findOne: jest.fn(), find: jest.fn(), upsert: jest.fn() };

  /** Cadeia `createQueryBuilder().insert().into().values().orUpdate().execute()`. */
  const mockInsertChain = () => {
    const chain: any = {};
    chain.insert = jest.fn(() => chain);
    chain.into = jest.fn(() => chain);
    chain.values = jest.fn(() => chain);
    chain.orUpdate = jest.fn(() => chain);
    chain.execute = jest.fn(async () => ({}));
    return chain;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodsService,
        { provide: getRepositoryToken(Food), useValue: mockRepo },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: RagService, useValue: { indexChunk: jest.fn() } },
      ],
    }).compile();
    service = module.get<FoodsService>(FoodsService);
  });

  describe('compare', () => {
    it('retorna vazio com menos de 2 ids', async () => {
      expect(await service.compare(['a'])).toEqual([]);
      expect(mockRepo.find).not.toHaveBeenCalled();
    });

    it('preserva a ordem solicitada e expõe proveniência + micros', async () => {
      mockRepo.find.mockResolvedValueOnce([
        { id: 'b', nomePadronizado: 'Feijão', nomesPopulares: [], porcaoPadraoG: 100, ferroMg: 1.3, magnesioMg: 42, zincoMg: 0.7, vitaminas: {}, alergenos: [], fonte: 'taco', confiabilidade: 'alta' },
        { id: 'a', nomePadronizado: 'Arroz', nomesPopulares: [], porcaoPadraoG: 100, ferroMg: 0.3, magnesioMg: 5, zincoMg: 0.7, vitaminas: {}, alergenos: [], fonte: 'taco', confiabilidade: 'alta' },
      ]);
      const res = await service.compare(['a', 'b']);
      expect(res.map((r: any) => r.id)).toEqual(['a', 'b']); // ordem solicitada
      expect(res[0].magnesioMg).toBe(5);
      expect(res[1].ferroMg).toBe(1.3);
      expect(res[0].fonte).toBe('taco');
    });

    it('limita a 4 alimentos', async () => {
      mockRepo.find.mockResolvedValueOnce([]);
      await service.compare(['a', 'b', 'c', 'd', 'e']);
      const arg = mockRepo.find.mock.calls[0][0];
      expect(arg.where.id._value.length).toBe(4);
    });
  });

  describe('findById', () => {
    const activeFood = {
      id: 'f1', nomePadronizado: 'Feijão', nomesPopulares: [], grupoAlimentar: 'Leguminosas',
      porcaoPadraoG: 100, energiaKcal: 76, proteinasG: 4.8, carboidratosG: 13.6,
      lipidiosG: 0.5, fibrasG: 8.4, sodioMg: 2, calcioMg: 27, ferroMg: 1.3,
      potassioMg: 400, magnesioMg: 37, zincoMg: 0.9, vitaminas: {}, alergenos: [],
      fonte: 'taco', confiabilidade: 'alta', ativo: true,
    };

    it('lança NotFoundException quando alimento não existe ou está inativo', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('inexistente')).rejects.toThrow(NotFoundException);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'inexistente', ativo: true } });
    });

    it('lança NotFoundException quando confiabilidade é pendente (bloqueio clínico)', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ ...activeFood, confiabilidade: 'pendente' });
      await expect(service.findById('f1')).rejects.toThrow(NotFoundException);
    });

    it('retorna alimento com proveniência quando ativo e confiável', async () => {
      mockRepo.findOne.mockResolvedValueOnce(activeFood);
      const result = await service.findById('f1');
      expect(result.id).toBe('f1');
      expect(result.fonte).toBe('taco');
      expect(result.confiabilidade).toBe('alta');
    });
  });

  // ─── searchUsda ────────────────────────────────────────────────────────────
  //
  // `GET /foods/usda` é uma rota de LEITURA que grava. Isso a torna o ponto mais
  // fácil de furar a invariante clínica sem ninguém notar, e foi o que
  // acontecia: o upsert sobrescrevia `confiabilidade`/`ativo`, a releitura não
  // filtrava nada e o RAG era alimentado com 'alta' fixa.
  describe('searchUsda', () => {
    const USDA_FOOD = {
      fdcId: 173263,
      description: 'Rice, brown, parboiled, cooked',
      foodCategory: 'Cereal Grains and Pasta',
      foodNutrients: [
        { nutrientName: 'Energy', unitName: 'KCAL', value: 147 },
        { nutrientName: 'Protein', unitName: 'G', value: 3.09 },
      ],
    };

    const linha = (over: any = {}) => ({
      id: 'f-usda-1', nomePadronizado: 'Rice, brown, parboiled, cooked', nomesPopulares: [],
      grupoAlimentar: 'Cereal Grains and Pasta', porcaoPadraoG: 100, energiaKcal: 147,
      proteinasG: 3.09, vitaminas: {}, alergenos: [], fonte: 'usda',
      confiabilidade: 'alta', ativo: true, ...over,
    });

    let chain: any;
    let rag: { indexChunk: jest.Mock };

    beforeEach(() => {
      chain = mockInsertChain();
      mockRepo.createQueryBuilder.mockReturnValue(chain);
      rag = (service as any).ragService;
      // indexChunk e fire-and-forget com `.catch(...)`: o mock precisa devolver
      // uma promise, senao o proprio teste quebra antes da assercao.
      rag.indexChunk.mockResolvedValue(undefined);
      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ foods: [USDA_FOOD] }),
      })) as any;
    });

    it('não sobrescreve a decisão da curadoria no conflito', async () => {
      mockRepo.find.mockResolvedValueOnce([linha()]);
      await service.searchUsda('rice');

      const [colunas, conflito] = chain.orUpdate.mock.calls[0];
      // O ponto todo: estas duas colunas são do curador, não do importador.
      expect(colunas).not.toContain('confiabilidade');
      expect(colunas).not.toContain('ativo');
      // E o que é proveniência/nutrição continua atualizando normalmente.
      expect(colunas).toContain('energia_kcal');
      expect(conflito).toEqual(['fonte', 'fonte_id_externo']);
    });

    it('não devolve alimento que a curadoria desativou ou deixou pendente', async () => {
      mockRepo.find.mockResolvedValueOnce([
        linha({ id: 'ok' }),
        linha({ id: 'inativo', ativo: false }),
        linha({ id: 'pendente', confiabilidade: 'pendente' }),
      ]);
      const res = await service.searchUsda('rice');
      expect(res.map((r: any) => r.id)).toEqual(['ok']);
    });

    it('indexa no RAG com a confiabilidade real, e nunca o que está bloqueado', async () => {
      mockRepo.find.mockResolvedValueOnce([
        linha({ id: 'media', confiabilidade: 'media' }),
        linha({ id: 'inativo', ativo: false }),
      ]);
      await service.searchUsda('rice');

      expect(rag.indexChunk).toHaveBeenCalledTimes(1);
      const [fonte, ref, conf] = rag.indexChunk.mock.calls[0];
      expect(fonte).toBe('usda');
      expect(ref).toBe('media');
      // 'media', não 'alta': o chunk não pode afirmar uma confiabilidade que a
      // curadoria não deu — o assistente exibe esse selo na resposta clínica.
      expect(conf).toBe('media');
    });
  });
});
