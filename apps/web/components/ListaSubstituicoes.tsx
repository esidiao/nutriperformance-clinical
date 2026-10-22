'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Replace, Printer, AlertTriangle, Info } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Lista de substituições do plano, para entregar ao paciente.
 *
 * PARA QUEM ESTA TELA É
 *
 * Para o paciente, não para a profissional. Foi o que ela pediu: "o paciente
 * tem opções de escolha e diversidade na dieta, evita monotonia". Então a
 * leitura precisa funcionar impressa, sem interação, e em linguagem de
 * cozinha — medida caseira antes de grama.
 *
 * O QUE A TELA NÃO PODE ESCONDER
 *
 * Três coisas, cada uma por um motivo:
 *
 *  - a DIVERGÊNCIA da troca. Igualar o carboidrato de duas fontes de
 *    carboidrato não iguala as calorias. Sem o desvio à vista, a lista
 *    pareceria uma tabela de trocas livres, e não é;
 *  - o DESVIO DA MEDIDA CASEIRA. "2 colheres" é aproximação; apresentá-la
 *    como exata transformaria uma estimativa declarada em afirmação falsa;
 *  - os itens SEM TROCA, com o motivo. Sumir com eles faria a folha parecer
 *    completa, e o paciente concluiria que aquele alimento não se substitui
 *    quando a verdade é que o sistema não soube dizer.
 */

const REFEICOES: Record<string, string> = {
  cafe_manha: 'Café da manhã',
  lanche_manha: 'Lanche da manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
  pre_treino: 'Pré-treino',
  pos_treino: 'Pós-treino',
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const g = (v: unknown) => `${n(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} g`;

/** "+43 kcal" / "−12 kcal". O sinal é a informação. */
function comSinal(valor: number, unidade: string): string | null {
  const v = Math.round(valor * 10) / 10;
  if (v === 0) return null;
  const sinal = v > 0 ? '+' : '−';
  return `${sinal}${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unidade}`;
}

function Sugestao({ s }: { s: any }) {
  const divergencias = [
    comSinal(n(s.divergencia?.kcal), 'kcal'),
    comSinal(n(s.divergencia?.proteinasG), 'g de proteína'),
    comSinal(n(s.divergencia?.lipidiosG), 'g de gordura'),
    comSinal(n(s.divergencia?.fibrasG), 'g de fibra'),
  ].filter(Boolean);

  return (
    <li className="py-1.5 border-b last:border-0">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="text-sm">{s.nome}</span>
        <span className="text-sm font-semibold whitespace-nowrap">
          {s.medidaTexto ?? g(s.quantidadeG)}
        </span>
      </div>

      {/* A medida caseira é aproximação. O peso real e o desvio ficam à
          vista, senão a estimativa viraria afirmação. */}
      {s.medidaTexto && (
        <p className="text-[11px] text-gray-500">
          ≈ {g(s.medidaCaseira?.gramasReais)}
          {s.medidaCaseira?.desvioG
            ? ` · ${comSinal(n(s.medidaCaseira.desvioG), 'g')} em relação ao equivalente exato (${g(s.quantidadeG)})`
            : ''}
        </p>
      )}

      {divergencias.length > 0 && (
        <p className="text-[11px] text-amber-700">
          Em relação ao original: {divergencias.join(' · ')}
        </p>
      )}
    </li>
  );
}

export function ListaSubstituicoes({ planoId }: { planoId: string }) {
  const [verContas, setVerContas] = useState(false);

  const q = useQuery({
    queryKey: ['substituicoes', planoId],
    queryFn: () => api.mealPlans.substituicoes(planoId),
    enabled: !!planoId,
  });

  if (q.isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <p className="p-4 text-sm text-destructive">Não foi possível montar a lista.</p>;
  }

  const dados: any = q.data;
  const itens: any[] = dados.itens ?? [];
  const semVinculo: any[] = dados.semVinculo ?? [];

  const comTroca = itens.filter((i) => (i.lista?.substituicoes?.length ?? 0) > 0);
  const semTroca = itens.filter((i) => !(i.lista?.substituicoes?.length ?? 0));

  // Agrupa por refeição: é como o paciente lê o próprio dia.
  const porRefeicao = new Map<string, any[]>();
  for (const i of comTroca) {
    const lista = porRefeicao.get(i.refeicao);
    if (lista) lista.push(i); else porRefeicao.set(i.refeicao, [i]);
  }

  return (
    <Card className="print:border-0 print:shadow-none">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Replace className="h-4 w-4 text-green-600" />
              Lista de substituições
            </p>
            <p className="text-[11px] text-muted-foreground">
              Opções equivalentes para cada alimento do plano, dentro do mesmo grupo.
            </p>
          </div>
          <Button
            size="sm" variant="outline" onClick={() => window.print()}
            className="print:hidden"
          >
            <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
          </Button>
        </div>

        {comTroca.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhum alimento deste plano tem substituição disponível.
          </p>
        ) : (
          // Array.from, nao espalhamento: o alvo do tsconfig nao itera
          // iterador de Map sem downlevelIteration.
          Array.from(porRefeicao.entries()).map(([refeicao, doGrupo]) => (
            <div key={refeicao} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 border-b pb-1">
                {REFEICOES[refeicao] ?? refeicao}
              </p>

              {doGrupo.map((item) => (
                <div key={item.itemId} className="pl-1">
                  <p className="text-sm font-medium">
                    {item.lista.origem.nome}
                    <span className="text-gray-400 font-normal ml-1">
                      {g(item.lista.origem.quantidadeG)}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-1">
                    Pode trocar por qualquer uma destas, que entregam{' '}
                    {item.lista.referenciaOriginal} de {item.lista.rotuloReferencia}:
                  </p>
                  <ul className="pl-3">
                    {item.lista.substituicoes.map((s: any) => (
                      <Sugestao key={s.foodId} s={s} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))
        )}

        {/* O que NÃO tem troca, com o motivo. Omitir faria a folha parecer
            completa, e o paciente concluiria que o alimento não se
            substitui — quando a verdade é que o sistema não soube dizer. */}
        {(semTroca.length > 0 || semVinculo.length > 0) && (
          <div className="text-[11px] text-gray-600 bg-gray-50 border rounded p-2.5 space-y-1.5">
            <p className="flex items-start gap-1.5 font-medium">
              <Info className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
              Sem substituição automática
            </p>
            {semTroca.map((i) => (
              <p key={i.itemId} className="pl-[18px]">
                <strong>{i.lista.origem.nome}:</strong> {i.lista.indisponivel}
              </p>
            ))}
            {semVinculo.map((i) => (
              <p key={i.itemId} className="pl-[18px]">
                <strong>{i.nome}:</strong> foi digitado à mão, sem vínculo com a base de
                composição — sem ela não há o que comparar.
              </p>
            ))}
          </div>
        )}

        <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
          <span>
            As trocas igualam o nutriente principal do grupo, não a refeição inteira — por
            isso cada opção mostra o que muda. Alergia, intolerância e preferência não entram
            nesta conta: quem avalia é a nutricionista.
          </span>
        </div>

        {/* A conta, para a profissional conferir. Fora da impressão: é
            informação dela, não do paciente. */}
        <button
          onClick={() => setVerContas((v) => !v)}
          className="text-[11px] text-blue-700 underline print:hidden"
        >
          {verContas ? 'Ocultar' : 'Ver'} o cálculo de cada equivalência
        </button>
        {verContas && (
          <ul className="text-[10px] text-gray-500 space-y-0.5 pl-4 list-disc print:hidden">
            {comTroca.flatMap((i) =>
              i.lista.substituicoes.map((s: any) => (
                <li key={`${i.itemId}-${s.foodId}`}>
                  <strong>{i.lista.origem.nome} → {s.nome}:</strong> {s.calculo}
                </li>
              )))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
