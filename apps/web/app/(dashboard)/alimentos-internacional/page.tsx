'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import { Globe, Search, Loader2, BadgeCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function AlimentosInternacionalPage() {
  const [q, setQ] = useState('');

  const mut = useMutation({
    mutationFn: (query: string) => api.foods.usda(query, 12),
    onSuccess: (rows) => {
      if (rows.length === 0) toast.message('Nenhum alimento encontrado no USDA (ou limite da chave atingido).');
      else toast.success(`${rows.length} alimento(s) importado(s) do USDA — já disponíveis na prescrição, comparador e assistente.`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao consultar o USDA.'),
  });

  const results = mut.data ?? [];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Base Internacional (USDA)"
        description="Importar alimentos do USDA FoodData Central (domínio público)"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Base Internacional' }]}
      />
      <div className="px-4 py-5 sm:p-6 max-w-3xl mx-auto w-full space-y-5 flex-1">

        <Alert className="border-blue-200 bg-blue-50">
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-xs leading-relaxed">
            Busca em <strong>inglês</strong> no USDA FoodData Central (ex.: "cooked brown rice", "salmon").
            Os alimentos importados ficam <strong>cacheados</strong> e passam a aparecer na prescrição, no comparador e no assistente.
            Use uma chave própria (env <code>USDA_API_KEY</code>) para maior volume — sem ela, usa-se a DEMO (limitada).
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="py-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && q.trim().length >= 2) mut.mutate(q); }}
                  placeholder="Buscar no USDA (em inglês)…"
                  className="pl-8"
                  aria-label="Buscar alimento no USDA"
                />
              </div>
              <Button onClick={() => mut.mutate(q)} disabled={mut.isPending || q.trim().length < 2} className="flex items-center gap-1.5">
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} Importar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {results.map((f) => (
            <Card key={f.id}>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-sm">{f.nome}</CardTitle>
                {f.grupoAlimentar && <p className="text-[11px] text-gray-400">{f.grupoAlimentar}</p>}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {f.energiaKcal != null ? `${Math.round(f.energiaKcal)} kcal` : '—'} · P {f.proteinasG ?? '—'}g ·
                  C {f.carboidratosG ?? '—'}g · G {f.lipidiosG ?? '—'}g · Fibra {f.fibrasG ?? '—'}g · Sódio {f.sodioMg ?? '—'}mg · Ferro {f.ferroMg ?? '—'}mg
                  <span className="text-gray-300"> / 100g</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1.5">
                  <BadgeCheck className="h-3 w-3" /> Fonte: <strong>USDA</strong> · domínio público · confiabilidade {f.confiabilidade}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
