'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { avaliarAdequacao, resumir, type LinhaAdequacao, type Situacao } from '@/lib/adequacao';

/**
 * Relatório de adequação do plano contra a recomendação diária.
 *
 * Era o pedido central da nutricionista: "depois eu preciso de um relatório
 * que me fale quanto que tem de nutrientes nessa dieta, pra eu saber se tá
 * adequado com o que a literatura me fala".
 *
 * O desenho todo gira em torno de NÃO achatar situações diferentes num
 * percentual. Cada estado tem cor, rótulo e frase próprios, porque "73% da
 * RDA", "73% do AI" e "73% de um total que só cobre 7 dos 10 alimentos" não
 * significam a mesma coisa.
 */

const ESTILO: Record<Situacao, { cor: string; chip: string; rotulo: string }> = {
  adequado:      { cor: 'text-green-700',  chip: 'bg-green-100 text-green-800',   rotulo: 'Atinge' },
  abaixo:        { cor: 'text-orange-700', chip: 'bg-orange-100 text-orange-800', rotulo: 'Abaixo' },
  acima_ul:      { cor: 'text-red-700',    chip: 'bg-red-100 text-red-800',       rotulo: 'Acima do limite' },
  acima_cdrr:    { cor: 'text-red-700',    chip: 'bg-red-100 text-red-800',       rotulo: 'Reduzir' },
  indeterminado: { cor: 'text-blue-700',   chip: 'bg-blue-100 text-blue-800',     rotulo: 'Sem conclusão' },
  incompleto:    { cor: 'text-amber-700',  chip: 'bg-amber-100 text-amber-900',   rotulo: 'Dado incompleto' },
  sem_dado:      { cor: 'text-gray-500',   chip: 'bg-gray-100 text-gray-600',     rotulo: 'Sem dado' },
};

function Linha({ l }: { l: LinhaAdequacao }) {
  const e = ESTILO[l.situacao];
  return (
    <tr className="border-b last:border-0 align-top">
      <td className="py-1.5 pr-2">
        <span className="text-gray-900">{l.rotulo}</span>
        <span className="text-gray-400 text-[10px] ml-1">{l.unidade}</span>
      </td>
      <td className="py-1.5 pr-2 text-right font-mono">
        {l.ofertado === null ? '—' : l.ofertado}
      </td>
      <td className="py-1.5 pr-2 text-right font-mono text-gray-500">
        {l.recomendado === null ? '—' : l.recomendado}
        {l.tipo !== '—' && <span className="text-[9px] ml-1 text-gray-400">{l.tipo}</span>}
      </td>
      <td className="py-1.5 pr-2 text-right font-mono">
        {/* Percentual só aparece quando significa alguma coisa. */}
        {l.percentual === null ? '—' : `${l.percentual}%`}
      </td>
      <td className="py-1.5">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${e.chip}`}>{e.rotulo}</span>
        <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{l.leitura}</p>
      </td>
    </tr>
  );
}

export function RelatorioAdequacao({
  patientId, totais,
}: {
  patientId: string;
  totais: Record<string, unknown> | null | undefined;
}) {
  const [aberto, setAberto] = useState(false);
  const [verFontes, setVerFontes] = useState(false);

  const { data: paciente } = useQuery({
    queryKey: ['paciente-adequacao', patientId],
    queryFn: () => api.patients.get(patientId),
    enabled: !!patientId,
  });

  const idade = Number((paciente as any)?.age ?? 0);
  const sexo = (paciente as any)?.gender;
  const sexoValido = sexo === 'male' || sexo === 'female';

  if (!patientId || !paciente) return null;

  // Sem sexo ou idade não há tabela aplicável, e inventar uma seria pior que
  // não mostrar o relatório.
  if (!sexoValido || !(idade > 0)) {
    return (
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-semibold mb-1">Adequação nutricional</p>
          <p className="text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded p-2.5">
            Para comparar a dieta com a recomendação diária é preciso o <strong>sexo</strong> e a{' '}
            <strong>data de nascimento</strong> do paciente — as recomendações mudam com os dois.
            Complete o cadastro.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Os macros vêm em campo próprio; os micros vêm com a cobertura junto.
  const entrada: Record<string, any> = {
    proteinasG: Number((totais as any)?.proteinasG ?? 0),
    fibrasG: Number((totais as any)?.fibrasG ?? 0),
    sodioMg: Number((totais as any)?.sodioMg ?? 0),
    ...((totais as any)?.micronutrientes ?? {}),
  };

  const { linhas, faixa, semDadoNaBase } = avaliarAdequacao(entrada, idade, sexo);
  const r = resumir(linhas);

  if (faixa === null) {
    return (
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-semibold mb-1">Adequação nutricional</p>
          <p className="text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded p-2.5">
            As tabelas carregadas são as de <strong>adultos (19 anos ou mais)</strong>. Este
            paciente tem {idade} anos — aplicar valor de adulto seria pior que não avaliar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <button
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="w-full flex items-center justify-between gap-2 text-left"
        >
          <div>
            <p className="text-sm font-semibold">Adequação nutricional</p>
            <p className="text-[11px] text-muted-foreground">
              DRI · {sexo === 'male' ? 'homem' : 'mulher'}, {faixa} anos ·{' '}
              {r.adequados} atingem · {r.abaixo} abaixo · {r.acimaDoLimite} acima do limite
              {r.incompletos > 0 && ` · ${r.incompletos} com dado incompleto`}
            </p>
          </div>
          {aberto ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {aberto && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b">
                    <th className="text-left font-medium py-1">Nutriente</th>
                    <th className="text-right font-medium py-1">Dieta</th>
                    <th className="text-right font-medium py-1">Recomendado</th>
                    <th className="text-right font-medium py-1">%</th>
                    <th className="text-left font-medium py-1 pl-2">Leitura</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => <Linha key={l.nutriente} l={l} />)}
                </tbody>
              </table>
            </div>

            {/* O que a base NÃO cobre. Omitir faria a lista parecer completa. */}
            <div className="text-[11px] text-gray-600 bg-gray-50 border rounded p-2.5 space-y-1">
              <p className="flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
                <span>
                  <strong>Não avaliados:</strong> {semDadoNaBase.join(', ')}. A base de
                  composição (TACO) não publica esses nutrientes — não é que a dieta não os
                  forneça, é que não há o dado.
                </span>
              </p>
              <p className="pl-[18px]">
                <strong>RDA</strong> cobre a necessidade de 97–98% das pessoas; abaixo dela
                sugere inadequação. <strong>AI</strong> é usado quando não há evidência para
                calcular RDA — abaixo de um AI não se conclui inadequação.
              </p>
            </div>

            <button
              onClick={() => setVerFontes((v) => !v)}
              className="text-[11px] text-blue-700 underline"
            >
              {verFontes ? 'Ocultar' : 'Ver'} a origem de cada valor
            </button>
            {verFontes && (
              <ul className="text-[10px] text-gray-500 space-y-0.5 pl-4 list-disc">
                {linhas.map((l) => (
                  <li key={l.nutriente}>
                    <strong>{l.rotulo}:</strong> {l.fonte}
                    {l.nota ? ` — ${l.nota}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
