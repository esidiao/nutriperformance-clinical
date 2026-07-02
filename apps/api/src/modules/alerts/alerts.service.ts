import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalAlert } from './clinical-alert.entity';

type AlertSeverity = 'info' | 'warning' | 'danger' | 'critical';

interface AlertRule {
  id: string;
  condition: (context: AlertContext) => boolean;
  severity: AlertSeverity;
  category: string;
  title: string;
  description: (context: AlertContext) => string;
  recommendation?: string;
}

interface AlertContext {
  supplements: Array<{ name: string; doseNumericG?: number }>;
  medications: Array<{ activePrinciple?: string; name: string }>;
  clinicalConditions: string[];
  nutritionalData?: {
    caloricTarget?: number;
    proteinTargetG?: number;
    totalEnergyExpenditure?: number;
  };
  laboratoryData?: {
    ferritin?: number;
    hemoglobin?: number;
    vitaminD?: number;
    creatinine?: number;
  };
  physicalData?: {
    bmi?: number;
    weightLossPerWeek?: number;
    bodyFatPct?: number;
    activityLevel?: string;
  };
  patientAge?: number;
  isPregnant?: boolean;
}

// Regras de alerta — hard-coded, baseadas em evidência clínica
const ALERT_RULES: AlertRule[] = [
  {
    id: 'thermogenic_arrhythmia',
    condition: (ctx) =>
      ctx.supplements.some((s) => /termogênico|pré.treino|sinefrina|efedrina/i.test(s.name)) &&
      ctx.clinicalConditions.some((c) => /arritmia|fibrilação|flutter/i.test(c)),
    severity: 'critical',
    category: 'supplementation',
    title: 'Termogênico/Pré-treino + Arritmia',
    description: () =>
      'Estimulantes (cafeína, sinefrina) são contraindicados em arritmias cardíacas. Risco de precipitação de eventos cardíacos.',
    recommendation: 'SUSPENDER imediatamente. Encaminhar para avaliação cardiológica antes de qualquer estimulante.',
  },
  {
    id: 'vitamin_k_anticoagulant',
    condition: (ctx) =>
      ctx.supplements.some((s) => /vitamina.k|vitamin.k/i.test(s.name)) &&
      ctx.medications.some((m) => /varfarina|warfarin|acenocumarol/i.test(m.activePrinciple ?? m.name)),
    severity: 'danger',
    category: 'interactions',
    title: 'Vitamina K + Anticoagulante',
    description: () =>
      'Vitamina K antagoniza o efeito de anticoagulantes cumarínicos. Risco de eventos tromboembólicos.',
    recommendation: 'Monitoramento rigoroso do INR. Revisão médica obrigatória.',
  },
  {
    id: 'creatine_renal_disease',
    condition: (ctx) =>
      ctx.supplements.some((s) => /creatina|creatine/i.test(s.name)) &&
      ctx.clinicalConditions.some((c) => /doença.renal.crônica|insuficiência.renal|DRC|IRC/i.test(c)),
    severity: 'danger',
    category: 'supplementation',
    title: 'Creatina + Doença Renal',
    description: () =>
      'Creatina pode sobrecarregar rins comprometidos e elevará creatinina sérica, dificultando monitoramento renal.',
    recommendation: 'Avaliar com nefrologista antes de iniciar ou manter creatina.',
  },
  {
    id: 'iron_ibs_medication',
    condition: (ctx) =>
      ctx.supplements.some((s) => /ferro|iron|sulfato.ferroso/i.test(s.name)) &&
      ctx.medications.some((m) => /omeprazol|lansoprazol|pantoprazol|rabeprazol|IBP|esomeprazol/i.test(m.activePrinciple ?? m.name)),
    severity: 'warning',
    category: 'bioavailability',
    title: 'Ferro + IBP (Inibidor de Bomba de Prótons)',
    description: () =>
      'IBPs reduzem a acidez gástrica, prejudicando absorção de ferro não-heme. Risco de baixa efetividade da suplementação.',
    recommendation: 'Preferir ferro quelato. Administrar com vitamina C. Monitorar ferritina sérica.',
  },
  {
    id: 'hypericum_medications',
    condition: (ctx) =>
      ctx.supplements.some((s) => /hipericão|hypericum|erva.de.são.joão/i.test(s.name)) &&
      ctx.medications.length > 0,
    severity: 'danger',
    category: 'interactions',
    title: 'Hipericão + Medicamentos',
    description: (ctx) => {
      const meds = ctx.medications.map((m) => m.name).join(', ');
      return `Hipericão é forte indutor de CYP3A4 e pode reduzir eficácia de múltiplos medicamentos: ${meds}. Verificar cada interação individualmente.`;
    },
    recommendation: 'Revisão médica urgente. Hipericão contraindicado com maioria dos medicamentos.',
  },
  {
    id: 'low_caloric_intake',
    condition: (ctx) =>
      !!ctx.nutritionalData?.caloricTarget &&
      !!ctx.nutritionalData?.totalEnergyExpenditure &&
      ctx.nutritionalData.caloricTarget < ctx.nutritionalData.totalEnergyExpenditure * 0.7,
    severity: 'warning',
    category: 'nutrition',
    title: 'Déficit Calórico Muito Elevado',
    description: (ctx) =>
      `Meta calórica (${ctx.nutritionalData?.caloricTarget} kcal) está ${Math.round(100 - (ctx.nutritionalData!.caloricTarget! / ctx.nutritionalData!.totalEnergyExpenditure!) * 100)}% abaixo do gasto energético. Risco de perda de massa magra e deficiências nutricionais.`,
    recommendation: 'Revisar estratégia alimentar. Déficit máximo recomendado: 500-750 kcal/dia para maioria dos objetivos.',
  },
  {
    id: 'rapid_weight_loss',
    condition: (ctx) =>
      !!ctx.physicalData?.weightLossPerWeek && ctx.physicalData.weightLossPerWeek > 1.5,
    severity: 'warning',
    category: 'physical',
    title: 'Perda de Peso Acelerada',
    description: (ctx) =>
      `Perda de ${ctx.physicalData?.weightLossPerWeek} kg/semana detectada. Acima de 1-1,5 kg/semana aumenta risco de catabolismo muscular.`,
    recommendation: 'Revisar déficit calórico e ingestão proteica. Monitorar composição corporal.',
  },
  {
    id: 'possible_reds',
    condition: (ctx) =>
      !!ctx.nutritionalData?.caloricTarget &&
      ctx.nutritionalData.caloricTarget < 1400 &&
      ctx.physicalData?.activityLevel === 'very_active',
    severity: 'warning',
    category: 'nutrition',
    title: 'Possível RED-S (Relative Energy Deficiency in Sport)',
    description: () =>
      'Ingestão calórica baixa combinada com alta atividade física sugere risco de RED-S. Pode impactar hormônios, densidade óssea e desempenho.',
    recommendation: 'Avaliar disponibilidade energética. Considerar encaminhamento multiprofissional.',
  },
  {
    id: 'very_low_bmi',
    condition: (ctx) =>
      !!ctx.physicalData?.bmi && ctx.physicalData.bmi < 17 && (ctx.patientAge ?? 99) >= 18,
    severity: 'danger',
    category: 'nutrition',
    title: 'IMC Muito Baixo',
    description: (ctx) =>
      `IMC de ${ctx.physicalData?.bmi} indica desnutrição grave. Requer atenção clínica prioritária.`,
    recommendation: 'Atenção prioritária. Avaliar causas subjacentes. Considerar encaminhamento médico.',
  },
  {
    id: 'excessive_protein_renal',
    condition: (ctx) =>
      !!ctx.nutritionalData?.proteinTargetG &&
      ctx.physicalData?.bmi !== undefined &&
      ctx.clinicalConditions.some((c) => /renal|nefropatia/i.test(c)) &&
      ctx.nutritionalData.proteinTargetG > 80, // valor arbitrário — profissional deve avaliar
    severity: 'danger',
    category: 'nutrition',
    title: 'Proteína Elevada + Condição Renal',
    description: () =>
      'Ingestão proteica elevada pode sobrecarregar rins já comprometidos.',
    recommendation: 'Revisar necessidade proteica com nefrologista. Meta proteica em doença renal requer cálculo individualizado.',
  },
];

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(ClinicalAlert) private alertRepo: Repository<ClinicalAlert>,
  ) {}

  async evaluateAndCreateAlerts(params: {
    patientId: string;
    workspaceId: string;
    context: AlertContext;
  }): Promise<ClinicalAlert[]> {
    const triggeredAlerts: ClinicalAlert[] = [];

    for (const rule of ALERT_RULES) {
      if (rule.condition(params.context)) {
        const alert = this.alertRepo.create({
          patientId: params.patientId,
          workspaceId: params.workspaceId,
          triggeredBy: 'alert_engine_v1',
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
          description: rule.description(params.context),
          recommendation: rule.recommendation,
          isResolved: false,
        });

        triggeredAlerts.push(await this.alertRepo.save(alert));
      }
    }

    return triggeredAlerts;
  }

  async getPatientAlerts(patientId: string, includeResolved = false, limit = 200) {
    return this.alertRepo.find({
      where: {
        patientId,
        ...(includeResolved ? {} : { isResolved: false }),
      },
      order: { createdAt: 'DESC' },
      take: Math.min(500, Math.max(1, limit)),
    });
  }

  async resolveAlert(alertId: string, resolvedBy: string, note?: string) {
    await this.alertRepo.update(alertId, {
      isResolved: true,
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNote: note,
    });
  }

  async evaluateSupplementation(
    patientId: string,
    workspaceId: string,
    supplements: Array<{ supplementName: string; doseAmount?: number | null; anvisaCategory?: string | null }>,
  ): Promise<void> {
    const context: AlertContext = {
      supplements: supplements.map((s) => ({ name: s.supplementName, doseNumericG: s.doseAmount ?? undefined })),
      medications: [],
      clinicalConditions: [],
    };
    await this.evaluateAndCreateAlerts({ patientId, workspaceId, context });
  }

  async evaluateLaboratory(
    patientId: string,
    workspaceId: string,
    exam: { ferritinNgMl?: number | null; hemoglobinGDl?: number | null },
  ): Promise<void> {
    // Laboratory results feed into context for rule evaluation
    const context: AlertContext = {
      supplements: [],
      medications: [],
      clinicalConditions: [],
      laboratoryData: {
        ferritin: exam.ferritinNgMl ?? undefined,
        hemoglobin: exam.hemoglobinGDl ?? undefined,
      },
    };
    await this.evaluateAndCreateAlerts({ patientId, workspaceId, context });
  }
}
