'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Loader2, Search, BadgeCheck } from 'lucide-react';

export interface FoodResult {
  id: string;
  nome: string;
  grupoAlimentar: string | null;
  porcaoPadraoG: number;
  energiaKcal: number | null;
  proteinasG: number | null;
  carboidratosG: number | null;
  lipidiosG: number | null;
  sodioMg: number | null;
  fibrasG: number | null;
  fonte: string;
  fonteVersao: string | null;
  confiabilidade: string;
}

const CONF_BADGE: Record<string, string> = {
  alta: 'bg-green-100 text-green-700',
  media: 'bg-yellow-100 text-yellow-800',
  baixa: 'bg-orange-100 text-orange-700',
};

/**
 * Combobox de busca de alimentos na base de composição (TACO/TBCA/USDA).
 * Digitação livre permanece (campo controlado); ao selecionar um item da base,
 * dispara onSelect com os dados de composição (com proveniência) para autopreencher.
 */
export function FoodAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
}: {
  value: string;
  onChange: (name: string) => void;
  onSelect: (food: FoodResult) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const debounced = useDebounce(typed, 300);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['foods-search', debounced],
    queryFn: () => api.foods.search(debounced, 12),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 60_000,
  });
  const results = data ?? [];

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setTyped(e.target.value); setOpen(true); }}
          onFocus={() => { setTyped(value); setOpen(true); }}
          placeholder={placeholder ?? 'Buscar alimento na base…'}
          maxLength={100}
          aria-label="Buscar alimento"
          className={`pl-8 ${className ?? ''}`}
        />
        {isFetching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-gray-300" />}
      </div>

      {open && debounced.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-lg border bg-white dark:bg-gray-900 shadow-xl">
          {results.length === 0 && !isFetching && (
            <div className="px-3 py-2 text-xs text-gray-400">
              Nenhum alimento na base. Você pode digitar manualmente e informar os valores.
            </div>
          )}
          {results.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { onSelect(f); onChange(f.nome); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-0 border-gray-100 dark:border-gray-800"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{f.nome}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${CONF_BADGE[f.confiabilidade] ?? 'bg-gray-100 text-gray-500'}`}>
                  <BadgeCheck className="h-2.5 w-2.5" /> {f.fonte.toUpperCase()}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {f.energiaKcal != null ? `${Math.round(f.energiaKcal)} kcal` : '—'} · P {f.proteinasG ?? '—'}g · C {f.carboidratosG ?? '—'}g · G {f.lipidiosG ?? '—'}g
                <span className="text-gray-300"> / {Math.round(f.porcaoPadraoG)}g</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
