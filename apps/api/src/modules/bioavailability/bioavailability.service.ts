import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIEngineService } from '../ai/ai-engine.service';
import { TokenService } from '../tokens/token.service';
import { BioavailabilityAnalysis } from './bioavailability-analysis.entity';

// Regras locais de alta evidência — checagem sem IA (mais rápida e sem custo)
const LOCAL_BIOAVAILABILITY_RULES = [
  {
    trigger: { medications: /omeprazol|lansoprazol|pantoprazol|IBP|esomeprazol|rabeprazol/i },
    affected: ['ferro', 'vitamina b12', 'magnésio', 'zinco', 'vitamina c', 'cálcio'],
    mechanism: 'IBPs reduzem produção de ácido gástrico, prejudicando absorção de nutrientes dependentes de pH ácido',
    riskLevel: 'moderate',
    confidence: 'high',
    evidence: 'observational',
    suggestion: 'Monitorar status de ferro, B12 e minerais. Considerar formas queladas. Administrar suplementos com refeição.',
  },
  {
    trigger: { medications: /metformina/i },
    affected: ['vitamina b12'],
    mechanism: 'Metformina inibe absorção de vitamina B12 por inibição de receptores ileais dependentes de cálcio',
    riskLevel: 'moderate',
    confidence: 'high',
    evidence: 'meta-analysis',
    suggestion: 'Monitorar B12 sérica anualmente em uso prolongado. Considerar suplementação de B12.',
  },
  {
    trigger: { surgical: /bariátrica|bypass.gástrico|gastrectomia|manga.gástrica/i },
    affected: ['ferro', 'vitamina b12', 'vitamina d', 'cálcio', 'zinco', 'ácido fólico', 'vitaminas lipossolúveis'],
    mechanism: 'Cirurgia bariátrica reduz absorção de múltiplos micronutrientes por redução de área absortiva e/ou mudança de pH',
    riskLevel: 'high',
    confidence: 'high',
    evidence: 'meta-analysis',
    suggestion: 'Suplementação multinutriente obrigatória pós-bariátrica. Monitoramento laboratorial semestral. Formas sublinguais/injetáveis para B12.',
  },
  {
    trigger: { conditions: /doença.celíaca|doença.de.crohn|retocolite|intestino.irritável.grave/i },
    affected: ['ferro', 'zinco', 'magnésio', 'vitamina d', 'ácido fólico', 'vitaminas lipossolúveis'],
    mechanism: 'Doenças inflamatórias intestinais comprometem a superfície absortiva e aumentam permeabilidade',
    riskLevel: 'moderate',
    confidence: 'high',
    evidence: 'rct',
    suggestion: 'Monitorar regularmente micronutrientes. Considerar formas de alta biodisponibilidade. Avaliar nutrição enteral em fases ativas.',
  },
  {
    trigger: { conditions: /obesidade.grau.iii|obesidade.mórbida/i },
    affected: ['vitamina d'],
    mechanism: 'Excesso de tecido adiposo sequestra vitamina D lipossolúvel, reduzindo biodisponibilidade',
    riskLevel: 'moderate',
    confidence: 'high',
    evidence: 'observational',
    suggestion: 'Doses maiores de vitamina D podem ser necessárias. Monitorar 25-OH vitamina D.',
  },
  {
    trigger: { dietary: /fitatos|cereais.integrais.excessivos|leguminosas.não.tratadas/i },
    affected: ['ferro', 'zinco', 'cálcio', 'magnésio'],
    mechanism: 'Fitatos (ácido fítico) quelam minerais divalentes, reduzindo significativamente sua absorção',
    riskLevel: 'moderate',
    confidence: 'high',
    evidence: 'rct',
    suggestion: 'Separar ingestão de minerais de alimentos ricos em fitatos. Remolho/germinação reduzem fitatos.',
  },
  {
    trigger: { conditions: /insuficiência.pancreática|pancreatite.crônica/i },
    affected: ['vitaminas lipossolúveis', 'vitamina a', 'vitamina d', 'vitamina e', 'vitamina k', 'ácidos graxos'],
    mechanism: 'Deficiência de enzimas pancreáticas compromete digestão e absorção de gorduras e vitaminas lipossolúveis',
    riskLevel: 'high',
    confidence: 'high',
    evidence: 'observational',
    suggestion: 'Avaliar reposição enzimática. Vitaminas lipossolúveis em formas hidrossolúveis quando indicado.',
  },
];

export interface CreateBioavailabilityDto {
  patientId: string;
  workspaceId: string;
  userId: string;
  nutrientsOrSupplements: string[];
  giConditions: string[];
  medications: string[];
  surgicalHistory: string[];
  dietaryFactors: string[];
}

@Injectable()
export class BioavailabilityService {
  private readonly logger = new Logger(BioavailabilityService.name);

  constructor(
    @InjectRepository(BioavailabilityAnalysis)
    private analysisRepo: Repository<BioavailabilityAnalysis>,
    private aiEngine: AIEngineService,
    private tokenService: TokenService,
  ) {}

  async analyze(dto: CreateBioavailabilityDto) {
    await this.tokenService.consume({
      workspaceId: dto.workspaceId,
      userId: dto.userId,
      operation: 'bioavailability_analysis',
    });

    // 1. Checar regras locais de alta evidência
    const localRisks = this.checkLocalRules(dto);

    // 2. Análise complementar com IA
    let aiResult;
    try {
      aiResult = await this.aiEngine.analyzeBioavailability({
        nutrientsOrSupplements: dto.nutrientsOrSupplements,
        giConditions: dto.giConditions,
        medications: dto.medications,
        surgicalHistory: dto.surgicalHistory,
        dietaryFactors: dto.dietaryFactors,
      });
    } catch (err: any) {
      // Token já foi debitado no passo anterior; se a IA falhar aqui, o crédito fica
      // perdido até estorno manual. Log estruturado para o suporte localizar e reembolsar.
      this.logger.error(
        `Falha na IA após débito de token — requer estorno manual [workspace=${dto.workspaceId} user=${dto.userId} operation=bioavailability_analysis]: ${err?.message}`,
      );
      throw err;
    }

    // 3. Determinar se encaminhamento é necessário
    const referralNeeded =
      localRisks.some((r) => r.riskLevel === 'high') ||
      dto.surgicalHistory.some((s) => /bariátrica|bypass/i.test(s));

    const analysis = this.analysisRepo.create({
      patientId: dto.patientId,
      workspaceId: dto.workspaceId,
      createdBy: dto.userId,
      nutrientsAnalyzed: dto.nutrientsOrSupplements,
      supplementsAnalyzed: [],
      compromissingFactors: localRisks,
      giConditions: dto.giConditions,
      medicationsConsidered: dto.medications,
      surgicalHistory: dto.surgicalHistory,
      lowAbsorptionRisks: localRisks,
      investigationSuggestions: localRisks.map((r) => r.suggestion),
      referralNeeded,
      referralReason: referralNeeded
        ? 'Fatores de alto risco para biodisponibilidade identificados. Avaliação especializada recomendada.'
        : null,
      overallAssessment: aiResult.content,
      tokensConsumed: 12,
    });

    return this.analysisRepo.save(analysis);
  }

  private checkLocalRules(dto: CreateBioavailabilityDto) {
    const risks = [];

    for (const rule of LOCAL_BIOAVAILABILITY_RULES) {
      let triggered = false;

      if (rule.trigger.medications) {
        triggered = dto.medications.some((m) => rule.trigger.medications!.test(m));
      }
      if (!triggered && rule.trigger.conditions) {
        triggered = dto.giConditions.some((c) => rule.trigger.conditions!.test(c));
      }
      if (!triggered && rule.trigger.surgical) {
        triggered = dto.surgicalHistory.some((s) => rule.trigger.surgical!.test(s));
      }
      if (!triggered && rule.trigger.dietary) {
        triggered = dto.dietaryFactors.some((d) => rule.trigger.dietary!.test(d));
      }

      if (triggered) {
        // Filtrar apenas os nutrientes que o paciente usa e que são afetados
        const relevantNutrients = dto.nutrientsOrSupplements.filter((n) =>
          rule.affected.some((a) => n.toLowerCase().includes(a.toLowerCase())),
        );

        if (relevantNutrients.length > 0 || dto.nutrientsOrSupplements.length === 0) {
          risks.push({
            ...rule,
            affectedInContext: relevantNutrients.length > 0 ? relevantNutrients : rule.affected,
            source: 'local_evidence_base',
          });
        }
      }
    }

    return risks;
  }
}
