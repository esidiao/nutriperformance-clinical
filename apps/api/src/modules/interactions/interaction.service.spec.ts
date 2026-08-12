import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InteractionService } from './interaction.service';
import { InteractionAnalysis } from './interaction-analysis.entity';
import { AIEngineService } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';
import { AuditService } from '../audit/audit.service';

describe('InteractionService — local evidence base', () => {
  let service: InteractionService;

  const mockRepo = {
    create: jest.fn().mockImplementation((d) => d),
    save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'ia-1', ...d })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const mockAi = { analyzeInteractions: jest.fn() };
  const mockTokens = { consume: jest.fn().mockResolvedValue(undefined) };
  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionService,
        { provide: getRepositoryToken(InteractionAnalysis), useValue: mockRepo },
        { provide: AIEngineService, useValue: mockAi },
        { provide: TokenService, useValue: mockTokens },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<InteractionService>(InteractionService);
    jest.clearAllMocks();
  });

  // Helper para montar o DTO esperado por checkLocalInteractions(dto)
  const dto = (opts: {
    supplements?: string[];
    medications?: string[];
    conditions?: string[];
  }) => ({
    supplements: (opts.supplements ?? []).map((name) => ({ name })),
    medications: (opts.medications ?? []).map((name) => ({ name })),
    clinicalConditions: opts.conditions ?? [],
  });

  describe('checkLocalInteractions', () => {
    it('detects vitamin K + warfarin interaction', () => {
      const results = (service as any).checkLocalInteractions(
        dto({ supplements: ['Vitamina K'], medications: ['Varfarina'] }),
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].riskLevel).toBe('high');
    });

    it('detects iron + PPI interaction', () => {
      const results = (service as any).checkLocalInteractions(
        dto({ supplements: ['Ferro bisglicinato'], medications: ['Omeprazol 20mg'] }),
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it('detects creatine + chronic kidney disease', () => {
      const results = (service as any).checkLocalInteractions(
        dto({ supplements: ['Creatina monohidrato'], conditions: ['Doença renal crônica'] }),
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].requiresMedicalReview).toBe(true);
    });

    it('returns empty array when no known interactions', () => {
      const results = (service as any).checkLocalInteractions(
        dto({ supplements: ['Whey protein'], medications: ['Vitamina C'] }),
      );
      expect(results).toHaveLength(0);
    });

    it('detects caffeine (thermogenic) + hypertension', () => {
      const results = (service as any).checkLocalInteractions(
        dto({ supplements: ['Termogênico com cafeína 200mg'], conditions: ['Hipertensão arterial'] }),
      );
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('findByPatient', () => {
    it('escopa a busca ao workspace do chamador', async () => {
      mockRepo.find.mockResolvedValueOnce([]);
      await service.findByPatient('ws-1', 'pac-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: 'ws-1', patientId: 'pac-1' } }),
      );
    });

    it('limita o histórico mesmo se pedirem um limite absurdo', async () => {
      mockRepo.find.mockResolvedValueOnce([]);
      await service.findByPatient('ws-1', 'pac-1', 10_000);

      expect(mockRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
    });

    it('devolve as análises persistidas, não uma lista vazia fixa', async () => {
      mockRepo.find.mockResolvedValueOnce([
        {
          id: 'ia-9',
          analysisDate: new Date('2026-08-01T00:00:00Z'),
          overallRiskLevel: 'high',
          interactionsFound: [{ source: 'local_evidence_base' }],
          requiresMedicalReview: true,
          supplementsAnalyzed: [{ name: 'Vitamina K' }],
          medicationsAnalyzed: [{ name: 'Varfarina' }],
          conditionsAnalyzed: [],
          professionalReview: null,
          reviewedBy: null,
          reviewedAt: null,
          aiDisclaimer: 'não substitui decisão profissional',
        },
      ]);

      const res = await service.findByPatient('ws-1', 'pac-1');

      expect(res.patientId).toBe('pac-1');
      expect(res.analyses).toHaveLength(1);
      expect(res.analyses[0]).toMatchObject({ id: 'ia-9', overallRiskLevel: 'high' });
    });
  });

  describe('addProfessionalReview', () => {
    const params = { workspaceId: 'ws-1', userId: 'user-1', id: 'ia-1', review: 'Conduta validada.' };

    it('persiste a revisão e registra no audit log', async () => {
      const analysis: Record<string, unknown> = { id: 'ia-1', workspaceId: 'ws-1', patientId: 'pac-1' };
      mockRepo.findOne.mockResolvedValueOnce(analysis);
      mockRepo.save.mockImplementationOnce((d: any) => Promise.resolve(d));

      const res = await service.addProfessionalReview(params);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          professionalReview: 'Conduta validada.',
          reviewedBy: 'user-1',
          reviewedAt: expect.any(Date),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          resource: 'interaction_analyses',
          resourceId: 'ia-1',
          patientId: 'pac-1',
        }),
      );
      expect(res.review).toBe('Conduta validada.');
    });

    it('recusa análise de outro workspace', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.addProfessionalReview(params)).rejects.toThrow(
        'Análise de interações não encontrada',
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('recusa revisão vazia sem tocar no registro', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ id: 'ia-1', workspaceId: 'ws-1', patientId: 'pac-1' });

      await expect(
        service.addProfessionalReview({ ...params, review: '   ' }),
      ).rejects.toThrow('não pode ser vazia');
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });
});
