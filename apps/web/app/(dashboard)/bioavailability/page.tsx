'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, Coins, Plus, X, Dna, AlertTriangle } from 'lucide-react';

interface BioRisk {
  factor: string;
  affectedInContext: string[];
  mechanism: string;
  riskLevel: 'low' | 'moderate' | 'high';
  confidence: string;
  evidence: string;
  suggestion: string;
}

const RISK_STYLE = {
  low:      { border: 'border-l-green-400 bg-green-50',  badge: 'bg-green-100 text-green-800',  label: 'Baixo' },
  moderate: { border: 'border-l-yellow-400 bg-yellow-50',badge: 'bg-yellow-100 text-yellow-800', label: 'Moderado' },
  high:     { border: 'border-l-red-500 bg-red-50',      badge: 'bg-red-100 text-red-700',       label: 'Alto' },
};

export default function BioavailabilityPage() {
  const [nutrients, setNutrients] = useState<string[]>(['Ferro', 'Vitamina D3', 'Zinco']);
  const [medications, setMedications] = useState<string[]>(['Omeprazol 20mg']);
  const [giConditions, setGiConditions] = useState<string[]>(['']);
  const [surgicalHistory, setSurgicalHistory] = useState<string[]>(['']);
  const [dietaryFactors, setDietaryFactors] = useState<string[]>(['']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<BioRisk[] | null>(null);
  const [aiAssessment, setAiAssessment] = useState<string | null>(null);
  const [referralNeeded, setReferralNeeded] = useState(false);

  const addItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    setter((p) => [...p, '']);
  const removeItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) =>
    setter((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, val: string) =>
    setter((p) => p.map((x, idx) => (idx === i ? val : x)));

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setResults(null);
    await new Promise((r) => setTimeout(r, 2500));

    const mockResults: BioRisk[] = [];

    // Simular: Ferro + Omeprazol
    if (medications.some((m) => /omeprazol|IBP|lansoprazol/i.test(m)) &&
        nutrients.some((n) => /ferro/i.test(n))) {
      mockResults.push({
        factor: 'Uso de Omeprazol (IBP)',
        affectedInContext: ['Ferro'],
        mechanism: 'IBPs reduzem acidez gástrica, prejudicando absorção de ferro não-heme que depende de pH ácido',
        riskLevel: 'moderate',
        confidence: 'high',
        evidence: 'observational',
        suggestion: 'Preferir ferro quelato (bisglicinato). Administrar com vitamina C. Separar horário do omeprazol.',
      });
    }

    // Simular: Vitamina D genérico
    if (nutrients.some((n) => /vitamina.d/i.test(n))) {
      mockResults.push({
        factor: 'Vitamina D — lipossolúvel',
        affectedInContext: ['Vitamina D3'],
        mechanism: 'Vitamina D3 é lipossolúvel; absorção depende da presença de gordura na refeição',
        riskLevel: 'low',
        confidence: 'high',
        evidence: 'rct',
        suggestion: 'Administrar com refeição contendo gordura (ex: almoço ou jantar). Monitorar 25-OH vitamina D sérica.',
      });
    }

    // Simular: Zinco + dieta rica em fitatos
    if (nutrients.some((n) => /zinco/i.test(n)) &&
        dietaryFactors.some((d) => /fitato|cereal|leguminosa/i.test(d))) {
      mockResults.push({
        factor: 'Fitatos na dieta',
        affectedInContext: ['Zinco'],
        mechanism: 'Ácido fítico (fitatos) quelam zinco e outros minerais divalentes, reduzindo biodisponibilidade',
        riskLevel: 'moderate',
        confidence: 'high',
        evidence: 'rct',
        suggestion: 'Remolho ou germinação de cereais e leguminosas reduz fitatos. Separar ingestão de zinco destas refeições.',
      });
    }

    setResults(mockResults);
    setReferralNeeded(mockResults.some((r) => r.riskLevel === 'high'));
    setAiAssessment(
      'Análise complementar (IA):\n\n' +
      'Com base nos dados informados, os principais fatores de comprometimento de biodisponibilidade ' +
      'identificados para este paciente são a combinação de ferro com IBP e a vitamina D lipossolúvel.\n\n' +
      'Sugere-se:\n' +
      '• Reavaliação laboratorial de ferro e ferritina em 60-90 dias após ajuste do protocolo;\n' +
      '• Monitoramento de 25-OH vitamina D em 90 dias;\n' +
      '• Monitoramento de zinco sérico após ajuste dietético.\n\n' +
      'Dados insuficientes para análise completa de zinco sem informações sobre ingestão dietética habitual.',
    );
    setIsAnalyzing(false);
  };

  const ListInput = ({
    label, items, setter,
    placeholder,
  }: {
    label: string;
    items: string[];
    setter: React.Dispatch<React.SetStateAction<string[]>>;
    placeholder: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <Button type="button" size="sm" variant="ghost"
          className="h-6 text-xs text-blue-600 hover:text-blue-700"
          onClick={() => addItem(setter)}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={(e) => updateItem(setter, i, e.target.value)}
            placeholder={placeholder} className="text-sm" />
          {items.length > 1 && (
            <Button type="button" variant="ghost" size="sm" className="h-10 w-9 p-0 flex-shrink-0"
              onClick={() => removeItem(setter, i)}>
              <X className="h-3.5 w-3.5 text-red-400" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análise de Biodisponibilidade</h1>
          <p className="text-gray-500 text-sm mt-1">
            Identificar fatores que comprometem absorção nutricional e de suplementos
          </p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-300 flex items-center gap-1">
          <Coins className="h-3 w-3" /> 12 tokens
        </Badge>
      </div>

      <Alert className="border-amber-300 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-xs leading-relaxed">
          <strong>Ferramenta de apoio clínico.</strong> A análise identifica potenciais fatores de
          comprometimento de biodisponibilidade com base em dados informados — não substitui avaliação
          individualizada pelo nutricionista. Fatores não informados não serão avaliados.
          Todas as sugestões requerem validação profissional.
        </AlertDescription>
      </Alert>

      {/* Formulário de entrada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Dna className="h-4 w-4 text-blue-600" />
            Dados para Análise
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ListInput label="Nutrientes / Suplementos a analisar"
            items={nutrients} setter={setNutrients}
            placeholder="Ex: Ferro, Vitamina D, Zinco" />

          <ListInput label="Medicamentos em uso"
            items={medications} setter={setMedications}
            placeholder="Ex: Omeprazol 20mg, Metformina" />

          <ListInput label="Condições gastrointestinais"
            items={giConditions} setter={setGiConditions}
            placeholder="Ex: Síndrome do Intestino Irritável, Doença celíaca" />

          <ListInput label="Histórico cirúrgico"
            items={surgicalHistory} setter={setSurgicalHistory}
            placeholder="Ex: Cirurgia bariátrica (sleeve), Gastrectomia" />

          <ListInput label="Fatores dietéticos relevantes"
            items={dietaryFactors} setter={setDietaryFactors}
            placeholder="Ex: Dieta rica em fitatos, Alto consumo de cafeína" />
        </CardContent>
      </Card>

      <Button onClick={handleAnalyze} disabled={isAnalyzing} size="lg" className="w-full flex items-center gap-2">
        {isAnalyzing ? (
          <><span className="animate-spin">⟳</span> Analisando biodisponibilidade…</>
        ) : (
          <><Dna className="h-4 w-4" /> Analisar Biodisponibilidade (12 tokens)</>
        )}
      </Button>

      {/* Resultados */}
      {results !== null && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border text-sm">
            <span className="font-medium text-gray-700">{results.length} fator(es) de comprometimento identificado(s)</span>
            {referralNeeded && (
              <span className="flex items-center gap-1 text-red-700 text-xs font-semibold ml-auto">
                <AlertTriangle className="h-3.5 w-3.5" /> Encaminhamento recomendado
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4 pb-3 text-sm text-green-800">
                Nenhum fator de comprometimento de alta evidência identificado para esta combinação.
                Isto não exclui fatores não informados ou de baixa evidência.
              </CardContent>
            </Card>
          ) : (
            results.map((risk, i) => {
              const style = RISK_STYLE[risk.riskLevel];
              return (
                <Card key={i} className={`border-l-4 ${style.border}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="font-semibold text-sm text-gray-900">{risk.factor}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${style.badge}`}>{style.label}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-gray-700">
                      <p><span className="font-medium text-gray-500">Nutrientes afetados:</span>{' '}
                        {risk.affectedInContext.join(', ')}</p>
                      <p><span className="font-medium text-gray-500">Mecanismo:</span> {risk.mechanism}</p>
                      <p className="font-medium text-gray-900 flex gap-1">
                        <span className="text-blue-600">→</span> {risk.suggestion}
                      </p>
                      <div className="flex gap-3 text-gray-400 pt-1">
                        <span>Evidência: {risk.evidence}</span>
                        <span>Confiança: {risk.confidence}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Análise de IA complementar */}
          {aiAssessment && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-800">Análise Complementar (IA)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{aiAssessment}</pre>
                <p className="text-xs text-gray-400 italic mt-3 border-t border-blue-200 pt-2">
                  Análise de apoio · Requer validação do nutricionista responsável · Não substitui avaliação clínica.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
