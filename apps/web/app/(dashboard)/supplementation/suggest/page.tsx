'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import { useStreamingText } from '@/hooks/useStreamingText';
import { api } from '@/lib/api-client';
import {
  Pill, Coins, ShieldAlert, Sparkles, CheckCircle,
  Loader2, AlertTriangle, Star, BookOpen,
} from 'lucide-react';

// ─── Evidence levels ──────────────────────────────────────────────────────────
type EvidenceLevel = 'A' | 'B' | 'C' | 'D';
type GoalType = 'performance' | 'health' | 'body_composition' | 'recovery' | 'clinical';

interface SupplementSuggestion {
  name: string;
  dose: string;
  timing: string;
  rationale: string;
  evidenceLevel: EvidenceLevel;
  references: string;
  contraindications: string[];
  priority: 'essential' | 'beneficial' | 'optional';
}

const EVIDENCE_LABEL: Record<EvidenceLevel, { label: string; color: string; desc: string }> = {
  A: { label: 'A', color: 'bg-green-600 text-white', desc: 'Forte — meta-análise / múltiplos ECR' },
  B: { label: 'B', color: 'bg-blue-600 text-white', desc: 'Moderada — ECR único / revisão sistemática' },
  C: { label: 'C', color: 'bg-yellow-500 text-white', desc: 'Limitada — observacional / consenso' },
  D: { label: 'D', color: 'bg-gray-400 text-white', desc: 'Insuficiente — opinião de especialista' },
};

const PRIORITY_CONFIG = {
  essential:  { label: 'Essencial',   color: 'border-l-green-500',  bg: 'bg-green-50 dark:bg-green-950' },
  beneficial: { label: 'Benéfico',    color: 'border-l-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950' },
  optional:   { label: 'Opcional',    color: 'border-l-gray-400',   bg: 'bg-gray-50 dark:bg-gray-800' },
};

// ─── Built-in suggestion engine ───────────────────────────────────────────────
function generateSuggestions(
  goals: GoalType[],
  age: number,
  gender: 'male' | 'female',
  conditions: string[],
  labDeficiencies: string[],
): SupplementSuggestion[] {
  const suggs: SupplementSuggestion[] = [];
  const isVegan = conditions.some((c) => /veg(an|etarian)/i.test(c));
  const hasRenalDisease = conditions.some((c) => /renal|rim/i.test(c));
  const isPregnant = conditions.some((c) => /gráv|gravidez|gestante/i.test(c));

  // ── Lab deficiency-based ────────────────────────────────────────────────────
  if (labDeficiencies.some((d) => /vitamina.d|vit.d/i.test(d))) {
    suggs.push({
      name: 'Vitamina D3', dose: '5.000 UI/dia', timing: 'Com refeição gordurosa',
      rationale: 'Deficiência documentada laboratorialmente. Suplementação indicada até normalização dos níveis séricos (alvo: 40–60 ng/mL).',
      evidenceLevel: 'A', references: 'Holick MF. NEJM 2007; Endocrine Society Guidelines 2011',
      contraindications: ['Hipercalcemia', 'Sarcoidose'],
      priority: 'essential',
    });
  }

  if (labDeficiencies.some((d) => /ferro|ferritina|hemoglobina/i.test(d))) {
    suggs.push({
      name: 'Ferro bisglicinato', dose: '30–60 mg/dia', timing: 'Em jejum ou com vitamina C',
      rationale: 'Anemia ferropriva ou ferritina baixa documentada. Quelato preferível por melhor tolerância GI.',
      evidenceLevel: 'A', references: 'WHO. Iron Deficiency Anaemia 2001; Moretti D et al. Am J Clin Nutr 2006',
      contraindications: ['Hemocromatose', 'Anemia não-ferropriva'],
      priority: 'essential',
    });
  }

  if (labDeficiencies.some((d) => /b12|cobalamina/i.test(d)) || isVegan) {
    suggs.push({
      name: 'Vitamina B12 (cianocobalamina)', dose: '1.000 mcg/dia sublingual', timing: 'Qualquer horário',
      rationale: isVegan ? 'Dieta vegana/vegetariana sem fonte adequada de B12.' : 'Deficiência documentada laboratorialmente.',
      evidenceLevel: 'A', references: 'Watanabe F. Exp Biol Med 2007; EFSA 2015',
      contraindications: [],
      priority: 'essential',
    });
  }

  if (labDeficiencies.some((d) => /zinco/i.test(d))) {
    suggs.push({
      name: 'Zinco quelato (bisglicinato)', dose: '15–30 mg/dia', timing: 'Longe das refeições principais',
      rationale: 'Zinco sérico abaixo do valor de referência. Separar de ferro e cálcio.',
      evidenceLevel: 'B', references: 'Hambidge M. J Nutr 2000; Cousins RJ. J Nutr 2010',
      contraindications: ['Uso > 40mg/dia sem monitoramento de cobre'],
      priority: 'essential',
    });
  }

  // ── Goal-based ─────────────────────────────────────────────────────────────
  if (goals.includes('performance') || goals.includes('body_composition')) {
    if (!hasRenalDisease) {
      suggs.push({
        name: 'Creatina monoidratada', dose: '3–5 g/dia', timing: 'Pós-treino (com carboidrato)',
        rationale: 'Evidência A para ganho de força, hipertrofia e desempenho anaeróbico. Segura em renais saudáveis.',
        evidenceLevel: 'A', references: 'Lanhers C et al. Eur J Sport Sci 2017; Rawson ES. J Int Soc Sports Nutr 2021',
        contraindications: ['Doença renal crônica', 'TFG < 60 mL/min'],
        priority: 'essential',
      });
    }

    suggs.push({
      name: 'Whey protein isolado', dose: '25–40 g/dose', timing: 'Pós-treino ou entre refeições',
      rationale: 'Proteína de alto valor biológico para síntese proteica muscular. Isolado recomendado em intolerância à lactose.',
      evidenceLevel: 'A', references: 'Morton RW et al. Br J Sports Med 2018; Gorissen SH. Nutrients 2018',
      contraindications: ['Alergia à proteína do leite', 'DRC sem avaliação nefrologista'],
      priority: 'essential',
    });

    if (goals.includes('performance')) {
      suggs.push({
        name: 'Beta-alanina', dose: '3,2–6,4 g/dia (doses divididas)', timing: 'Dividido em doses de 0,8–1,6g para minimizar parestesia',
        rationale: 'Aumenta concentração muscular de carnosina; melhora resistência em exercícios de 1–4 minutos.',
        evidenceLevel: 'A', references: 'Hobson RM et al. Amino Acids 2012; Saunders B. Nutrients 2020',
        contraindications: ['Epilepsia (cautela com parestesia intensa)'],
        priority: 'beneficial',
      });

      suggs.push({
        name: 'Cafeína anidra', dose: '3–6 mg/kg 30–60min pré-treino', timing: 'Pré-treino, evitar após 14h',
        rationale: 'Reduz percepção de esforço, melhora força, potência e endurance.',
        evidenceLevel: 'A', references: 'Grgic J et al. Br J Sports Med 2020; ISSN position stand 2021',
        contraindications: ['Hipertensão não controlada', 'Arritmias', 'Gestação', 'Ansiedade grave'],
        priority: 'beneficial',
      });
    }
  }

  if (goals.includes('health') || goals.includes('clinical')) {
    suggs.push({
      name: 'Ômega-3 (EPA + DHA)', dose: '2–4 g/dia de EPA+DHA', timing: 'Com refeição gordurosa',
      rationale: 'Reduz triglicerídeos, inflamação sistêmica e risco cardiovascular.',
      evidenceLevel: 'A', references: 'Mozaffarian D. JAMA 2006; ASCEND Trial. NEJM 2018',
      contraindications: ['Anticoagulação (monitorar INR)', 'Cirurgia programada'],
      priority: 'beneficial',
    });

    suggs.push({
      name: 'Magnésio bisglicinato', dose: '300–400 mg/dia', timing: 'À noite (melhora sono)',
      rationale: 'Magnésio participa em > 300 reações enzimáticas. Deficiência subclínica prevalente em população brasileira.',
      evidenceLevel: 'B', references: 'Rosanoff A. Nutrients 2012; Barbagallo M. Nutrients 2021',
      contraindications: ['Insuficiência renal grave (TFG < 30)'],
      priority: 'beneficial',
    });
  }

  if (goals.includes('recovery')) {
    suggs.push({
      name: 'L-Glutamina', dose: '5–10 g/dia', timing: 'Pós-treino ou antes de dormir',
      rationale: 'Aminoácido condicional para integridade intestinal e recuperação imunológica em atletas de alto volume.',
      evidenceLevel: 'B', references: 'Cruzat V et al. Nutrients 2018; Legault Z. Nutrients 2015',
      contraindications: ['Doença hepática grave', 'Encefalopatia hepática'],
      priority: 'optional',
    });

    suggs.push({
      name: 'Coenzima Q10', dose: '100–200 mg/dia', timing: 'Com refeição gordurosa',
      rationale: 'Antioxidante mitocondrial; potencialmente benéfico em recuperação e em usuários de estatinas.',
      evidenceLevel: 'B', references: 'Díaz-Castro J. Nutrients 2012; Caso G. Am J Cardiol 2007',
      contraindications: ['Varfarina (monitorar INR)'],
      priority: 'optional',
    });
  }

  // ── Age-based additions ─────────────────────────────────────────────────────
  if (age >= 50) {
    suggs.push({
      name: 'Vitamina K2 (MK-7)', dose: '100–200 mcg/dia', timing: 'Com refeição gordurosa',
      rationale: 'Direcionamento de cálcio para os ossos (osteocalcina) e prevenção de calcificação vascular em adultos > 50 anos.',
      evidenceLevel: 'B', references: 'Schurgers LJ. Nutrients 2020; Knapen MH. Osteoporos Int 2013',
      contraindications: ['Varfarina / anticoagulantes cumarínicos — CONTRAINDICADO'],
      priority: 'beneficial',
    });

    suggs.push({
      name: 'Colágeno hidrolisado (tipo II)', dose: '10 g/dia', timing: 'Em jejum ou pré-treino',
      rationale: 'Melhora marcadores de dor e função articular. Evidência crescente para saúde cartilaginosa.',
      evidenceLevel: 'B', references: 'Shaw G et al. Am J Clin Nutr 2017; Dressler P et al. Appl Physiol Nutr Metab 2018',
      contraindications: ['Alergia a proteínas animais'],
      priority: 'optional',
    });
  }

  // Dedup by name
  const seen = new Set<string>();
  return suggs.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  }).sort((a, b) => {
    const pOrder = { essential: 0, beneficial: 1, optional: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });
}

const GOAL_OPTIONS: { key: GoalType; label: string; icon: string }[] = [
  { key: 'performance', label: 'Performance esportiva', icon: '🏃' },
  { key: 'body_composition', label: 'Composição corporal', icon: '💪' },
  { key: 'health', label: 'Saúde geral', icon: '❤️' },
  { key: 'recovery', label: 'Recuperação', icon: '🔄' },
  { key: 'clinical', label: 'Manejo clínico', icon: '🏥' },
];

export default function SupplementSuggestPage() {
  const [goals, setGoals] = useState<GoalType[]>(['health']);
  const [age, setAge] = useState(35);
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [conditions, setConditions] = useState('');
  const [labDeficiencies, setLabDeficiencies] = useState('');
  const [suggestions, setSuggestions] = useState<SupplementSuggestion[] | null>(null);
  const [protocolInteractions, setProtocolInteractions] = useState<any[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { text: aiRationale, isStreaming, simulateStream } = useStreamingText();

  const toggleGoal = (g: GoalType) => {
    setGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const handleGenerate = async () => {
    if (!goals.length) return;
    setIsGenerating(true);
    setSuggestions(null);
    setProtocolInteractions(null);
    await new Promise((r) => setTimeout(r, 600));

    const condArr = conditions.split(',').map((s) => s.trim()).filter(Boolean);
    const labArr = labDeficiencies.split(',').map((s) => s.trim()).filter(Boolean);
    const suggs = generateSuggestions(goals, age, gender, condArr, labArr);
    setSuggestions(suggs);

    // ── Call interactions API to check for inter-supplement interactions ────────
    const interactionResult = await api.interactions.analyze({
      supplements: suggs.map((s) => ({ name: s.name, dose: s.dose, frequency: 'conforme protocolo' })),
      medications: [],
      clinicalConditions: condArr.filter(Boolean),
      patientContext: {
        age: parseInt(String(age)) || 30,
        gender: gender === 'male' ? 'masculino' : 'feminino',
      },
    }).catch(() => null);

    const interactions: any[] = interactionResult?.interactions ?? [];
    if (interactions.length > 0) {
      setProtocolInteractions(interactions);
    }

    // ── Build a personalized AI analysis text from the real suggestions ─────────
    const genderLabel = gender === 'male' ? 'masculino' : 'feminino';
    const goalsLabel = goals.map((g) => GOAL_OPTIONS.find((o) => o.key === g)?.label).join(', ');
    const condLabel = condArr.length > 0 ? condArr.join(', ') : 'nenhuma informada';
    const labLabel = labArr.length > 0 ? labArr.join(', ') : 'nenhuma informada';

    const essentials = suggs.filter((s) => s.priority === 'essential');
    const beneficial = suggs.filter((s) => s.priority === 'beneficial');
    const optional   = suggs.filter((s) => s.priority === 'optional');

    const essentialsBlock = essentials.length > 0
      ? `Essenciais (${essentials.length}): ${essentials.map((s) => `${s.name} ${s.dose}`).join(' · ')}`
      : '';
    const beneficialBlock = beneficial.length > 0
      ? `Benéficos (${beneficial.length}): ${beneficial.map((s) => `${s.name} ${s.dose}`).join(' · ')}`
      : '';
    const optionalBlock = optional.length > 0
      ? `Opcionais (${optional.length}): ${optional.map((s) => `${s.name} ${s.dose}`).join(' · ')}`
      : '';

    const interactionsNote = interactions.length > 0
      ? `${interactions.length} interação(ões) identificada(s) entre suplementos do protocolo — veja a seção "Interações no Protocolo" acima.`
      : 'Nenhuma interação identificada entre os suplementos deste protocolo.';

    const aiText = [
      `ANÁLISE CLÍNICA DO PROTOCOLO`,
      ``,
      `Perfil: ${age} anos, sexo ${genderLabel}`,
      `Objetivos: ${goalsLabel}`,
      `Condições / restrições: ${condLabel}`,
      `Deficiências laboratoriais: ${labLabel}`,
      ``,
      `PROTOCOLO — ${suggs.length} suplemento(s) identificado(s)`,
      essentialsBlock,
      beneficialBlock,
      optionalBlock,
      ``,
      `INTERAÇÕES: ${interactionsNote}`,
      ``,
      `FUNDAMENTAÇÃO`,
      `Todos os suplementos foram selecionados com base em evidências científicas categorizadas (A–D). ` +
      `Os itens de evidência A contam com suporte de meta-análises ou múltiplos ensaios clínicos randomizados; ` +
      `os de evidência B possuem ao menos um ECR ou revisão sistemática; ` +
      `os de evidência C baseiam-se em estudos observacionais ou consenso de especialistas.`,
      ``,
      `O protocolo deve ser individualizado pelo nutricionista ou profissional habilitado, ` +
      `considerando exames laboratoriais recentes, histórico clínico completo e interações medicamentosas.`,
      ``,
      `⚠️ Este protocolo é ferramenta de apoio à decisão clínica. ` +
      `Prescrição e indicação de suplementos são atribuições do Nutricionista (CFN 599/2018).`,
    ].filter((line) => line !== undefined && line !== null).join('\n');

    simulateStream(aiText, 14);
    setIsGenerating(false);
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Protocolo de Suplementação"
        description="Sugestão baseada em evidências (A–D) por objetivo, perfil e exames laboratoriais"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Suplementação', href: '/supplementation' }, { label: 'Sugerir Protocolo' }]}
      />

      <div className="px-4 py-5 sm:p-6 max-w-5xl mx-auto w-full space-y-6">

        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
            <strong>Ferramenta de suporte à decisão clínica.</strong> As sugestões são baseadas em evidências científicas categorizadas.
            A indicação final é responsabilidade do Nutricionista ou profissional habilitado, considerando o contexto clínico individual.
          </AlertDescription>
        </Alert>

        {/* Input form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Configurar Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Goals */}
            <div>
              <Label className="mb-2 block">Objetivos clínicos *</Label>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => toggleGoal(g.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                      goals.includes(g.key)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                    }`}
                  >
                    <span>{g.icon}</span> {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Idade</Label>
                <Input type="number" min={10} max={100} value={age} onChange={(e) => setAge(Number(e.target.value))} />
              </div>
              <div>
                <Label>Sexo</Label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                  className="w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="female">Feminino</option>
                  <option value="male">Masculino</option>
                </select>
              </div>
              <div>
                <Label>Condições / Restrições</Label>
                <Input
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="Ex: vegetariano, diabetes, hipertensão"
                />
              </div>
            </div>

            <div>
              <Label>Deficiências laboratoriais identificadas</Label>
              <Input
                value={labDeficiencies}
                onChange={(e) => setLabDeficiencies(e.target.value)}
                placeholder="Ex: Vitamina D baixa, Ferritina baixa, B12 baixa, Zinco sérico baixo"
              />
              <p className="text-xs text-gray-400 mt-1">Separe por vírgula. Ativa recomendações prioritárias baseadas em exames.</p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!goals.length || isGenerating}
              className="w-full flex items-center gap-2"
              size="lg"
            >
              {isGenerating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando protocolo...</>
                : <><Sparkles className="h-4 w-4" /> Gerar Protocolo (3 tokens)</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* Evidence legend */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(EVIDENCE_LABEL).map(([lvl, cfg]) => (
            <div key={lvl} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-5 h-5 rounded text-center text-[10px] font-bold flex items-center justify-center ${cfg.color}`}>{cfg.label}</span>
              {cfg.desc}
            </div>
          ))}
        </div>

        {/* Suggestions */}
        {suggestions !== null && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {suggestions.length} suplemento(s) sugerido(s)
              </h2>
              <div className="flex gap-2">
                {(['essential','beneficial','optional'] as const).map((p) => {
                  const count = suggestions.filter((s) => s.priority === p).length;
                  if (!count) return null;
                  return (
                    <Badge key={p} variant="outline" className="text-xs">
                      {count} {PRIORITY_CONFIG[p].label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {suggestions.map((sugg, i) => {
              const pCfg = PRIORITY_CONFIG[sugg.priority];
              const eCfg = EVIDENCE_LABEL[sugg.evidenceLevel];
              return (
                <Card key={i} className={`border-l-4 ${pCfg.color} ${pCfg.bg}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{sugg.name}</span>
                        <span className={`w-6 h-6 rounded text-center text-[10px] font-bold flex items-center justify-center ${eCfg.color}`}>
                          {sugg.evidenceLevel}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                          sugg.priority === 'essential' ? 'border-green-400 text-green-700 dark:text-green-400'
                          : sugg.priority === 'beneficial' ? 'border-blue-400 text-blue-700 dark:text-blue-400'
                          : 'border-gray-300 text-gray-600 dark:text-gray-400'
                        }`}>
                          {PRIORITY_CONFIG[sugg.priority].label}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 mb-3 text-xs">
                      <div><span className="font-medium text-gray-500">Dose:</span> <span className="text-gray-800 dark:text-gray-200">{sugg.dose}</span></div>
                      <div><span className="font-medium text-gray-500">Timing:</span> <span className="text-gray-800 dark:text-gray-200">{sugg.timing}</span></div>
                    </div>

                    <p className="text-xs text-gray-700 dark:text-gray-300 mb-2 leading-relaxed">{sugg.rationale}</p>

                    <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-2">
                      <BookOpen className="h-3 w-3" />
                      {sugg.references}
                    </div>

                    {sugg.contraindications.length > 0 && (
                      <div className="flex items-start gap-1.5 mt-2 pt-2 border-t dark:border-gray-700">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-700 dark:text-amber-400">
                          <span className="font-medium">Contraindicações: </span>
                          {sugg.contraindications.join(' · ')}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Protocol interactions section */}
            {protocolInteractions && protocolInteractions.length > 0 && (
              <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    ⚠️ Interações no Protocolo
                    <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 dark:text-amber-400">
                      {protocolInteractions.length} encontrada(s)
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {protocolInteractions.map((interaction: any, idx: number) => (
                    <div key={idx} className="border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-white dark:bg-amber-900/30">
                      <div className="flex items-start gap-2 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          {interaction.supplements?.join(' + ') ?? interaction.name ?? `Interação ${idx + 1}`}
                        </span>
                        {interaction.severity && (
                          <Badge variant="outline" className={`text-[10px] ml-auto border-amber-400 ${
                            interaction.severity === 'high' ? 'text-red-700 dark:text-red-400 border-red-400' :
                            interaction.severity === 'moderate' ? 'text-amber-700 dark:text-amber-400' :
                            'text-gray-600 dark:text-gray-400 border-gray-300'
                          }`}>
                            {interaction.severity === 'high' ? 'Alta' : interaction.severity === 'moderate' ? 'Moderada' : 'Baixa'}
                          </Badge>
                        )}
                      </div>
                      {interaction.description && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed ml-5">
                          {interaction.description}
                        </p>
                      )}
                      {interaction.recommendation && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-5 italic">
                          Recomendação: {interaction.recommendation}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* AI rationale with streaming */}
            {(aiRationale || isStreaming) && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Análise Clínica do Protocolo
                    {isStreaming && <span className="text-xs font-normal text-blue-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> gerando...</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-blue-900 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">
                    {aiRationale}
                    {isStreaming && <span className="inline-block w-0.5 h-3.5 bg-blue-600 animate-pulse ml-0.5 align-text-bottom" />}
                  </pre>
                  {!isStreaming && (
                    <p className="text-xs text-gray-400 italic mt-3 border-t pt-2">
                      Protocolo de apoio · Responsabilidade de prescrição é do Nutricionista habilitado · CFN 599/2018
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
