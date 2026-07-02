import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SupplementationService } from './supplementation.service';
import { PatientSupplementation } from './patient-supplementation.entity';
import { AIEngineService } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';
import { AlertsService } from '../alerts/alerts.service';
import { AuditService } from '../audit/audit.service';

describe('SupplementationService', () => {
  let service: SupplementationService;

  const mockRepo = {
    create: jest.fn().mockImplementation((d) => d),
    save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'sup-1', ...d })),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockAi = { analyzeSupplementation: jest.fn().mockResolvedValue({ content: 'ok', confidenceLevel: 'moderate' }) };
  const mockTokens = { consume: jest.fn().mockResolvedValue(undefined) };
  const mockAlerts = { evaluateSupplementation: jest.fn().mockResolvedValue(undefined) };
  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplementationService,
        { provide: getRepositoryToken(PatientSupplementation), useValue: mockRepo },
        { provide: AIEngineService, useValue: mockAi },
        { provide: TokenService, useValue: mockTokens },
        { provide: AlertsService, useValue: mockAlerts },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<SupplementationService>(SupplementationService);
  });

  describe('create', () => {
    it('injeta workspaceId/prescribedBy e registra audit log', async () => {
      const saved = await service.create('ws-1', 'user-1', { supplementName: 'Creatina' });
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ supplementName: 'Creatina', workspaceId: 'ws-1', prescribedBy: 'user-1' }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', resource: 'patient_supplementation' }),
      );
      expect(saved.id).toBe('sup-1');
    });
  });

  describe('findOne', () => {
    it('lança NotFoundException quando não encontrado', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne('ws-1', 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('marca isActive=false e define endDate', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ id: 'sup-1', workspaceId: 'ws-1', isActive: true });
      await service.deactivate('ws-1', 'sup-1', 'user-1');
      const savedArg = mockRepo.save.mock.calls[0][0];
      expect(savedArg.isActive).toBe(false);
      expect(savedArg.endDate).toBeInstanceOf(Date);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE', resource: 'patient_supplementation' }),
      );
    });
  });

  describe('analyzeWithAi', () => {
    it('analisa apenas suplementos ativos e consome 8 tokens', async () => {
      mockRepo.find.mockResolvedValueOnce([
        { supplementName: 'Creatina', doseAmount: 5, doseUnit: 'g', isActive: true, therapeuticGoal: 'Força' },
        { supplementName: 'Antigo', isActive: false, therapeuticGoal: 'X' },
      ]);

      const res = await service.analyzeWithAi('ws-1', 'pat-1', 'user-1');

      // Só o ativo entra no nome enviado à IA
      const aiArg = mockAi.analyzeSupplementation.mock.calls[0][0];
      expect(aiArg.supplement).toContain('Creatina');
      expect(aiArg.supplement).not.toContain('Antigo');

      expect(mockTokens.consume).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'supplementation_analysis', cost: 8 }),
      );
      expect(mockAlerts.evaluateSupplementation).toHaveBeenCalled();
      expect(res.tokensConsumed).toBe(8);
    });
  });
});
