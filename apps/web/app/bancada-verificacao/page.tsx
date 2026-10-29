'use client';

/**
 * Bancada de verificacao visual — SO EM DESENVOLVIMENTO.
 *
 * As telas deste ciclo ficam todas atras do AuthGuard, e a conta de teste
 * entra por link magico (sem senha). Em vez de materializar credencial para
 * abrir o painel, esta pagina monta os componentes REAIS com dados de exemplo,
 * dentro do app — entao vale o mesmo CSS, o mesmo tema e a mesma CSP.
 *
 * O que ela NAO prova: o caminho de dados autenticado (isso e a varredura de
 * acessos) nem o conteudo de paciente real.
 *
 * Em producao responde 404: `notFound()` quando NODE_ENV !== 'development'.
 */

import { notFound } from 'next/navigation';
import { useState } from 'react';
import { SeletorGastoEnergetico } from '@/components/SeletorGastoEnergetico';
import { SeletorMedidaCaseira } from '@/components/SeletorMedidaCaseira';
import { ItemDeAlimento, type FoodResult } from '@/components/FoodAutocomplete';
import { distribuicaoMacros } from '@/lib/distribuicao-macros';

const MEDIDAS = [
  { medida: 'colher de sopa', gramas: 25, padrao: true },
  { medida: 'colher de sopa cheia', gramas: 35, padrao: false },
  { medida: 'unidade media', gramas: 120, padrao: false },
  { medida: 'escumadeira', gramas: 80, padrao: false },
];

/**
 * Nomes REAIS da base, os mesmos que a nutricionista viu truncados como
 * "OVO ..." em 28/10/2026. A largura do cartao da refeicao esta reproduzida
 * abaixo: e nela que a linha precisa ser legivel.
 */
const ALIMENTOS: FoodResult[] = [
  'OVO DE GALINHA, cozido(a)',
  'OVO DE GALINHA, frito(a)',
  'OVO DE GALINHA, pochê',
  'OVOMALTINE',
  'PARTE DE GALINHA OU FRANGO NAO ESPECIFICADA, empanado(a)/a milanesa',
  'CARNE (NAO ESPECIFICADA), desfiado(a)',
].map((nome, i) => ({
  id: String(i), nome, grupoAlimentar: null, porcaoPadraoG: 100,
  energiaKcal: 155, proteinasG: 12.58, carboidratosG: 1.12, lipidiosG: 10.61,
  sodioMg: null, fibrasG: null, fonte: 'ibge_pof', fonteVersao: null,
  confiabilidade: 'alta',
}));

export default function Bancada() {
  if (process.env.NODE_ENV !== 'development') notFound();

  const [gasto, setGasto] = useState<unknown>(null);
  const [gramas, setGramas] = useState('100');
  const [medida, setMedida] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Bancada de verificacao</h1>
        <p className="text-sm text-muted-foreground">
          Componentes reais, dados de exemplo. Nao existe em producao.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Gasto energetico</h2>
        <SeletorGastoEnergetico
          pesoKg={68}
          alturaCm={165}
          idade={34}
          sexo="female"
          mlgKg={48}
          onChange={setGasto}
        />
        <pre
          data-teste="resultado-gasto"
          className="overflow-x-auto rounded bg-muted p-3 text-xs"
        >
          {JSON.stringify(gasto, null, 2)}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Medida caseira</h2>
        <SeletorMedidaCaseira
          medidas={MEDIDAS}
          valorG={gramas}
          onChangeG={setGramas}
          onChangeMedida={setMedida}
        />
        <p data-teste="resultado-medida" className="text-sm">
          gramas gravadas: <strong>{gramas}</strong> · medida escolhida:{' '}
          <strong>{medida ?? '(em gramas)'}</strong>
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Lista de alimentos (largura do cartao)</h2>
        <p className="text-sm text-muted-foreground">
          A caixa cinza tem a largura de um cartao de refeicao. A linha precisa
          ser legivel DENTRO dela.
        </p>
        <div className="w-[250px] rounded border border-dashed p-2">
          <div
            data-teste="lista-alimentos"
            className="rounded-lg border bg-white dark:bg-gray-900 shadow-xl min-w-[20rem] max-w-[min(34rem,88vw)]"
          >
            {ALIMENTOS.map((a) => (
              <div
                key={a.id}
                className="px-3 py-2 border-b last:border-0 border-gray-100 dark:border-gray-800"
              >
                <ItemDeAlimento alimento={a} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Distribuicao dos macros</h2>
        <p className="text-sm text-muted-foreground">
          Os tres somam 100 por construcao. Refeicao sem macro devolve null,
          nao 0%.
        </p>
        <pre data-teste="distribuicao" className="overflow-x-auto rounded bg-muted p-3 text-xs">
{JSON.stringify({
  almoco: distribuicaoMacros({ kcal: 760, proteinasG: 30, carboidratosG: 100, lipidiosG: 25 }),
  vazia: distribuicaoMacros({ kcal: 0 }),
  soProteina: distribuicaoMacros({ proteinasG: 40 }),
}, null, 1)}
        </pre>
      </section>

    </main>
  );
}
