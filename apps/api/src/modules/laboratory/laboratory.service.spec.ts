import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { LaboratoryService } from './laboratory.service';
import { LaboratoryExam } from './laboratory-exam.entity';
import { AIEngineService } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';
import { AlertsService } from '../alerts/alerts.service';
import { AuditService } from '../audit/audit.service';

describe('LaboratoryService — analyzeWithAi', () => {
  let service: LaboratoryService;
  let capturedMap: Record<string, { value: number; unit: string; reference: string; status: string }>;

  const mockRepo = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
  const mockAi = {
    analyzeLaboratoryContext: jest.fn().mockImplementation((map: any) => {
      capturedMap = map;
      return Promise.resolve({ content: 'análise', confidenceLevel: 'moderate', warnings: [] });
    }),
  };
  const mockTokens = { consume: jest.fn().mockResolvedValue(undefined) };
  const mockAlerts = { evaluateLaboratory: jest.fn().mockResolvedValue(undefined) };
  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryService,
        { provide: getRepositoryToken(LaboratoryExam), useValue: mockRepo },
        { provide: AIEngineService, useValue: mockAi },
        { provide: TokenService, useValue: mockTokens },
        { provide: AlertsService, useValue: mockAlerts },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<LaboratoryService>(LaboratoryService);
  });

  it('classifica corretamente o status de marcadores presentes', async () => {
    mockRepo.findOne.mockResolvedValueOnce({
      id: 'exam-1',
      workspaceId: 'ws-1',
      tokensConsumed: 0,
      hemoglobinGDl: 11,      // < 12 → low
      fastingGlucoseMgDl: 88, // 70–99 → normal
      vitaminDNgMl: 18,       // < 20 → low
      ferritinNgMl: 8,        // < 15 → low
      hba1cPct: 6.6,          // >= 6.5 → high
      totalCholesterolMgDl: 210, // >= 200 e < 240 → borderline
    });

    const res = await service.analyzeWithAi('ws-1', 'exam-1', 'user-1', []);

    expect(capturedMap.hemoglobina.status).toBe('low');
    expect(capturedMap.glicose_jejum.status).toBe('normal');
    expect(capturedMap.vitamina_d.status).toBe('low');
    expect(capturedMap.ferritina.status).toBe('low');
    expect(capturedMap.hba1c.status).toBe('high');
    expect(capturedMap.colesterol_total.status).toBe('borderline');
    expect(res.tokensConsumed).toBe(10);
  });

  it('omite marcadores ausentes (null/undefined) do mapa de análise', async () => {
    mockRepo.findOne.mockResolvedValueOnce({
      id: 'exam-2',
      workspaceId: 'ws-1',
      tokensConsumed: 0,
      hemoglobinGDl: 14,
      ferritinNgMl: null,
      vitaminDNgMl: undefined,
    });

    await service.analyzeWithAi('ws-1', 'exam-2', 'user-1', []);

    expect(capturedMap.hemoglobina).toBeDefined();
    expect(capturedMap.ferritina).toBeUndefined();
    expect(capturedMap.vitamina_d).toBeUndefined();
  });

  it('consome 10 tokens na operação laboratory_analysis', async () => {
    mockRepo.findOne.mockResolvedValueOnce({ id: 'exam-3', workspaceId: 'ws-1', tokensConsumed: 5, hemoglobinGDl: 14 });
    await service.analyzeWithAi('ws-1', 'exam-3', 'user-1', ['Creatina']);
    expect(mockTokens.consume).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'laboratory_analysis', cost: 10, workspaceId: 'ws-1' }),
    );
    // tokensConsumed acumulado: 5 + 10
    expect(mockRepo.update).toHaveBeenCalledWith('exam-3', { tokensConsumed: 15 });
  });

  it('repassa o contexto de suplementos para a IA', async () => {
    mockRepo.findOne.mockResolvedValueOnce({ id: 'exam-4', workspaceId: 'ws-1', tokensConsumed: 0, zincUgDl: 60 });
    await service.analyzeWithAi('ws-1', 'exam-4', 'user-1', ['Zinco quelato', 'Vitamina C']);
    expect(mockAi.analyzeLaboratoryContext).toHaveBeenCalledWith(
      expect.any(Object),
      ['Zinco quelato', 'Vitamina C'],
      [],
    );
  });

  it('lança NotFoundException quando o exame não existe', async () => {
    mockRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.analyzeWithAi('ws-1', 'inexistente', 'user-1', [])).rejects.toThrow(NotFoundException);
    expect(mockTokens.consume).not.toHaveBeenCalled();
  });
});
