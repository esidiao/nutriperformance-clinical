import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { IndustrializedProduct } from './product.entity';
import { RagService } from '../rag/rag.service';

describe('ProductsService.findByBarcode', () => {
  let service: ProductsService;
  const repo = { findOne: jest.fn() };
  const rag = { indexChunk: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(IndustrializedProduct), useValue: repo },
        { provide: RagService, useValue: rag },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('rejeita EAN inválido (curto) sem consultar nada', async () => {
    await expect(service.findByBarcode('123')).rejects.toThrow(NotFoundException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('retorna do cache local quando o produto já existe (sem fetch externo)', async () => {
    repo.findOne.mockResolvedValueOnce({
      id: 'p1', codigoBarras: '7891000100103', nomeComercial: 'Leite Condensado',
      marca: 'Moça', alergenos: [], tabelaNutricional: { sodio_mg: 80 }, aditivos: [],
      nutriScore: 'E', novaClassificacao: 4, alertaNutricional: ['Alto em açúcares'],
      fonte: 'openfoodfacts', confiabilidade: 'media', licenca: 'ODbL', dataAtualizacao: new Date(),
    });
    const r = await service.findByBarcode('7891000100103');
    expect(r.origem).toBe('cache');
    expect(r.nomeComercial).toBe('Leite Condensado');
    expect(rag.indexChunk).not.toHaveBeenCalled(); // cache não re-indexa
  });

  it('normaliza o EAN (remove não-dígitos) antes da busca', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'p1', codigoBarras: '7891000100103', alergenos: [], tabelaNutricional: {}, aditivos: [], alertaNutricional: [], fonte: 'openfoodfacts', confiabilidade: 'media', licenca: 'ODbL', dataAtualizacao: new Date() });
    await service.findByBarcode('789-1000.100103');
    expect(repo.findOne).toHaveBeenCalledWith({ where: { codigoBarras: '7891000100103' } });
  });
});
