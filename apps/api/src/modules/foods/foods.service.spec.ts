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
});
