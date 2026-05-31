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

export interface SupplementProtocolSuggestionInput {
  goals: string[];
  age: number;
  gender: string;
  conditions: string[];
  labDeficiencies: string[];
  proposedSupplements: Array<{
    name: string;
    dose: string;
    timing: string;
    rationale: string;
    evidenceLevel: string;
  }>;
}

// =============================================================
// REGRAS ANTI-ALUCINAÇÃO — NÚCLEO DO SISTEMA
// =============================================================
const ANTI_HALLUCINATION_SYSTEM_PROMPT = `
Você é um assistente clínico especializado de suporte para NUTRICIONISTAS (CFN) e EDUCADORES FÍSICOS (CONFEF) no sistema NutriPerformance Clinical. Responda EXCLUSIVAMENTE em Português do Brasil.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS ABSOLUTAS — NUNCA VIOLE SOB QUALQUER CIRCUNSTÂNCIA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NUNCA invente interações, contraindicações, estudos ou dados clínicos inexistentes na literatura científica.
2. NUNCA emita diagnósticos clínicos, mesmo que o usuário solicite.
3. NUNCA prescreva medicamentos, doses medicamentosas ou terapias de competência médica.
4. NUNCA prometa ou sugira resultados estéticos, de desempenho ou terapêuticos garantidos.
5. NUNCA mencione, sugira ou insinue anabolizantes, hormônios exógenos, substâncias dopantes ou práticas vedadas pelo CFN/CONFEF/WADA.
6. NUNCA afirme causalidade clínica sem embasamento em evidência de qualidade adequada (mínimo Nível IIb).
7. NUNCA invente, extrapole ou modifique valores laboratoriais, dados antropométricos ou informações do paciente.
8. NUNCA faça alegações terapêuticas não respaldadas por evidência classificável.
9. NUNCA omita limitações importantes da evidência disponível.
10. NUNCA substitua o julgamento clínico individualizado do profissional responsável.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLASSIFICAÇÃO OBRIGATÓRIA DE EVIDÊNCIA (Oxford CEBM adaptado):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para CADA afirmação clínica relevante, classifique:

  Ia  = Meta-análise de ECRs (evidência mais forte)
  Ib  = Ensaio Clínico Randomizado (ECR) individual
  IIa = Estudo controlado sem randomização
  IIb = Estudo de coorte ou caso-controle
  III = Série de casos ou estudos observacionais descritivos
  IV  = Opinião de especialista / consenso de sociedade científica

Se não houver evidência classificável: marque como [DADOS INSUFICIENTES].

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESCORES DE CONFIANÇA OBRIGATÓRIOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ao lado de cada afirmação relevante, indique entre colchetes:
  [Confiança: XX% | Evidência: Nível Ia/Ib/IIa/IIb/III/IV]

Exemplos:
  "O cálcio compete com o ferro na absorção intestinal. [Confiança: 92% | Evidência: Ib]"
  "Esta interação pode ocorrer em teoria, mas faltam estudos humanos. [Confiança: 35% | Evidência: IV — DADOS INSUFICIENTES]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUTURA OBRIGATÓRIA DE RESPOSTA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Toda resposta DEVE conter as seguintes seções rotuladas, nesta ordem:

## RACIOCÍNIO CLÍNICO
Descreva passo a passo o raciocínio utilizado: quais dados foram considerados, quais hipóteses foram levantadas, quais foram descartadas e por quê. Este é o chain-of-thought explícito obrigatório.

## ANÁLISE PRINCIPAL
Conteúdo da análise solicitada, com cada afirmação acompanhada de [Confiança: XX% | Evidência: Nível X].

## ALERTAS E CONTRAINDICAÇÕES
Liste todos os alertas identificados, classificados por gravidade:
  🔴 CONTRAINDICADO — risco grave documentado
  🟠 ALTO RISCO — cautela obrigatória com monitoramento
  🟡 RISCO MODERADO — avaliar custo-benefício
  🟢 BAIXO RISCO — contexto geral favorável

Se não houver alertas em uma categoria, escreva "Nenhum identificado nesta categoria."

## LACUNAS DE EVIDÊNCIA
Liste explicitamente cada ponto em que a evidência é insuficiente, inexistente ou conflitante. Use o marcador: [DADOS INSUFICIENTES — motivo].

## RECOMENDAÇÕES PARA O PROFISSIONAL
Orientações práticas e acionáveis para o nutricionista ou educador físico, dentro do escopo de sua competência legal.

## AVISO LEGAL
Esta análise é uma ferramenta de apoio técnico para profissionais habilitados. Não constitui diagnóstico, prescrição ou tratamento. Deve ser interpretada e validada pelo profissional responsável, considerando o contexto clínico individualizado. Responsabilidade clínica exclusiva do profissional (CFN/CONFEF).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRINCÍPIOS GERAIS DE QUALIDADE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Use linguagem técnica adequada para profissionais de saúde com formação superior.
- Prefira "pode indicar" / "sugere investigação" / "compatível com" a afirmações absolutas.
- Quando a evidência for apenas Nível III ou IV, declare isso explicitamente antes de apresentar o conteúdo.
- Cite mecanismos bioquímicos e fisiológicos quando relevante e embasado.
- Esta ferramenta é de APOIO — nunca substitua o julgamento clínico individualizado.
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
      model: 'gemini-2.0-flash',
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

  /**
   * Streaming generation — yields text chunks as AsyncIterable.
   * Use with SSE / Server-Sent Events controller to stream tokens to frontend.
   */
  async *generateStream(prompt: string, maxOutputTokens = 2048): AsyncIterable<string> {
    const result = await this.model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens, temperature: 0.2 },
    });
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
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
  // SUGESTÃO DE PROTOCOLO DE SUPLEMENTAÇÃO
  // ------------------------------------------------------------------
  async suggestProtocol(input: SupplementProtocolSuggestionInput): Promise<AIAnalysisResult> {
    const supplementList = input.proposedSupplements
      .map(
        (s, i) =>
          `${i + 1}. ${s.name} — Dose: ${s.dose} | Horário: ${s.timing} | Justificativa: ${s.rationale} | Nível de evidência declarado: ${s.evidenceLevel}`,
      )
      .join('\n');

    const prompt = `
Você está revisando um protocolo de suplementação proposto para um paciente. Avalie criticamente cada aspecto abaixo:

PERFIL DO PACIENTE:
- Idade: ${input.age} anos
- Sexo: ${input.gender}
- Objetivos: ${input.goals.join(', ') || 'não informados'}
- Condições clínicas: ${input.conditions.join(', ') || 'nenhuma informada'}
- Deficiências laboratoriais identificadas: ${input.labDeficiencies.join(', ') || 'nenhuma informada'}

PROTOCOLO PROPOSTO:
${supplementList || 'Nenhum suplemento informado.'}

Revise o protocolo verificando obrigatoriamente os seguintes pontos:

(1) INTERAÇÕES entre os suplementos propostos — identifique pares ou combinações problemáticas, mecanismo e risco.

(2) SINERGIAS que potencializam mutuamente os efeitos — quais combinações são benéficas e por quê.

(3) CONFLITOS DE HORÁRIO — ex.: cálcio bloqueia absorção de ferro; magnésio interfere com zinco; vitamina C potencia ferro. Indique quais itens NÃO devem ser tomados juntos e o intervalo mínimo recomendado.

(4) CARGA DIÁRIA TOTAL — avalie se a soma dos suplementos representa sobrecarga metabólica, hepática ou renal, especialmente considerando a idade e condições clínicas.

(5) INADEQUAÇÕES ESPECÍFICAS — algum suplemento é inapropriado para as condições clínicas, faixa etária ou sexo informados? Aponte contraindicações ou necessidade de cautela especial.

(6) LACUNAS DO PROTOCOLO — considerando os objetivos declarados e as deficiências laboratoriais, há suplementos altamente indicados que estão ausentes? Liste com justificativa e nível de evidência.

Para cada ponto, forneça confiança e nível de evidência conforme as instruções do sistema.
    `;

    const content = await this.generate(prompt, 2048);
    return this.parseAndValidateResponse(content, 'protocol_review_engine');
  }

  // ------------------------------------------------------------------
  // ANÁLISE DE EXAMES LABORATORIAIS (apoio, não diagnóstico)
  // ------------------------------------------------------------------
  async analyzeLaboratoryContext(
    labResults: Record<string, { value: number; unit: string; reference: string; status: string }>,
    supplements: string[],
    medications: string[],
  ): Promise<AIAnalysisResult> {
    const labEntries = Object.entries(labResults)
      .map(
        ([marker, data]) =>
          `- ${marker}: ${data.value} ${data.unit} (referência: ${data.reference} | status: ${data.status})`,
      )
      .join('\n');

    const prompt = `
Como ferramenta de APOIO para nutricionistas, analise o contexto laboratorial completo abaixo em relação à nutrição e suplementação do paciente.

EXAMES DISPONÍVEIS:
${labEntries || 'Nenhum resultado laboratorial informado.'}

SUPLEMENTOS EM USO: ${supplements.join(', ') || 'Nenhum informado'}
MEDICAMENTOS EM USO: ${medications.join(', ') || 'Nenhum informado'}

Para cada marcador presente, avalie sob perspectiva nutricional e de suplementação:

1. MARCADORES HEMATOLÓGICOS (hemoglobina, hematócrito, VCM, CHCM, leucócitos, plaquetas)
   - Padrões sugestivos de anemia ferropriva, megaloblástica ou inflamatória
   - Impacto sobre suplementação de ferro, B12, folato e vitamina C

2. METABOLISMO DO FERRO (ferritina, ferro sérico, TIBC, saturação de transferrina)
   - Sinais de depleção de estoques, sobrecarga ou inflamação ativa
   - Necessidade de revisão de doses de ferro suplementar

3. VITAMINAS (vitamina D, B12, ácido fólico)
   - Adequação dos níveis para as funções metabólicas relevantes
   - Suplementos que podem estar insuficientes ou excessivos

4. MINERAIS (zinco, magnésio, cálcio)
   - Deficiências minerais com impacto nutricional
   - Interações com outros suplementos ou medicamentos em uso

5. GLICEMIA E METABOLISMO INSULÍNICO (glicose em jejum, HbA1c, insulina, HOMA-IR)
   - Contexto para recomendações nutricionais sobre carboidratos e suplementos insulinossensibilizantes (cromo, berberina, inositol)
   - Sinalizar se padrão sugere investigação adicional

6. LIPIDOGRAMA (colesterol total, HDL, LDL, VLDL, triglicerídeos)
   - Relevância para suplementos com efeito no perfil lipídico (ômega-3, berberina, niacina, fitoesteróis)
   - Alertas para suplementos que possam impactar negativamente

7. FUNÇÃO RENAL (creatinina, ureia, ácido úrico, TFGe)
   - Contraindicações ou cautelas para suplementos com eliminação renal (creatina, proteína elevada, certos minerais)
   - Sinalizar necessidade de revisão médica se valores alterados

8. FUNÇÃO HEPÁTICA (ALT, AST, GGT, albumina)
   - Impacto sobre metabolismo de suplementos lipossolúveis e fitoquímicos hepatotóxicos
   - Alertas para suplementos que exijam cautela hepática

9. HORMÔNIOS (TSH, T4 livre, testosterona, cortisol)
   - Interações nutricionais e de suplementação relevantes (selênio e tireoide; magnésio e cortisol; zinco e testosterona)
   - Contexto para prescrição nutricional individualizada

10. INFLAMAÇÃO (PCR)
    - Relevância para suplementos anti-inflamatórios (ômega-3, cúrcuma, vitamina D)
    - Impacto da inflamação sobre biodisponibilidade de micronutrientes (ex.: ferritina elevada em inflamação)

Para CADA marcador alterado (status diferente de 'normal'), forneça:
- Implicação nutricional principal [Confiança: XX% | Evidência: Nível X]
- Suplemento ou nutriente que pode precisar de revisão
- Interação com medicamentos ou suplementos em uso, se aplicável

IMPORTANTE:
- Não interprete os exames como diagnóstico médico — a interpretação diagnóstica é exclusiva do médico
- Use "pode indicar", "sugere investigação" e "compatível com" em vez de afirmações absolutas
- Para marcadores dentro da referência, mencione apenas se houver relevância clínica nutricional clara
- Se algum marcador não foi coletado mas seria relevante para os objetivos, indique como [DADOS INSUFICIENTES]
    `;
    const content = await this.generate(prompt, 2048);
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
