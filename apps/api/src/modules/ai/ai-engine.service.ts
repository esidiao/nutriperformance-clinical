import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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

// =============================================================
// TRANSCRIÇÃO DE CONSULTA → ANAMNESE ESTRUTURADA
// System prompt separado: a extração devolve JSON, então não pode herdar a
// estrutura de 6 seções em markdown do prompt clínico principal.
// =============================================================
const AUDIO_INTAKE_SYSTEM_PROMPT = `
Você transcreve consultas de nutrição e educação física em Português do Brasil e extrai APENAS os dados explicitamente ditos em áudio.

REGRAS ABSOLUTAS:
1. NUNCA invente, estime ou complete dados que não foram ditos. Campo não mencionado = null.
2. NUNCA converta unidades por conta própria: registre o número exatamente como falado.
3. NUNCA emita diagnóstico, prescrição ou conduta — você apenas organiza o que foi dito.
4. Se o áudio estiver inaudível ou não for uma consulta, devolva todos os campos como null e explique em "observacoes".
5. Fala do paciente e fala do profissional entram nos mesmos campos; não tente separar autoria.
6. Para números ditos por extenso ("setenta e dois quilos"), registre o valor numérico (72).
7. Responda EXCLUSIVAMENTE com JSON válido, sem markdown, sem cercas de código.
`;

/** Campos que a extração pode preencher na anamnese nutricional. */
const NUTRITIONAL_FIELDS = `
- mainComplaint (string): queixa principal ou objetivo declarado pelo paciente
- dietaryRestrictions (string): restrições, alergias e intolerâncias alimentares
- mealFrequency (number): número de refeições por dia
- waterIntakeMl (number): ingestão hídrica diária em mL (converta litros para mL: "2 litros" -> 2000)
- alcoholConsumption (string): padrão de consumo de álcool
- bowelHabits (string): hábitos intestinais
- weight (number): peso em kg
- heightCm (number): altura em cm (converta metros para cm: "1,65" -> 165)
- age (number): idade em anos
- gender (string): exatamente "male" ou "female"
- professionalNotes (string): demais informações clínicas relevantes ditas na consulta
`;

/** Campos que a extração pode preencher na anamnese física. */
const PHYSICAL_FIELDS = `
- weightKg (number): peso em kg
- heightCm (number): altura em cm (converta metros para cm: "1,80" -> 180)
- age (number): idade em anos
- bodyFatPct (number): percentual de gordura corporal
- waistCm (number): circunferência de cintura em cm
- hipCm (number): circunferência de quadril em cm
- neckCm (number): circunferência de pescoço em cm
- chestCm (number): circunferência torácica em cm
- rightArmCm (number): circunferência do braço direito em cm
- rightThighCm (number): circunferência da coxa direita em cm
- rightCalfCm (number): circunferência da panturrilha direita em cm
- weeklyFrequency (number): sessões de treino por semana
- sessionDurationMin (number): duração média da sessão em minutos
- sportModality (string): modalidade esportiva principal
- trainingIntensity (string): intensidade de treino relatada
- restingHeartRate (number): frequência cardíaca de repouso em bpm
- bloodPressure (string): pressão arterial como dita (ex.: "120/80")
- professionalNotes (string): demais informações relevantes ditas na consulta
`;

export interface AudioIntakeResult {
  transcricao: string;
  campos: Record<string, unknown>;
  observacoes: string;
}

const DISCLAIMER =
  'Esta análise é uma ferramenta de apoio técnico para profissionais habilitados. ' +
  'Não constitui diagnóstico, prescrição ou tratamento. ' +
  'Deve ser interpretada e validada pelo profissional responsável pelo paciente, ' +
  'considerando o contexto clínico individualizado. ' +
  'Conforme CFN, CONFEF e CFM, a responsabilidade clínica é exclusiva do profissional.';

@Injectable()
export class AIEngineService {
  private readonly model: GenerativeModel;
  private readonly audioModel: GenerativeModel;
  private readonly logger = new Logger(AIEngineService.name);

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: ANTI_HALLUCINATION_SYSTEM_PROMPT,
    });
    this.audioModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: AUDIO_INTAKE_SYSTEM_PROMPT,
    });
  }

  /**
   * Transcreve o áudio de uma consulta e extrai os campos da anamnese.
   *
   * Usa `audioModel` (não `model`): o prompt clínico principal obriga resposta
   * em 6 seções de markdown, que quebraria o parse do JSON.
   */
  async transcribeAudioIntake(
    audioBase64: string,
    mimeType: string,
    kind: 'nutritional' | 'physical',
  ): Promise<AudioIntakeResult> {
    const fields = kind === 'nutritional' ? NUTRITIONAL_FIELDS : PHYSICAL_FIELDS;
    const prompt = `Transcreva integralmente o áudio desta consulta e extraia os dados de anamnese.

CAMPOS A EXTRAIR (use null para tudo que não foi dito explicitamente):
${fields}

Responda com este JSON exato:
{
  "transcricao": "transcrição completa e literal do áudio",
  "campos": { /* apenas os campos acima que foram realmente ditos */ },
  "observacoes": "pontos que precisam de confirmação do profissional, trechos inaudíveis ou dados ambíguos"
}`;

    let raw: string;
    try {
      const result = await this.audioModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: audioBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });
      raw = result.response.text();
    } catch (err: any) {
      this.handleGeminiError(err);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn('Resposta de transcrição não veio em JSON válido.');
      throw new ServiceUnavailableException(
        'Não foi possível interpretar a transcrição do áudio. Tente gravar novamente.',
      );
    }

    // Remove nulls: o formulário só deve ser preenchido com o que foi dito.
    const campos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.campos ?? {})) {
      if (v !== null && v !== undefined && v !== '') campos[k] = v;
    }

    return {
      transcricao: String(parsed.transcricao ?? ''),
      campos,
      observacoes: String(parsed.observacoes ?? ''),
    };
  }


  /**
   * Lê um laudo laboratorial em PDF e extrai os marcadores conhecidos.
   *
   * Usa `audioModel` pelo mesmo motivo da transcrição: o prompt clínico
   * principal obriga resposta em seis seções de markdown, que quebraria o JSON.
   *
   * O prompt exige o TRECHO LITERAL de cada valor. Sem isso, conferir a
   * extração significaria reler o laudo inteiro — e ninguém faria, o que
   * transformaria a revisão em carimbo.
   */
  async extrairExameDePdf(pdfBase64: string, catalogo: string): Promise<any> {
    const prompt = `Você está lendo um LAUDO LABORATORIAL brasileiro. Extraia os resultados.

MARCADORES CONHECIDOS (use exatamente o nome do campo à esquerda):
${catalogo}

REGRAS:
- Extraia SOMENTE o que está escrito no laudo. Nunca calcule, estime ou complete.
- Copie o número exatamente como aparece, inclusive a vírgula decimal.
- Para cada valor, copie a LINHA LITERAL do laudo em "trecho".
- Se o laudo tiver um exame que não está na lista acima, coloque em "naoMapeados".
- Se um marcador não aparecer no laudo, simplesmente não o inclua.
- Se houver mais de um resultado do mesmo marcador (ex.: coletas diferentes),
  traga o da coleta mais recente e mencione em "naoMapeados".

Responda com este JSON exato:
{
  "collectionDate": "data da COLETA no formato DD/MM/AAAA, ou null",
  "laboratoryName": "nome do laboratório, ou null",
  "valores": [
    { "campo": "nome_do_campo_da_lista", "valor": "12,5", "unidade": "g/dL", "trecho": "linha literal do laudo" }
  ],
  "naoMapeados": [
    { "nome": "nome do exame como está no laudo", "valor": "valor com unidade", "trecho": "linha literal" }
  ]
}`;

    let raw: string;
    try {
      const result = await this.audioModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          // Zero, não 0.1: extração de número de laudo não tem espaço para
          // variação criativa. A mesma página deve dar o mesmo resultado.
          temperature: 0,
          responseMimeType: 'application/json',
        },
      });
      raw = result.response.text();
    } catch (err: any) {
      this.handleGeminiError(err);
    }

    try {
      return JSON.parse(raw);
    } catch {
      this.logger.warn('Extração de PDF não veio em JSON válido.');
      throw new ServiceUnavailableException(
        'Não foi possível interpretar o laudo. Verifique se o PDF está legível.',
      );
    }
  }

  /**
   * Traduz falhas do provedor de IA (Gemini) em erro 503 com mensagem em português,
   * evitando vazamento de stack trace (500) quando a GEMINI_API_KEY está inválida/expirada
   * ou o serviço externo está indisponível.
   */
  private handleGeminiError(err: any): never {
    this.logger.error(`Falha na chamada ao Gemini: ${err?.message ?? err}`);
    throw new ServiceUnavailableException(
      'Serviço de análise por IA temporariamente indisponível. Tente novamente em instantes.',
    );
  }

  private async generate(prompt: string, maxOutputTokens = 2048): Promise<string> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens, temperature: 0.2 },
      });
      return result.response.text();
    } catch (err: any) {
      this.handleGeminiError(err);
    }
  }

  /**
   * RAG: responde a uma pergunta usando APENAS os trechos de contexto fornecidos.
   * Herda o system prompt anti-alucinação; reforça citação de fonte e recusa quando
   * o contexto não cobre a pergunta. Não substitui decisão profissional.
   */
  async answerFromContext(question: string, context: string): Promise<string> {
    const prompt = `Você recebeu trechos de bases nutricionais com proveniência (fonte e confiabilidade).
Responda à PERGUNTA do nutricionista usando EXCLUSIVAMENTE os TRECHOS abaixo.

Regras:
- Cite a fonte entre colchetes ao usar um dado, ex.: "[TACO]".
- Se os trechos não contêm a informação, responda exatamente: "Não há dado suficiente nas bases atuais para responder com segurança." Não invente valores.
- Diferencie informação nutricional de conduta clínica; recomende validação profissional.
- Seja objetivo e em português do Brasil.

TRECHOS:
${context}

PERGUNTA: ${question}`;
    return this.generate(prompt, 1024);
  }

  /**
   * Streaming generation — yields text chunks as AsyncIterable.
   * Use with SSE / Server-Sent Events controller to stream tokens to frontend.
   */
  async *generateStream(prompt: string, maxOutputTokens = 2048): AsyncIterable<string> {
    let result: Awaited<ReturnType<GenerativeModel['generateContentStream']>>;
    try {
      result = await this.model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens, temperature: 0.2 },
      });
    } catch (err: any) {
      this.handleGeminiError(err);
    }
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
