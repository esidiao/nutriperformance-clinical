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

const MEDIDAS = [
  { medida: 'colher de sopa', gramas: 25, padrao: true },
  { medida: 'colher de sopa cheia', gramas: 35, padrao: false },
  { medida: 'unidade media', gramas: 120, padrao: false },
  { medida: 'escumadeira', gramas: 80, padrao: false },
];

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
    </main>
  );
}
