import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CurationService } from './curation.service';
import { Food } from '../foods/food.entity';
import { AuditService } from '../audit/audit.service';
import { RagService } from '../rag/rag.service';

const makeFood = (overrides: Partial<Food> = {}): Partial<Food> => ({
  id: 'f1', nomePadronizado: 'Feijão carioca', grupoAlimentar: 'Leguminosas',
  fonte: 'taco', confiabilidade: 'alta', ativo: true,
  porcaoPadraoG: 100, energiaKcal: 76, proteinasG: 4.8, carboidratosG: 13.6,
  lipidiosG: 0.5, fibrasG: 8.4, sodioMg: 2, calcioMg: 27, ferroMg: 1.3,
  potassioMg: 400, magnesioMg: 37, zincoMg: 0.9, vitaminas: {},
  ...overrides,
});

describe('CurationService', () => {
  let service: CurationService;

  const repo = { findOne: jest.fn(), update: jest.fn(), createQueryBuilder: jest.fn() };
  const ds = { query: jest.fn() };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const rag = { indexChunk: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.update.mockResolvedValue(undefined);
    ds.query.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurationService,
        { provide: getRepositoryToken(Food), useValue: repo },
        { provide: DataSource, useValue: ds },
        { provide: AuditService, useValue: audit },
        { provide: RagService, useValue: rag },
      ],
    }).compile();
    service = module.get(CurationService);
  });

  // --- updateFood: validação de entrada ---

  it('lança NotFoundException quando alimento não existe', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.updateFood('inexistente', { confiabilidade: 'alta' }, 'u', '127.0.0.1'))
      .rejects.toThrow(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('aplica confiabilidade válida + registra audit log', async () => {
    repo.findOne.mockResolvedValueOnce(makeFood());
    const result = await service.updateFood('f1', { confiabilidade: 'media' }, 'admin', '10.0.0.1');
    expect(repo.update).toHaveBeenCalledWith('f1', { confiabilidade: 'media' });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'f1', action: 'UPDATE', changes: { confiabilidade: 'media' } }),
    );
    expect(result).toMatchObject({ id: 'f1', confiabilidade: 'media' });
  });

  it('ignora confiabilidade fora da whitelist sem chamar update', async () => {
    repo.findOne.mockResolvedValueOnce(makeFood());
    const result = await service.updateFood('f1', { confiabilidade: 'aprovado' } as any, 'u', '::1');
    expect(repo.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'f1' });
  });

  it('retorna sem update quando dto não contém campos reconhecidos', async () => {
    repo.findOne.mockResolvedValueOnce(makeFood());
    const result = await service.updateFood('f1', {}, 'u', '::1');
    expect(repo.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'f1' });
  });

  // --- Curadoria ↔ RAG ---

  it('bloquear por confiabilidade=pendente → DELETE rag_chunk, sem re-indexar', async () => {
    // ativo=true, confiabilidade='alta' → nowBlocked=true, wasBlocked=false
    repo.findOne.mockResolvedValueOnce(makeFood());
    await service.updateFood('f1', { confiabilidade: 'pendente' }, 'admin', '::1');
    expect(ds.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM rag_chunks'),
      ['taco', 'f1'],
    );
    expect(rag.indexChunk).not.toHaveBeenCalled();
  });

  it('desativar alimento (ativo=false) → DELETE rag_chunk', async () => {
    repo.findOne.mockResolvedValueOnce(makeFood()); // ativo=true
    await service.updateFood('f1', { ativo: false }, 'admin', '::1');
    expect(ds.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM rag_chunks'),
      ['taco', 'f1'],
    );
    expect(rag.indexChunk).not.toHaveBeenCalled();
  });

  it('liberar alimento bloqueado (pendente→alta) → indexChunk, sem DELETE', async () => {
    // confiabilidade='pendente', ativo=true → wasBlocked=true
    repo.findOne.mockResolvedValueOnce(makeFood({ confiabilidade: 'pendente' }));
    await service.updateFood('f1', { confiabilidade: 'alta' }, 'admin', '::1');
    // Aguarda microtask do fire-and-forget
    await Promise.resolve();
    expect(rag.indexChunk).toHaveBeenCalledWith(
      'taco', 'f1', 'alta', expect.any(String), expect.objectContaining({ nome: 'Feijão carioca' }),
    );
    expect(ds.query).not.toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM rag_chunks'),
      expect.anything(),
    );
  });

  it('reativar alimento inativo → indexChunk em background', async () => {
    repo.findOne.mockResolvedValueOnce(makeFood({ ativo: false }));
    await service.updateFood('f1', { ativo: true }, 'admin', '::1');
    await Promise.resolve();
    expect(rag.indexChunk).toHaveBeenCalled();
  });

  it('re-bloquear alimento já bloqueado → nenhuma operação RAG', async () => {
    // wasBlocked=true (pendente), nowBlocked=true (continua pendente)
    repo.findOne.mockResolvedValueOnce(makeFood({ confiabilidade: 'pendente' }));
    await service.updateFood('f1', { confiabilidade: 'pendente' }, 'admin', '::1');
    await Promise.resolve();
    expect(ds.query).not.toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM rag_chunks'),
      expect.anything(),
    );
    expect(rag.indexChunk).not.toHaveBeenCalled();
  });
});
