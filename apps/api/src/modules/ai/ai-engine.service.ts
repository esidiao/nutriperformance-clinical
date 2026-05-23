import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AIAnalysisResult {
  content: string;
  confidenceLevel: 'high' | 'moderate' | 'low' | 'insufficient_data';
  requiresProfessionalValidation: boolean;
  disclaimer: string;
  dataSource: string;
  warnings: string[];
}

export interface InteractionAnalysisInput {
  supplements: Array<{ name: string; dose?: string; frequency?: string }>;
  medications: Array<{ name: string; activePrinciple?: string; dose?: string }>;
  clinicalConditions: string[];
  labResults?: Record<string, { value: number; unit: string; status: string }>;
  patientContext: {
    age: number;
    gender: string;
    isPregnant?: boolean;
    isBreastfeeding?: boolean;
  };
}

export interface SupplementationAnalysisInput {
  supplement: string;
  dose: string;
  frequency: string;
  purpose: string;
  patientConditions: string[];
  medications: string[];
  labResults?: Record<string, unknown>;
  patientAge: number;
  isPregnant?: boolean;
  isBreastfeeding?: boolean;
  hasRenalDisease?: boolean;
  hasHepaticDisease?: boolean;
  hasCardiacDisease?: boolean;
  hasDiabetes?: boolean;
  hasHypertension?: boolean;
}

export interface BioavailabilityAnalysisInput {
  nutrientsOrSupplements: string[];
  giConditions: string[];
  medications: string[];
  surgicalHistory: string[];
  dietaryFactors: string[];
}

// =============================================================
// REGRAS ANTI-ALUCINAÇÃO — NÚCLEO DO SISTEMA
// =============================================================
const ANTI_HALLUCINATION_SYSTEM_PROMPT = `
Você é um assistente clínico especializado de suporte para profissionais de saúde (nutricionistas e educadores físicos) no sistema NutriPerformance Clinical.

REGRAS ABSOLUTAS — NUNCA VIOLE:

1. NUNCA invente interações, contraindicações ou dados clínicos que não existam na literatura científica.
2. NUNCA faça diagnósticos clínicos automáticos.
3. NUNCA prescreva medicamentos ou terapias médicas.
4. NUNCA prometa resultados estéticos ou de desempenho.
5. NUNCA sugira anabolizantes, substâncias proibidas ou práticas perigosas.
6. NUNCA afirme causalidade clínica sem evidência de qualidade adequada.
7. NUNCA invente valores laboratoriais ou dados do paciente.
8. NUNCA faça alegações terapêuticas não embasadas.

QUANDO NÃO SOUBER OU A EVIDÊNCIA FOR INSUFICIENTE:
- Responda explicitamente: "Dados insuficientes para conclusão segura."
- Informe o nível de confiança: alto / moderado / baixo / dados insuficientes.
- Indique a qualidade da evidência: meta-análise / ECR / observacional / relato de caso / opinião de especialista.
- Sempre recomende validação profissional.

FORMATO DE RESPOSTA:
- Seja objetivo e clinicamente preciso.
- Use linguagem técnica adequada para profissionais de saúde.
- Estruture em seções claras.
- Inclua nível de confiança em cada afirmação relevante.
- Termine sempre com aviso legal.

O SISTEMA:
- É ferramenta de APOIO, não de substituição profissional.
- Não substitui consulta médica, nutricional ou avaliação individualizada.
- Todas as análises devem ser validadas pelo profissional responsável.
`;

const DISCLAIMER =
  'Esta análise é uma ferramenta de apoio técnico para profissionais habilitados. ' +
  'Não constitui diagnóstico, prescrição ou tratamento. ' +
  'Deve ser interpretada e validada pelo profissional responsável pelo paciente, ' +
  'considerando o contexto clínico individualizado. ' +
  'Conforme CFN, CONFEF e CFM, a responsabilidade clínica é exclusiva do profissional.';

@Injectable()
export class AIEngineService {
  private readonly model: GenerativeModel;
  private readonly logger = new Logger(AIEngineService.name);

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: ANTI_HALLUCINATION_SYSTEM_PROMPT,
    });
  }

  private async generate(prompt: string, maxOutputTokens = 2048): Promise<string> {
    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens, temperature: 0.2 },
    });
    return result.response.text();
  }

  // ------------------------------------------------------------------
  // ANÁLISE DE INTERAÇÕES
  // ------------------------------------------------------------------
  async analyzeInteractions(input: InteractionAnalysisInput): Promise<AIAnalysisResult> {
    const content = await this.generate(this.buildInteractionPrompt(input), 2048);
    return this.parseAndValidateResponse(content, 'scientific_literature_base');
  }

  // ------------------------------------------------------------------
  // ANÁLISE DE SUPLEMENTAÇÃO
  // ------------------------------------------------------------------
  async analyzeSupplementation(input: SupplementationAnalysisInput): Promise<AIAnalysisResult> {
    const content = await this.generate(this.buildSupplementationPrompt(input), 1500);
    return this.parseAndValidateResponse(content, 'supplement_safety_base');
  }

  // ------------------------------------------------------------------
  // ANÁLISE DE BIODISPONIBILIDADE
  // ------------------------------------------------------------------
  async analyzeBioavailability(input: BioavailabilityAnalysisInput): Promise<AIAnalysisResult> {
    const content = await this.generate(this.buildBioavailabilityPrompt(input), 1500);
    return this.parseAndValidateResponse(content, 'pharmacokinetics_base');
  }

  // ------------------------------------------------------------------
  // RESUMO NUTRICIONAL
  // ------------------------------------------------------------------
  async summarizeNutritionalAssessment(
    assessmentData: Record<string, unknown>,
  ): Promise<AIAnalysisResult> {
    const prompt = `
Analise os seguintes dados de avaliação nutricional e produza um resumo clínico estruturado para o profissional nutricionista:

${JSON.stringify(assessmentData, null, 2)}

Inclua:
1. Síntese dos dados relevantes
2. Padrões identificados (sem diagnóstico)
3. Pontos de atenção para o profissional
4. Perguntas para investigação adicional

IMPORTANTE: Não faça diagnóstico. Organize as informações para apoiar o julgamento clínico do nutricionista.
    `;
    const content = await this.generate(prompt, 1200);
    return this.parseAndValidateResponse(content, 'clinical_organization_tool');
  }

  // ------------------------------------------------------------------
  // ANÁLISE DE EXAMES LABORATORIAIS (apoio, não diagnóstico)
  // ------------------------------------------------------------------
  async analyzeLaboratoryContext(
    labResults: Record<string, { value: number; unit: string; reference: string; status: string }>,
    supplements: string[],
    medications: string[],
  ): Promise<AIAnalysisResult> {
    const prompt = `
Como ferramenta de APOIO para nutricionistas, analise o contexto laboratorial abaixo em relação a suplementação e nutrição:

EXAMES:
${JSON.stringify(labResults, null, 2)}

SUPLEMENTOS EM USO: ${supplements.join(', ') || 'Nenhum informado'}
MEDICAMENTOS: ${medications.join(', ') || 'Nenhum informado'}

Identifique:
1. Nutrientes ou suplementos que possam influenciar ou ser influenciados por estes exames
2. Sinalizações de deficiências nutricionais possíveis (sem diagnóstico definitivo)
3. Suplementos que podem precisar de revisão com base nos resultados
4. Necessidade de acompanhamento específico

IMPORTANTE:
- Não interprete exames como diagnóstico médico
- A interpretação diagnóstica é exclusiva do médico
- Foque no impacto nutricional e suplementar
- Use "pode indicar" e "sugere investigação" em vez de afirmações absolutas
    `;
    const content = await this.generate(prompt, 1500);
    return this.parseAndValidateResponse(content, 'laboratory_nutritional_context');
  }

  // ------------------------------------------------------------------
  // HELPERS PRIVADOS
  // ------------------------------------------------------------------

  private buildInteractionPrompt(input: InteractionAnalysisInput): string {
    return `
Analise as possíveis interações entre os itens abaixo para o seguinte perfil de paciente:

PERFIL: ${input.patientContext.age} anos, ${input.patientContext.gender}${input.patientContext.isPregnant ? ', gestante' : ''}${input.patientContext.isBreastfeeding ? ', lactante' : ''}

SUPLEMENTOS EM USO:
${input.supplements.map((s) => `- ${s.name} ${s.dose ? `(${s.dose})` : ''} ${s.frequency ? `/ ${s.frequency}` : ''}`).join('\n')}

MEDICAMENTOS EM USO:
${input.medications.map((m) => `- ${m.name}${m.activePrinciple ? ` [PA: ${m.activePrinciple}]` : ''} ${m.dose ? `(${m.dose})` : ''}`).join('\n')}

CONDIÇÕES CLÍNICAS: ${input.clinicalConditions.join(', ') || 'Não informado'}

${input.labResults ? `EXAMES RELEVANTES:\n${JSON.stringify(input.labResults, null, 2)}` : ''}

Para cada interação identificada, informe:
1. Entidades envolvidas (A x B)
2. Tipo: suplemento-medicamento / suplemento-suplemento / suplemento-condição / suplemento-exame
3. Nível de risco: baixo / moderado / alto / contraindicado / dados insuficientes
4. Mecanismo (se conhecido e embasado)
5. Nível de confiança e qualidade da evidência
6. Recomendação para o profissional
7. Necessidade de revisão médica

Se não houver evidência suficiente para afirmar uma interação, declare explicitamente.
    `;
  }

  private buildSupplementationPrompt(input: SupplementationAnalysisInput): string {
    const flags = [
      input.isPregnant ? 'gestante' : null,
      input.isBreastfeeding ? 'lactante' : null,
      input.hasRenalDisease ? 'doença renal' : null,
      input.hasHepaticDisease ? 'doença hepática' : null,
      input.hasCardiacDisease ? 'cardiopatia' : null,
      input.hasDiabetes ? 'diabetes' : null,
      input.hasHypertension ? 'hipertensão' : null,
    ]
      .filter(Boolean)
      .join(', ');

    return `
Avalie a segurança e adequação do seguinte suplemento para este perfil:

SUPLEMENTO: ${input.supplement}
DOSE: ${input.dose}
FREQUÊNCIA: ${input.frequency}
OBJETIVO: ${input.purpose}

PERFIL DO PACIENTE:
- Idade: ${input.patientAge} anos
- Condições especiais: ${flags || 'nenhuma informada'}
- Condições clínicas: ${input.patientConditions.join(', ') || 'não informado'}
- Medicamentos: ${input.medications.join(', ') || 'nenhum'}

Avalie:
1. Compatibilidade com objetivo declarado (com nível de evidência)
2. Compatibilidade com perfil clínico (condições, medicamentos, faixa etária)
3. Riscos ou alertas específicos
4. Dose adequada segundo literatura (com referência de qualidade)
5. Possíveis eventos adversos relevantes para este perfil
6. Nível de risco geral: baixo / moderado / alto / contraindicado / dados insuficientes

Se alguma condição clínica contraindicar ou exigir cautela especial, destaque claramente.
    `;
  }

  private buildBioavailabilityPrompt(input: BioavailabilityAnalysisInput): string {
    return `
Analise possíveis comprometimentos de biodisponibilidade para os seguintes nutrientes/suplementos:

NUTRIENTES/SUPLEMENTOS: ${input.nutrientsOrSupplements.join(', ')}

CONDIÇÕES GASTROINTESTINAIS: ${input.giConditions.join(', ') || 'nenhuma informada'}
MEDICAMENTOS: ${input.medications.join(', ') || 'nenhum'}
HISTÓRICO CIRÚRGICO: ${input.surgicalHistory.join(', ') || 'nenhum'}
FATORES DIETÉTICOS RELEVANTES: ${input.dietaryFactors.join(', ') || 'não informado'}

Para cada nutriente/suplemento relevante, analise:
1. Possível redução de absorção com base nos fatores informados
2. Mecanismo de comprometimento (pH, transportadores, interação alimentar, etc.)
3. Magnitude estimada do impacto (se houver evidência)
4. Nível de confiança da análise
5. Sugestões de investigação adicional para o profissional
6. Necessidade de encaminhamento especializado

Exemplos relevantes a considerar (se aplicável):
- Ferro + omeprazol/antiácidos
- Vitamina B12 + metformina ou IBPs
- Vitamina D + obesidade ou má absorção lipídica
- Zinco/Magnésio + fitatos
- Proteína + comprometimento digestivo

Se não houver dados suficientes para análise de algum item, declare explicitamente.
    `;
  }

  private parseAndValidateResponse(rawContent: string, source: string): AIAnalysisResult {
    const dangerousPatterns = [
      /prescr[eo]v[ao]/i,
      /diagnóstico definitivo/i,
      /certamente causa/i,
      /garanto que/i,
      /anabolizante/i,
      /esteroide anabólico/i,
      /resultado garantido/i,
    ];

    const warnings: string[] = [];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(rawContent)) {
        this.logger.warn(`Padrão de risco detectado na resposta da IA: ${pattern}`);
        warnings.push('Resposta da IA contém padrão que requer revisão profissional obrigatória.');
      }
    }

    let confidenceLevel: AIAnalysisResult['confidenceLevel'] = 'moderate';
    if (/dados insuficientes/i.test(rawContent)) {
      confidenceLevel = 'insufficient_data';
    } else if (/evidência limitada|baixa evidência|relato de caso/i.test(rawContent)) {
      confidenceLevel = 'low';
    } else if (/meta-análise|revisão sistemática|forte evidência/i.test(rawContent)) {
      confidenceLevel = 'high';
    }

    const requiresProfessionalValidation =
      confidenceLevel !== 'high' ||
      warnings.length > 0 ||
      /recomenda-se avaliação|validar com profissional|encaminhar/i.test(rawContent);

    return {
      content: rawContent,
      confidenceLevel,
      requiresProfessionalValidation,
      disclaimer: DISCLAIMER,
      dataSource: source,
      warnings,
    };
  }
}
