'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import { FoodAutocomplete, type FoodResult } from '@/components/FoodAutocomplete';
import { Scale, X, Plus, Loader2, ShieldAlert, BadgeCheck } from 'lucide-react';

interface Row { key: string; label: string; unit: string; better: 'low' | 'high' | 'none'; }

// Linhas comparadas (valores por porção padrão / 100g). "better" define o semáforo.
const ROWS: Row[] = [
  { key: 'energiaKcal', label: 'Energia', unit: 'kcal', better: 'none' },
  { key: 'proteinasG', label: 'Proteínas', unit: 'g', better: 'high' },
  { key: 'carboidratosG', label: 'Carboidratos', unit: 'g', better: 'none' },
  { key: 'lipidiosG', label: 'Gorduras', unit: 'g', better: 'none' },
  { key: 'fibrasG', label: 'Fibras', unit: 'g', better: 'high' },
  { key: 'sodioMg', label: 'Sódio', unit: 'mg', better: 'low' },
  { key: 'ferroMg', label: 'Ferro', unit: 'mg', better: 'high' },
  { key: 'calcioMg', label: 'Cálcio', unit: 'mg', better: 'high' },
  { key: 'potassioMg', label: 'Potássio', unit: 'mg', better: 'high' },
  { key: 'magnesioMg', label: 'Magnésio', unit: 'mg', better: 'high' },
  { key: 'zincoMg', label: 'Zinco', unit: 'mg', better: 'high' },
];

export default function ComparadorPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [picker, setPicker] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['foods-compare', ids],
    queryFn: () => api.foods.compare(ids),
    enabled: ids.length >= 2,
  });
  const foods: any[] = data ?? [];

  const addFood = (f: FoodResult) => {
    setPicker('');
    setIds((prev) => (prev.includes(f.id) || prev.length >= 4 ? prev : [...prev, f.id]));
  };
  const removeFood = (id: string) => setIds((prev) => prev.filter((x) => x !== id));

  // Para cada linha, identifica os índices "melhores"/"piores" para o semáforo.
  const extremes = (rowKey: string, better: Row['better']) => {
    if (better === 'none' || foods.length < 2) return { best: new Set<number>(), worst: new Set<number>() };
    const vals = foods.map((f) => (typeof f[rowKey] === 'number' ? f[rowKey] : null));
    const present = vals.filter((v): v is number => v != null);
    if (present.length < 2) return { best: new Set<number>(), worst: new Set<number>() };
    const max = Math.max(...present), min = Math.min(...present);
    if (max === min) return { best: new Set<number>(), worst: new Set<number>() };
    const best = new Set<number>(), worst = new Set<number>();
    vals.forEach((v, i) => {
      if (v == null) return;
      const good = better === 'high' ? v === max : v === min;
      const bad = better === 'high' ? v === min : v === max;
      if (good) best.add(i); else if (bad) worst.add(i);
    });
    return { best, worst };
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Comparador Nutricional"
        description="Compare 2 a 4 alimentos lado a lado"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Comparador' }]}
      />
      <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto w-full space-y-5 flex-1">

        <Alert className="border-blue-200 bg-blue-50">
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-xs leading-relaxed">
            Comparação por porção padrão (100g) com dados da base de composição. Verde = melhor perfil para o nutriente;
            vermelho = pior. Apoio à decisão — não substitui julgamento clínico individualizado.
          </AlertDescription>
        </Alert>

        {/* Seletor */}
        <Card>
          <CardContent className="py-4 space-y-3">
            {ids.length < 4 && (
              <div>
                <label className="text-xs font-semibold text-gray-600">Adicionar alimento ({ids.length}/4)</label>
                <div className="mt-1">
                  <FoodAutocomplete
                    value={picker}
                    onChange={setPicker}
                    onSelect={addFood}
                    placeholder="Buscar alimento na base (TACO)…"
                  />
                </div>
              </div>
            )}
            {ids.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {foods.map((f) => (
                  <span key={f.id} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-2.5 py-1">
                    {f.nome}
                    <button onClick={() => removeFood(f.id)} aria-label={`Remover ${f.nome}`} className="text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {ids.length < 2 && (
          <div className="text-center py-12 text-gray-400">
            <Scale className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione ao menos 2 alimentos para comparar.</p>
          </div>
        )}

        {isFetching && ids.length >= 2 && (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
        )}

        {/* Tabela comparativa */}
        {!isFetching && foods.length >= 2 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4 text-blue-600" /> Comparação (por 100g)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Nutriente</th>
                    {foods.map((f) => (
                      <th key={f.id} className="text-right py-2 px-2 text-xs font-semibold text-gray-700 dark:text-gray-300 min-w-[110px]">{f.nome}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {ROWS.map((row) => {
                    const { best, worst } = extremes(row.key, row.better);
                    return (
                      <tr key={row.key}>
                        <td className="py-2 px-2 text-xs text-gray-600 dark:text-gray-400">{row.label} <span className="text-gray-300">({row.unit})</span></td>
                        {foods.map((f, i) => {
                          const v = typeof f[row.key] === 'number' ? f[row.key] : null;
                          const cls = best.has(i) ? 'text-green-700 font-semibold' : worst.has(i) ? 'text-red-600' : 'text-gray-800 dark:text-gray-200';
                          return <td key={f.id} className={`py-2 px-2 text-right font-mono ${cls}`}>{v != null ? v : '—'}</td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1.5 border-t pt-2">
                <BadgeCheck className="h-3 w-3" /> Fonte: {foods.map((f) => f.fonte?.toUpperCase()).filter((v, i, a) => a.indexOf(v) === i).join(', ')} · valores por 100g
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
