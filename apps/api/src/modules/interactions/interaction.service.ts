import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIEngineService, InteractionAnalysisInput } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';
import { AuditService } from '../audit/audit.service';
import { InteractionAnalysis } from './interaction-analysis.entity';

export interface CreateInteractionAnalysisDto {
  patientId: string;
  workspaceId: string;
  userId: string;
  supplements: Array<{ name: string; dose?: string; frequency?: string }>;
  medications: Array<{ name: string; activePrinciple?: string; dose?: string }>;
  clinicalConditions: string[];
  labResults?: Record<string, { value: number; unit: string; status: string }>;
  patientAge: number;
  patientGender: string;
  isPregnant?: boolean;
  isBreastfeeding?: boolean;
}

// Interações pré-definidas de alta evidência (base local — não depende de IA)
const HIGH_EVIDENCE_INTERACTIONS = [
  {
    entityA: 'vitamina k',
    entityB: 'varfarina',
    type: 'supplement_drug',
    riskLevel: 'high',
    mechanism: 'Vitamina K antagoniza o efeito anticoagulante da varfarina',
    confidenceLevel: 'high',
    evidenceQuality: 'meta-analysis',
    recommendation: 'Monitoramento rigoroso do INR obrigatório. Encaminhar para revisão médica.',
    requiresMedicalReview: true,
  },
  {
    entityA: 'cafeína',
    entityB: 'hipertensão',
    type: 'supplement_condition',
    riskLevel: 'moderate',
    mechanism: 'Cafeína pode elevar transitoriamente a pressão arterial',
    confidenceLevel: 'high',
    evidenceQuality: 'rct',
    recommendation: 'Avaliar dose e contexto clínico. Cautela em hipertensão não controlada.',
    requiresMedicalReview: false,
  },
  {
    entityA: 'creatina',
    entityB: 'doença renal crônica',
    type: 'supplement_condition',
    riskLevel: 'high',
    mechanism: 'Creatina aumenta creatinina sérica; pode sobrecarregar rins comprometidos',
    confidenceLevel: 'high',
    evidenceQuality: 'rct',
    recommendation: 'Contraindicado em DRC avançada. Avaliar com nefrologista antes de iniciar.',
    requiresMedicalReview: true,
  },
  {
    entityA: 'ferro',
    entityB: 'omeprazol',
    type: 'supplement_drug',
    riskLevel: 'moderate',
    mechanism: 'IBPs reduzem acidez gástrica, prejudicando absorção de ferro não-heme',
    confidenceLevel: 'high',
    evidenceQuality: 'observational',
    recommendation: 'Preferir ferro em quelato. Administrar com vitamina C. Monitorar ferritina.',
    requiresMedicalReview: false,
  },
  {
    entityA: 'cálcio',
    entityB: 'ferro',
    type: 'supplement_supplement',
    riskLevel: 'moderate',
    mechanism: 'Cálcio compete com ferro na absorção intestinal',
    confidenceLevel: 'high',
    evidenceQuality: 'rct',
    recommendation: 'Administrar em horários separados (intervalo ≥ 2h).',
    requiresMedicalReview: false,
  },
  {
    entityA: 'termogênico',
    entityB: 'arritmia',
    type: 'supplement_condition',
    riskLevel: 'contraindicated',
    mechanism: 'Estimulantes (cafeína, sinefrina) aumentam frequência cardíaca e podem precipitar arritmias',
    confidenceLevel: 'high',
    evidenceQuality: 'case_report',
    recommendation: 'CONTRAINDICADO. Não utilizar sem avaliação cardiológica especializada.',
    requiresMedicalReview: true,
  },
  {
    entityA: 'hipericão',
    entityB: 'anticoncepcional',
    type: 'supplement_drug',
    riskLevel: 'high',
    mechanism: 'Hipericão (Hypericum perforatum) induz CYP3A4, reduzindo eficácia de contraceptivos orais',
    confidenceLevel: 'high',
    evidenceQuality: 'rct',
    recommendation: 'Evitar combinação. Orientar sobre risco de falha contraceptiva.',
    requiresMedicalReview: true,
  },
  {
    entityA: 'zinco',
    entityB: 'ciprofloxacino',
    type: 'supplement_drug',
    riskLevel: 'moderate',
    mechanism: 'Zinco pode quelar fluoroquinolonas, reduzindo sua absorção',
    confidenceLevel: 'moderate',
    evidenceQuality: 'observational',
    recommendation: 'Administrar com intervalo mínimo de 2h entre zinco e o antibiótico.',
    requiresMedicalReview: false,
  },
];

@Injectable()
export class InteractionService {
  constructor(
    @InjectRepository(InteractionAnalysis)
    private analysisRepo: Repository<InteractionAnalysis>,
    private aiEngine: AIEngineService,
    private tokenService: TokenService,
    private auditService: AuditService,
  ) {}

  async analyze(dto: CreateInteractionAnalysisDto) {
    // 1. Verificar saldo de tokens
    await this.tokenService.consume({
      workspaceId: dto.workspaceId,
      userId: dto.userId,
      operation: 'interaction_analysis',
      description: 'Análise de interações suplemento/medicamento',
    });

    // 2. Checar interações de alta evidência localmente (sem IA)
    const localInteractions = this.checkLocalInteractions(dto);

    // 3. Análise complementar com IA
    const aiInput: InteractionAnalysisInput = {
      supplements: dto.supplements,
      medications: dto.medications,
      clinicalConditions: dto.clinicalConditions,
      labResults: dto.labResults,
      patientContext: {
        age: dto.patientAge,
        gender: dto.patientGender,
        isPregnant: dto.isPregnant,
        isBreastfeeding: dto.isBreastfeeding,
      },
    };

    const aiResult = await this.aiEngine.analyzeInteractions(aiInput);

    // 4. Determinar risco geral
    const hasContradindication = localInteractions.some((i) => i.riskLevel === 'contraindicated');
    const hasHighRisk = localInteractions.some((i) => i.riskLevel === 'high');
    const overallRisk = hasContradindication
      ? 'contraindicated'
      : hasHighRisk
        ? 'high'
        : aiResult.confidenceLevel === 'insufficient_data'
          ? 'insufficient_data'
          : 'moderate';

    // 5. Salvar análise
    const analysis = this.analysisRepo.create({
      patientId: dto.patientId,
      workspaceId: dto.workspaceId,
      createdBy: dto.userId,
      supplementsAnalyzed: dto.supplements,
      medicationsAnalyzed: dto.medications,
      conditionsAnalyzed: dto.clinicalConditions,
      labResultsContext: dto.labResults,
      interactionsFound: [
        ...localInteractions,
        { source: 'ai_analysis', content: aiResult.content },
      ],
      overallRiskLevel: overallRisk,
      requiresMedicalReview: localInteractions.some((i) => i.requiresMedicalReview),
      tokensConsumed: 15,
      aiDisclaimer: aiResult.disclaimer,
    });

    const saved = await this.analysisRepo.save(analysis);

    // 6. Registrar audit log
    await this.auditService.log({
      workspaceId: dto.workspaceId,
      userId: dto.userId,
      patientId: dto.patientId,
      action: 'CREATE',
      resource: 'interaction_analyses',
      resourceId: saved.id,
    });

    return {
      id: saved.id,
      overallRiskLevel: overallRisk,
      localInteractions,
      aiAnalysis: aiResult,
      requiresMedicalReview: saved.requiresMedicalReview,
      disclaimer: aiResult.disclaimer,
    };
  }

  private checkLocalInteractions(dto: CreateInteractionAnalysisDto) {
    const found = [];
    const allItems = [
      ...dto.supplements.map((s) => ({ name: s.name.toLowerCase(), type: 'supplement' })),
      ...dto.medications.map((m) => ({
        name: (m.activePrinciple || m.name).toLowerCase(),
        type: 'medication',
      })),
      ...dto.clinicalConditions.map((c) => ({ name: c.toLowerCase(), type: 'condition' })),
    ];

    for (const interaction of HIGH_EVIDENCE_INTERACTIONS) {
      const aMatches = allItems.some((item) => item.name.includes(interaction.entityA));
      const bMatches = allItems.some((item) => item.name.includes(interaction.entityB));

      if (aMatches && bMatches) {
        found.push({ ...interaction, source: 'local_evidence_base' });
      }
    }

    return found;
  }
}
