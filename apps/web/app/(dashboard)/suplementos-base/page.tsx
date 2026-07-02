'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import { Pill, Search, Loader2, AlertTriangle, ShieldAlert, BadgeCheck } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

export default function SuplementosBasePage() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const debounced = useDebounce(submitted, 300);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['suppcat', debounced],
    queryFn: () => api.supplementsCatalog.search(debounced, 12),
    enabled: debounced.trim().length >= 2,
  });
  const results = data ?? [];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Base de Suplementos"
        description="Consulta de ingredientes e rótulos — NIH DSLD"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Base de Suplementos' }]}
      />
      <div className="px-4 py-5 sm:p-6 max-w-3xl mx-auto w-full space-y-5 flex-1">

        <Alert className="border-blue-200 bg-blue-50">
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-xs leading-relaxed">
            Catálogo de rótulos do <strong>NIH DSLD</strong> (mercado dos EUA — marcas/produtos podem diferir do Brasil).
            Útil para consultar ingredientes (ex.: "contém cafeína/vitamina K"). Valide rótulo nacional e regras da ANVISA.
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
                  onKeyDown={(e) => { if (e.key === 'Enter') setSubmitted(q); }}
                  placeholder="Buscar suplemento (ex.: creatine, vitamin k, iron)…"
                  className="pl-8"
                  aria-label="Buscar suplemento"
                />
              </div>
              <Button onClick={() => setSubmitted(q)} disabled={isFetching} className="flex items-center gap-1.5">
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {isError && (
          <p className="text-sm text-gray-500 text-center py-4">Não foi possível consultar o NIH DSLD agora. Tente novamente.</p>
        )}

        {!isFetching && debounced.length >= 2 && results.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum suplemento encontrado para "{debounced}".</p>
        )}

        <div className="space-y-3">
          {results.map((s) => (
            <Card key={s.dsldId}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  <Pill className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm">{s.nome ?? s.marca ?? 'Suplemento'}</CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.marca ?? '—'}{s.formaFarmaceutica ? ` · ${s.formaFarmaceutica}` : ''}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {s.flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {s.flags.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2.5 py-1">
                        <AlertTriangle className="h-3 w-3" /> {f}
                      </span>
                    ))}
                  </div>
                )}
                {s.ingredientesAtivos.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 mb-0.5">Ingredientes</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {s.ingredientesAtivos.map((i) => i.name).filter(Boolean).slice(0, 25).join(' · ')}
                    </p>
                  </div>
                )}
                {s.advertencias.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 mb-0.5">Advertências (rótulo)</p>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      {s.advertencias.map((a, i) => <li key={i}>• {a}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-[11px] text-gray-400 border-t pt-1.5 flex items-center gap-1.5">
                  <BadgeCheck className="h-3 w-3" /> Fonte: <strong>NIH DSLD</strong> ({s.licenca}) · {s.pais}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
