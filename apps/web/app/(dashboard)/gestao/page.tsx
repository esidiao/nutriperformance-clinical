'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Loader2, AlertTriangle, Users, UserMinus, CalendarX2, Clock, NotebookPen,
  Target, Wallet, Bell, Info,
} from 'lucide-react';
import { api, falhou, ApiError, type IndicadoresDeGestao } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { brl } from '@/lib/moeda';

// ============================================================================
// Indicadores de gestão
// ----------------------------------------------------------------------------
// Esta tela tem uma regra que vale mais que o layout: NÚMERO SEM BASE NÃO
// APARECE COMO ZERO.
//
// A API devolve `null` quando não há denominador — nenhuma consulta no período,
// nenhuma meta cadastrada, nada vencido ainda. Escrever "0,0%" nesses casos
// seria a tela mentindo com o dado certo na mão: quem lê não tem como
// distinguir "ninguém faltou" de "não houve consulta".
//
// Por isso `Percentual` existe, e por isso ele recebe `base`: o texto que
// explica POR QUE não há número. Sem esse texto, um travessão na tela é só
// confusão.
//
// A segunda regra: cada indicador diz como é calculado, ali, visível. Número de
// gestão sem definição é convite a decisão errada — "taxa de falta" conta
// cancelamento ou não? Quem olha precisa saber sem perguntar.
// ============================================================================

/**
 * Vermelho de alerta: um nome local para o token, em qualquer tamanho.
 *
 * Aqui havia um par explícito (`text-red-700 dark:text-red-400`) porque
 * `text-destructive` reprovava contraste: #EF4343 dava 3,78:1 sobre branco e
 * #962C2C dava 2,28:1 no escuro — vermelho escuro sobre fundo escuro.
 *
 * O token foi consertado (globals.css: `--danger`, medido contra os três
 * fundos de cada tema, pior caso 4,54:1), então o par explícito deixou de ter
 * razão de existir: duas fontes de verdade para a mesma cor divergem.
 */
// Par explicito criado aqui porque `text-destructive` reprovava contraste nos
// dois temas. Agora existe token para isso (globals.css: --danger), medido
// contra os tres fundos de cada tema — uma fonte de verdade em vez de duas.
const VERMELHO = 'text-danger';

const JANELAS = [
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
  { dias: 180, rotulo: '6 meses' },
  { dias: 365, rotulo: '12 meses' },
];

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </span>
  );
}

/**
 * Travessão de "não há base para calcular".
 *
 * `gray-500`, não `gray-400`: medido no navegador, `gray-400` sobre branco dá
 * 2,54:1 e o mínimo para texto grande é 3:1. O travessão carrega informação —
 * é o que diz que o indicador não existe — então não vale como enfeite.
 */
function SemBase({ motivo }: { motivo: string }) {
  return (
    <span className="block">
      <span
        className="text-2xl font-semibold text-gray-500 dark:text-gray-400"
        aria-hidden="true"
      >
        —
      </span>
      <span className="sr-only">sem base para calcular</span>
      <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{motivo}</span>
    </span>
  );
}

/**
 * Vermelho para texto PEQUENO.
 *
 * Existia porque o token antigo só passava em texto grande (3:1) e reprovava
 * em texto normal (4,5:1), então o aviso de 12px precisava de cor própria.
 * O token novo é medido para 4,5:1 em qualquer tamanho, e este componente
 * sobrou só para o tamanho — a cor é a mesma.
 */
function VermelhoPequeno({ children }: { children: React.ReactNode }) {
  return <span className={`text-xs ${VERMELHO}`}>{children}</span>;
}

/** Explicação de como o número é obtido. Fica sempre visível, não em tooltip. */
function Como({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex gap-1.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
      <Info className="h-3 w-3 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Percentual que pode não existir.
 *
 * `base` é obrigatório de propósito: um travessão sem motivo faz a pessoa
 * achar que a tela quebrou. Com o motivo, ela entende que o dado é que não
 * existe — e isso muitas vezes é a informação mais útil do cartão.
 */
function Percentual({
  valor,
  base,
  alerta = false,
}: {
  valor: number | null;
  base: string;
  alerta?: boolean;
}) {
  if (valor === null) {
    return <SemBase motivo={base} />;
  }
  return (
    <span
      className={`text-2xl font-semibold tabular-nums ${
        alerta && valor > 0 ? VERMELHO : 'text-gray-900 dark:text-white'
      }`}
    >
      {valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  );
}

function Numero({ valor, alerta = false }: { valor: number; alerta?: boolean }) {
  return (
    <span
      className={`text-2xl font-semibold tabular-nums ${
        alerta && valor > 0 ? VERMELHO : 'text-gray-900 dark:text-white'
      }`}
    >
      {valor.toLocaleString('pt-BR')}
    </span>
  );
}

/** Cartão de indicador que a API não conseguiu calcular. Alto e claro. */
function CartaoFalho({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="py-4 px-5">
        <Rotulo>{titulo}</Rotulo>
        {/* `text-red-700`, não `text-danger`: 14px é texto normal e exige
            4,5:1, que o token não alcança sobre branco. Ver `VermelhoPequeno`. */}
        <p className={`mt-2 flex items-start gap-2 text-sm ${VERMELHO}`}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{mensagem}</span>
        </p>
        <Como>
          Este indicador falhou; os outros seguem válidos. O erro foi registrado no log da API.
        </Como>
      </CardContent>
    </Card>
  );
}

function Bloco({
  icone: Icone,
  titulo,
  children,
}: {
  icone: typeof Users;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <Icone className="h-4 w-4 text-gray-400" aria-hidden="true" />
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default function GestaoPage() {
  const [dias, setDias] = useState(90);

  const q = useQuery<IndicadoresDeGestao>({
    queryKey: ['indicadoresGestao', dias],
    queryFn: () => api.management.indicators({ dias }),
  });

  const d = q.data;

  return (
    <>
      <PageHeader
        title="Indicadores de gestão"
        description="O que diz se a clínica vai bem — não quanto ela tem cadastrado"
        breadcrumbs={[{ label: 'Gestão' }, { label: 'Indicadores' }]}
      />

      <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
        {/* Janela */}
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="janela"
            className="text-xs font-medium text-gray-600 dark:text-gray-300"
          >
            Período
          </label>
          <select
            id="janela"
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="h-9 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm"
          >
            {JANELAS.map((j) => (
              <option key={j.dias} value={j.dias}>
                {j.rotulo}
              </option>
            ))}
          </select>
          {q.isFetching && (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-label="Carregando" />
          )}
        </div>

        {q.isLoading && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" aria-hidden="true" />
              Calculando indicadores…
            </CardContent>
          </Card>
        )}

        {q.isError && (
          <Card className="border-destructive/40">
            <CardContent className="py-6">
              <p className={`flex items-start gap-2 text-sm ${VERMELHO}`}>
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {/* 404 aqui nao e "tente de novo": e a API no ar sendo mais
                    antiga que esta tela, porque front e API sobem separados e
                    a mao. Dizer "pode estar hibernando" manda recarregar para
                    sempre, com a causa escondida. */}
                {q.error instanceof ApiError && q.error.status === 404
                  ? 'Esta tela precisa de um recurso que a API no ar ainda não tem. Recarregar não resolve: a API precisa ser implantada.'
                  : 'Não foi possível carregar os indicadores. A API pode estar hibernando — tente de novo em alguns segundos.'}
              </p>
            </CardContent>
          </Card>
        )}

        {d && (
          <>
            {/* ── Pacientes e abandono ─────────────────────────────────── */}
            <Bloco icone={Users} titulo="Carteira de pacientes">
              {falhou(d.pacientes) ? (
                <CartaoFalho titulo="Pacientes" mensagem={d.pacientes.mensagem} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Ativos</Rotulo>
                      <p className="mt-1">
                        <Numero valor={d.pacientes.ativos} />
                      </p>
                      <Como>De {d.pacientes.total} cadastrados no total.</Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Novos no período</Rotulo>
                      <p className="mt-1">
                        <Numero valor={d.pacientes.novosNoPeriodo} />
                      </p>
                      <Como>Cadastrados nos últimos {d.periodo.dias} dias.</Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>
                        <span className="inline-flex items-center gap-1">
                          <UserMinus className="h-3 w-3" aria-hidden="true" /> Em abandono
                        </span>
                      </Rotulo>
                      <p className="mt-1">
                        <Numero valor={d.pacientes.emAbandono} alerta />
                      </p>
                      <Como>
                        Ativo, já atendido, <strong>sem consulta futura marcada</strong> e sem
                        comparecer há mais de {d.periodo.diasAbandono} dias. Quem tem retorno
                        agendado não entra.
                      </Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Nunca atendidos</Rotulo>
                      <p className="mt-1">
                        <Numero valor={d.pacientes.nuncaAtendidos} alerta />
                      </p>
                      <Como>
                        Cadastro feito, nenhuma consulta realizada e nenhuma marcada. É outro
                        problema que o abandono — por isso está separado.
                      </Como>
                    </CardContent>
                  </Card>
                </div>
              )}
            </Bloco>

            {/* ── Consultas ────────────────────────────────────────────── */}
            <Bloco icone={CalendarX2} titulo="Consultas no período">
              {falhou(d.consultas) ? (
                <CartaoFalho titulo="Consultas" mensagem={d.consultas.mensagem} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Taxa de falta</Rotulo>
                      <p className="mt-1">
                        <Percentual
                          valor={d.consultas.taxaFaltaPct}
                          base={`nenhuma consulta com desfecho nos últimos ${d.periodo.dias} dias`}
                          alerta
                        />
                      </p>
                      <Como>
                        Faltas sobre faltas + realizadas.{' '}
                        <strong>Cancelamento não conta como falta</strong> — remarcar com aviso é
                        outra coisa, e está no número ao lado.
                      </Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Realizadas</Rotulo>
                      <p className="mt-1">
                        <Numero valor={d.consultas.realizadas} />
                      </p>
                      <Como>{d.consultas.faltas} falta(s) no mesmo período.</Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Canceladas</Rotulo>
                      <p className="mt-1">
                        <Numero valor={d.consultas.canceladas} />
                      </p>
                      <Como>Fora do cálculo da taxa de falta, de propósito.</Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Sem desfecho</Rotulo>
                      <p className="mt-1">
                        <Numero valor={d.consultas.semDesfecho} alerta />
                      </p>
                      <Como>
                        A hora já passou e ninguém marcou como realizada, falta ou cancelada. Com
                        este número alto, a taxa de falta acima está medindo menos do que
                        aconteceu.
                      </Como>
                    </CardContent>
                  </Card>
                </div>
              )}
            </Bloco>

            {/* ── Do cadastro ao plano ─────────────────────────────────── */}
            <Bloco icone={Clock} titulo="Do cadastro ao primeiro plano">
              {falhou(d.primeiroPlano) ? (
                <CartaoFalho titulo="Primeiro plano" mensagem={d.primeiroPlano.mensagem} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Mediana</Rotulo>
                      <p className="mt-1">
                        {d.primeiroPlano.medianaDias === null ? (
                          <SemBase motivo="nenhum paciente tem plano publicado" />
                        ) : (
                          <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
                            {d.primeiroPlano.medianaDias.toLocaleString('pt-BR', {
                              maximumFractionDigits: 1,
                            })}{' '}
                            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">dias</span>
                          </span>
                        )}
                      </p>
                      <Como>
                        Mediana e não média: um paciente de dois anos atrás distorceria a média.
                        Conta só plano publicado — rascunho e modelo ficam fora.
                      </Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Com plano</Rotulo>
                      <p className="mt-1">
                        <Numero valor={d.primeiroPlano.comPlano} />
                      </p>
                      <Como>Pacientes que já receberam ao menos um plano publicado.</Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Sem plano nenhum</Rotulo>
                      <p className="mt-1">
                        <Numero valor={d.primeiroPlano.semPlano} alerta />
                      </p>
                      <Como>
                        Sem este número, a mediana ao lado enganaria: ela só fala de quem recebeu
                        plano.
                      </Como>
                    </CardContent>
                  </Card>
                </div>
              )}
            </Bloco>

            {/* ── Diário alimentar ─────────────────────────────────────── */}
            <Bloco icone={NotebookPen} titulo="Diário alimentar">
              {falhou(d.diario) ? (
                <CartaoFalho titulo="Diário alimentar" mensagem={d.diario.mensagem} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Uso do link</Rotulo>
                      <p className="mt-1">
                        <Percentual
                          valor={d.diario.usoDoLinkPct}
                          base="nenhum paciente com link ativo"
                        />
                      </p>
                      <Como>
                        Dos {d.diario.pacientesComLinkAtivo} com link ativo,{' '}
                        {d.diario.pacientesComRegistro} registraram algo no período.
                      </Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Registros</Rotulo>
                      <p className="mt-1">
                        <Numero valor={d.diario.registrosNoPeriodo} />
                      </p>
                      <Como>Refeições registradas nos últimos {d.periodo.dias} dias.</Como>
                    </CardContent>
                  </Card>

                  <Card className="border-dashed">
                    <CardContent className="py-4 px-5">
                      <Rotulo>Adesão ao plano</Rotulo>
                      <p className="mt-1">
                        <span
                          className="text-2xl font-semibold text-gray-500 dark:text-gray-400"
                          aria-hidden="true"
                        >
                          —
                        </span>
                        <span className="sr-only">não medido</span>
                      </p>
                      <Como>
                        <strong>Não medido, e não é esquecimento.</strong> Comparar o que foi comido
                        com o que foi prescrito exigiria casar alimento do diário (texto livre e
                        foto) com item do plano. Casar por nome produz número confiável na
                        aparência e errado no conteúdo. O que está medido ao lado é engajamento.
                      </Como>
                    </CardContent>
                  </Card>
                </div>
              )}
            </Bloco>

            {/* ── Metas ────────────────────────────────────────────────── */}
            <Bloco icone={Target} titulo="Evolução, pelas metas">
              {falhou(d.metas) ? (
                <CartaoFalho titulo="Metas" mensagem={d.metas.mensagem} />
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardContent className="py-4 px-5">
                        <Rotulo>Atingimento</Rotulo>
                        <p className="mt-1">
                          <Percentual
                            valor={d.metas.taxaAtingimentoPct}
                            base="nenhuma meta cadastrada"
                          />
                        </p>
                        <Como>
                          {d.metas.atingidas} de {d.metas.total} metas atingidas.
                        </Como>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="py-4 px-5">
                        <Rotulo>Abertas</Rotulo>
                        <p className="mt-1">
                          <Numero valor={d.metas.abertas} />
                        </p>
                        <Como>Dentro do prazo ou sem prazo definido.</Como>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="py-4 px-5">
                        <Rotulo>Vencidas</Rotulo>
                        <p className="mt-1">
                          <Numero valor={d.metas.vencidas} alerta />
                        </p>
                        <Como>
                          Prazo passou e não foram atingidas. É o número que cobra ação.{' '}
                          <Link href="/goals" className="underline hover:text-primary">
                            Abrir metas
                          </Link>
                        </Como>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="py-4 px-5">
                        <Rotulo>Total</Rotulo>
                        <p className="mt-1">
                          <Numero valor={d.metas.total} />
                        </p>
                        <Como>Metas cadastradas, de todos os períodos.</Como>
                      </CardContent>
                    </Card>
                  </div>
                  <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                    A evolução agregada vem das metas, não da antropometria. Dizer &ldquo;quantos
                    melhoraram&rdquo; a partir de peso e percentual de gordura exigiria saber para
                    que lado é melhorar, e isso muda por paciente — perder peso e ganhar massa
                    movem a mesma coluna em direções opostas. A meta já guarda essa direção.
                  </p>
                </>
              )}
            </Bloco>

            {/* ── Financeiro ───────────────────────────────────────────── */}
            <Bloco icone={Wallet} titulo="Recebimento e inadimplência">
              {falhou(d.financeiro) ? (
                <CartaoFalho titulo="Financeiro" mensagem={d.financeiro.mensagem} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Recebido no período</Rotulo>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
                        {brl(d.financeiro.recebidoNoPeriodoCentavos)}
                      </p>
                      <Como>Pelo que foi marcado como pago nos últimos {d.periodo.dias} dias.</Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Inadimplência</Rotulo>
                      <p className="mt-1">
                        <Percentual
                          valor={d.financeiro.inadimplenciaPct}
                          base="nenhuma cobrança venceu ainda"
                          alerta
                        />
                      </p>
                      <Como>
                        Vencido sobre tudo que <strong>já venceu</strong>. O que ainda vai vencer
                        fica fora — senão emitir cobrança nova &ldquo;melhoraria&rdquo; o indicador
                        sem ninguém pagar nada.
                      </Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Vencido</Rotulo>
                      <p
                        className={`mt-1 text-2xl font-semibold tabular-nums ${
                          d.financeiro.vencidoCentavos > 0
                            ? VERMELHO
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {brl(d.financeiro.vencidoCentavos)}
                      </p>
                      <Como>
                        {d.financeiro.cobrancasVencidas} cobrança(s).{' '}
                        <Link href="/financeiro" className="underline hover:text-primary">
                          Abrir financeiro
                        </Link>
                      </Como>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-4 px-5">
                      <Rotulo>Ticket médio</Rotulo>
                      <p className="mt-1">
                        {d.financeiro.ticketMedioCentavos === null ? (
                          <SemBase motivo="nenhuma cobrança recebida no período" />
                        ) : (
                          <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
                            {brl(d.financeiro.ticketMedioCentavos)}
                          </span>
                        )}
                      </p>
                      <Como>
                        Recebido dividido pelo número de cobranças pagas no período. A receber:{' '}
                        {brl(d.financeiro.aVencerCentavos)}.
                      </Como>
                    </CardContent>
                  </Card>
                </div>
              )}
            </Bloco>

            {/* ── Alertas clínicos ─────────────────────────────────────── */}
            <Bloco icone={Bell} titulo="Alertas clínicos por categoria">
              {falhou(d.alertas) ? (
                <CartaoFalho titulo="Alertas" mensagem={d.alertas.mensagem} />
              ) : d.alertas.categorias.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-gray-500 dark:text-gray-400">
                    Nenhum alerta clínico nos últimos {d.periodo.dias} dias.
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-2 px-0">
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                      {d.alertas.categorias.map((c) => {
                        const maior = Math.max(...(d.alertas as { categorias: Array<{ total: number }> }).categorias.map((x) => x.total));
                        return (
                          <li
                            key={c.categoria}
                            className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
                          >
                            <span className="text-sm font-medium min-w-[9rem]">{c.categoria}</span>
                            <span
                              className="h-2 rounded-full bg-primary/70 flex-shrink-0"
                              style={{ width: `${Math.max(6, (c.total / maior) * 160)}px` }}
                              aria-hidden="true"
                            />
                            <span className="text-sm tabular-nums">{c.total}</span>
                            {c.pendentes > 0 && (
                              <VermelhoPequeno>{c.pendentes} pendente(s)</VermelhoPequeno>
                            )}
                            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                              {c.medianaHorasResolucao === null
                                ? 'nenhum resolvido ainda'
                                : `mediana de ${c.medianaHorasResolucao.toLocaleString('pt-BR', {
                                    maximumFractionDigits: 1,
                                  })} h para resolver`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </Bloco>

            <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 pt-4">
              Um travessão (—) significa que <strong>não há base para calcular</strong>, e nunca
              zero. &ldquo;0,0% de falta&rdquo; numa clínica sem consulta no período seria o painel
              mentindo com o dado certo na mão. Todos os números vêm do banco deste workspace, sem
              estimativa e sem projeção.
            </p>
          </>
        )}
      </div>
    </>
  );
}
