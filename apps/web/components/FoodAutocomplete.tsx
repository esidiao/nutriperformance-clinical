'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Loader2, Search, BadgeCheck } from 'lucide-react';

import type { MedidaCaseira } from './SeletorMedidaCaseira';

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
  /** Medidas caseiras. Vazio para a TACO, que nao as publica. */
  medidas?: MedidaCaseira[];
  confiabilidade: string;
  // Micronutrientes: a API sempre devolveu, o tipo e que nao declarava — e
  // por isso o relatorio de adequacao nao existia na tela de prescricao.
  calcioMg?: number | null;
  ferroMg?: number | null;
  potassioMg?: number | null;
  magnesioMg?: number | null;
  zincoMg?: number | null;
  /** `{ chave: { valor, unidade } }`, no formato da TACO. */
  vitaminas?: Record<string, { valor: number; unidade?: string } | number> | null;
}

/**
 * Uma linha da lista de alimentos.
 *
 * O NOME INTEIRO APARECE, E ISSO É O PONTO.
 *
 * Antes o nome era `flex-1 truncate` com o selo da fonte ao lado, dentro de um
 * cartão de refeição estreito. Resultado em uso real (relato da nutricionista,
 * 28/10/2026): digitando "ovo", as opções apareciam como "OVO ..." — quatro
 * linhas iguais. Para saber se era ovo cozido, frito ou pochê ela tinha que
 * CLICAR em cada uma e conferir; a primeira, que parecia ovo, era Ovomaltine.
 * O mesmo com carne cozida, desfiada e moída.
 *
 * Os nomes do IBGE são longos de propósito ("PARTE DE GALINHA OU FRANGO NAO
 * ESPECIFICADA, empanado(a)/a milanesa"): é a preparação que distingue um
 * registro do outro, e a preparação vem DEPOIS da vírgula — exatamente o
 * pedaço que o truncamento comia. Truncar aqui não escondia um detalhe,
 * escondia a única coisa que diferencia as opções.
 *
 * Então o nome ocupa a linha inteira e quebra em quantas linhas precisar, e o
 * selo da fonte desceu para a linha dos macros, onde não disputa largura.
 *
 * Exportado para a bancada de verificação conseguir desenhar a linha com nomes
 * reais sem subir a busca inteira.
 */
export function ItemDeAlimento({ alimento: f }: { alimento: FoodResult }) {
  return (
    <>
      <div className="text-sm text-gray-800 dark:text-gray-200 break-words leading-snug">
        {f.nome}
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mt-1">
        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 shrink-0 ${CONF_BADGE[f.confiabilidade] ?? 'bg-gray-100 text-gray-500'}`}>
          <BadgeCheck className="h-2.5 w-2.5" /> {f.fonte.toUpperCase()}
        </span>
        <span>
          {f.energiaKcal != null ? `${Math.round(f.energiaKcal)} kcal` : '—'} · P {f.proteinasG ?? '—'}g · C {f.carboidratosG ?? '—'}g · G {f.lipidiosG ?? '—'}g
          <span className="text-gray-300"> / {Math.round(f.porcaoPadraoG)}g</span>
        </span>
      </div>
    </>
  );
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

      {/*
        A lista pode ser MAIS LARGA que o campo.
        O campo de busca vive dentro do cartão da refeição, que é estreito
        (~250 px). Com `w-full` a lista herdava essa largura e um nome do IBGE
        virava quatro linhas — ou, antes, virava "OVO ...". Como o painel é
        `absolute`, o `min-w` o deixa passar da largura do cartão sem empurrar
        nada do layout. O teto segura dentro da tela no celular.
      */}
      {open && debounced.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full min-w-[20rem] max-w-[min(34rem,88vw)] max-h-80 overflow-auto rounded-lg border bg-white dark:bg-gray-900 shadow-xl">
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
              <ItemDeAlimento alimento={f} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
