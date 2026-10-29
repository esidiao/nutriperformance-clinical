'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { contribuicaoDaRefeicao } from '@/lib/contribuicao-da-refeicao';

/**
 * Minerais e vitaminas DA REFEIÇÃO, como contribuição para o dia.
 *
 * Pedido da nutricionista (29/10/2026): ver os micronutrientes por refeição,
 * além do fechamento do dia.
 *
 * NÃO repete o veredicto do relatório diário, de propósito — a razão está em
 * `lib/contribuicao-da-refeicao.ts`. Em resumo: RDA e UL são diárias, e
 * carimbar "abaixo do recomendado" em cada refeição encheria um plano correto
 * de avisos falsos, ensinando a ignorá-los.
 *
 * Fechado por padrão: a informação é de consulta, e aberta por omissão
 * empurraria o cardápio — que é o que ela olha o tempo todo — para fora da
 * tela.
 */
export function MicrosDaRefeicao({
  pacienteId, micronutrientes,
}: {
  pacienteId: string;
  micronutrientes: Record<string, unknown> | null | undefined;
}) {
  const [aberto, setAberto] = useState(false);

  const { data: paciente } = useQuery({
    queryKey: ['patient', pacienteId],
    queryFn: () => api.patients.get(pacienteId),
    enabled: !!pacienteId,
  });

  const idade = Number((paciente as any)?.age ?? 0);
  const sexo = (paciente as any)?.gender;
  if (sexo !== 'male' && sexo !== 'female') return null;
  if (!(idade > 0)) return null;
  if (!micronutrientes || Object.keys(micronutrientes).length === 0) return null;

  const { linhas, faixa } = contribuicaoDaRefeicao(micronutrientes, idade, sexo);
  if (faixa === null || linhas.length === 0) return null;

  const excedidos = linhas.filter((l) => l.acimaDoLimiteDiario);

  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        {aberto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Micronutrientes ({linhas.length})
        {excedidos.length > 0 && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-red-700">
            <AlertTriangle className="h-3 w-3" /> {excedidos.length}
          </span>
        )}
      </button>

      {aberto && (
        <div className="mt-1.5 space-y-1">
          <p className="text-[10px] text-muted-foreground leading-snug">
            Percentual da recomendação <strong>do dia</strong> que esta refeição
            entrega. A avaliação de adequação é do plano inteiro, logo acima.
          </p>

          {linhas.map((l) => (
            <div key={l.nutriente} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-gray-600 dark:text-gray-300">{l.rotulo}</span>
              <span className="whitespace-nowrap">
                {l.ofertado} {l.unidade}
                {l.pctDoDia !== null && (
                  <span className="text-muted-foreground"> · {l.pctDoDia}% do dia</span>
                )}
                {l.acimaDoLimiteDiario && (
                  <span className="ml-1 text-red-700 font-medium">acima do limite diário</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
