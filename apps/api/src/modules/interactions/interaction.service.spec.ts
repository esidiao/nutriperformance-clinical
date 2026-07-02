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
});
