import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// ============================================================================
// Indicadores de gestão da clínica
// ----------------------------------------------------------------------------
// O painel que já existia respondia "quanto tem" e "quanto consumiu":
// contagem de pacientes, alertas pendentes, saldo de token, uso por módulo.
// São números de ESTOQUE e de consumo de plataforma. Nenhum deles diz se a
// clínica vai bem.
//
// Estes dizem. Todos saem de tabela que já existia — nada de coluna nova,
// nada de gravação: é consulta e tela.
//
// ── A regra que governa este arquivo ────────────────────────────────────────
//
// O MRR foi REMOVIDO deste produto um dia, com o comentário de que calcular
// receita sobre preço que ninguém cobra seria "número inventado num painel de
// gestão — pior que número nenhum", e `mrrBrl` devolve `null`, não `0`.
//
// Essa disciplina é o que torna o painel confiável, e ela vale aqui inteira:
//
//   • denominador zero devolve `null`, nunca `0`. "0% de falta" quando não
//     houve consulta nenhuma é mentira; `null` é a verdade, e a tela escreve
//     "sem base para calcular".
//   • o que não dá para medir com o que está no banco NÃO é estimado. Está
//     dito abaixo, caso por caso, o que ficou de fora e por quê.
//   • cada indicador é isolado: se a consulta de um falhar, aquele cartão diz
//     que falhou, em vez de derrubar o painel inteiro — e o erro vai para o
//     log, para não virar silêncio.
// ============================================================================

/** Um indicador que não pôde ser calculado. A tela mostra isto, não zero. */
export interface IndicadorFalho {
  erro: true;
  mensagem: string;
}

export interface BlocoPacientes {
  total: number;
  ativos: number;
  novosNoPeriodo: number;
  /**
   * Paciente ativo, com consulta já realizada, sem nenhuma consulta futura
   * marcada e cuja última consulta realizada é mais antiga que o corte.
   *
   * As três condições são necessárias. Sem "sem consulta futura", quem já tem
   * retorno agendado apareceria como perdido. Sem "com consulta realizada",
   * quem acabou de ser cadastrado entraria no mesmo balde — e esse é outro
   * problema, contado em `nuncaAtendidos`.
   */
  emAbandono: number;
  /** Ativo, nenhuma consulta realizada, nenhuma marcada: cadastro que parou aí. */
  nuncaAtendidos: number;
}

export interface BlocoConsultas {
  realizadas: number;
  faltas: number;
  canceladas: number;
  /** Já passou da hora e ninguém deu desfecho — mede disciplina de registro. */
  semDesfecho: number;
  /**
   * `faltas / (realizadas + faltas)`.
   *
   * Cancelada fica FORA do denominador de propósito: cancelamento com aviso
   * não é falta, e somar os dois faria a clínica que remarca bem parecer pior
   * que a que é abandonada na hora. As canceladas estão no número ao lado.
   */
  taxaFaltaPct: number | null;
}

export interface BlocoPrimeiroPlano {
  comPlano: number;
  semPlano: number;
  /** Mediana, não média: um paciente de dois anos atrás distorce a média. */
  medianaDias: number | null;
}

export interface BlocoDiario {
  registrosNoPeriodo: number;
  pacientesComRegistro: number;
  pacientesComLinkAtivo: number;
  /** `pacientesComRegistro / pacientesComLinkAtivo` — quem recebeu, usou? */
  usoDoLinkPct: number | null;
  /**
   * Adesão de verdade — o que foi comido contra o que foi prescrito — NÃO está
   * aqui, e não é esquecimento.
   *
   * Exigiria casar alimento do diário com item do plano, e o diário é texto
   * livre mais foto (`food_diary_entries.descricao`, `foto_path`). Casar isso
   * por nome é o erro que já custou caro neste portfólio: prefixo sem limite
   * engole palavra, "SAL" pega "SALSICHA". Um número de adesão construído
   * assim seria confiável na aparência e errado no conteúdo — exatamente o que
   * a regra deste arquivo proíbe.
   *
   * O que está medido é ENGAJAMENTO: o paciente está registrando? Isso o banco
   * responde sem inventar nada.
   */
  adesaoAoPlanoPct: null;
}

export interface BlocoMetas {
  total: number;
  atingidas: number;
  abertas: number;
  /** Prazo passou e não foi atingida. É o número que cobra ação. */
  vencidas: number;
  taxaAtingimentoPct: number | null;
}

export interface BlocoFinanceiro {
  recebidoNoPeriodoCentavos: number;
  aVencerCentavos: number;
  vencidoCentavos: number;
  cobrancasVencidas: number;
  /**
   * `vencido / (tudo que já venceu, pago ou não)`.
   *
   * Só entra cobrança cujo vencimento JÁ passou. Incluir o que ainda vai
   * vencer faria a inadimplência cair sozinha a cada cobrança nova emitida.
   */
  inadimplenciaPct: number | null;
  ticketMedioCentavos: number | null;
}

export interface BlocoAlertas {
  categorias: Array<{
    categoria: string;
    total: number;
    pendentes: number;
    medianaHorasResolucao: number | null;
  }>;
}

export interface IndicadoresDeGestao {
  periodo: {
    dias: number;
    diasAbandono: number;
    de: string;
    ate: string;
  };
  pacientes: BlocoPacientes | IndicadorFalho;
  consultas: BlocoConsultas | IndicadorFalho;
  primeiroPlano: BlocoPrimeiroPlano | IndicadorFalho;
  diario: BlocoDiario | IndicadorFalho;
  metas: BlocoMetas | IndicadorFalho;
  financeiro: BlocoFinanceiro | IndicadorFalho;
  alertas: BlocoAlertas | IndicadorFalho;
}

const DIAS_PADRAO = 90;
const DIAS_MIN = 7;
const DIAS_MAX = 365;
const DIAS_ABANDONO_PADRAO = 90;

@Injectable()
export class ManagementService {
  private readonly log = new Logger(ManagementService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Percentual com UMA casa, ou `null` quando não há denominador.
   *
   * O `null` é o ponto do método. `pct(0, 0)` devolvendo `0` colocaria "0,0%"
   * na tela de uma clínica que simplesmente não teve consulta no período — e
   * quem lê não tem como distinguir isso de "ninguém faltou".
   */
  private pct(numerador: number, denominador: number): number | null {
    if (!denominador || denominador <= 0) return null;
    return Math.round((numerador / denominador) * 1000) / 10;
  }

  private inteiro(v: unknown): number {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? '0'), 10);
    return Number.isFinite(n) ? n : 0;
  }

  /** Numérico que PODE ser nulo (mediana sem amostra). Nunca converte null em 0. */
  private decimalOuNulo(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 10) / 10;
  }

  /**
   * Roda uma consulta isolada. Se ela falhar, o painel continua de pé e o
   * cartão daquele indicador diz que falhou.
   *
   * Engolir o erro em silêncio seria pior que o erro: o cartão mostraria zero
   * e ninguém investigaria. Por isso vai para o log com o nome do bloco.
   */
  private async bloco<T>(nome: string, fn: () => Promise<T>): Promise<T | IndicadorFalho> {
    try {
      return await fn();
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      this.log.error(`indicador "${nome}" falhou: ${mensagem}`);
      return { erro: true, mensagem: `não foi possível calcular (${nome})` };
    }
  }

  async indicadores(
    workspaceId: string,
    opcoes?: { dias?: number; diasAbandono?: number },
  ): Promise<IndicadoresDeGestao> {
    const dias = this.limitar(opcoes?.dias, DIAS_PADRAO);
    const diasAbandono = this.limitar(opcoes?.diasAbandono, DIAS_ABANDONO_PADRAO);

    const ate = new Date();
    const de = new Date(ate.getTime() - dias * 86400_000);

    const [pacientes, consultas, primeiroPlano, diario, metas, financeiro, alertas] =
      await Promise.all([
        this.bloco('pacientes', () => this.pacientes(workspaceId, dias, diasAbandono)),
        this.bloco('consultas', () => this.consultas(workspaceId, dias)),
        this.bloco('primeiro plano', () => this.primeiroPlano(workspaceId)),
        this.bloco('diário alimentar', () => this.diario(workspaceId, dias)),
        this.bloco('metas', () => this.metas(workspaceId)),
        this.bloco('financeiro', () => this.financeiro(workspaceId, dias)),
        this.bloco('alertas', () => this.alertas(workspaceId, dias)),
      ]);

    return {
      periodo: {
        dias,
        diasAbandono,
        de: de.toISOString(),
        ate: ate.toISOString(),
      },
      pacientes,
      consultas,
      primeiroPlano,
      diario,
      metas,
      financeiro,
      alertas,
    };
  }

  private limitar(valor: number | undefined, padrao: number): number {
    if (valor === undefined || valor === null || !Number.isFinite(valor)) return padrao;
    return Math.min(DIAS_MAX, Math.max(DIAS_MIN, Math.trunc(valor)));
  }

  // ── Pacientes e abandono ───────────────────────────────────────────────────
  private async pacientes(
    workspaceId: string,
    dias: number,
    diasAbandono: number,
  ): Promise<BlocoPacientes> {
    const [l] = await this.db.query(
      `WITH base AS (
         SELECT p.id, p.created_at, p.is_active,
                (SELECT max(a.inicio) FROM appointments a
                  WHERE a.patient_id = p.id
                    AND a.workspace_id = p.workspace_id
                    AND a.status = 'realizada') AS ultima_realizada,
                (SELECT count(*) FROM appointments a
                  WHERE a.patient_id = p.id
                    AND a.workspace_id = p.workspace_id
                    AND a.inicio > now()
                    AND a.status IN ('agendada', 'confirmada')) AS futuras
           FROM patients p
          WHERE p.workspace_id = $1
       )
       SELECT count(*)::int AS total,
              count(*) FILTER (WHERE is_active)::int AS ativos,
              count(*) FILTER (
                WHERE created_at >= now() - make_interval(days => $2::int)
              )::int AS novos,
              count(*) FILTER (
                WHERE is_active
                  AND futuras = 0
                  AND ultima_realizada IS NOT NULL
                  AND ultima_realizada < now() - make_interval(days => $3::int)
              )::int AS em_abandono,
              count(*) FILTER (
                WHERE is_active AND ultima_realizada IS NULL AND futuras = 0
              )::int AS nunca_atendidos
         FROM base`,
      [workspaceId, dias, diasAbandono],
    );

    return {
      total: this.inteiro(l?.total),
      ativos: this.inteiro(l?.ativos),
      novosNoPeriodo: this.inteiro(l?.novos),
      emAbandono: this.inteiro(l?.em_abandono),
      nuncaAtendidos: this.inteiro(l?.nunca_atendidos),
    };
  }

  // ── Consultas e taxa de falta ──────────────────────────────────────────────
  private async consultas(workspaceId: string, dias: number): Promise<BlocoConsultas> {
    const [l] = await this.db.query(
      `SELECT count(*) FILTER (WHERE status = 'realizada')::int AS realizadas,
              count(*) FILTER (WHERE status = 'faltou')::int AS faltas,
              count(*) FILTER (WHERE status = 'cancelada')::int AS canceladas,
              count(*) FILTER (WHERE status IN ('agendada', 'confirmada'))::int AS sem_desfecho
         FROM appointments
        WHERE workspace_id = $1
          AND inicio >= now() - make_interval(days => $2::int)
          AND inicio < now()`,
      [workspaceId, dias],
    );

    const realizadas = this.inteiro(l?.realizadas);
    const faltas = this.inteiro(l?.faltas);

    return {
      realizadas,
      faltas,
      canceladas: this.inteiro(l?.canceladas),
      semDesfecho: this.inteiro(l?.sem_desfecho),
      taxaFaltaPct: this.pct(faltas, realizadas + faltas),
    };
  }

  // ── Tempo entre cadastro e primeiro plano ─────────────────────────────────
  private async primeiroPlano(workspaceId: string): Promise<BlocoPrimeiroPlano> {
    const [l] = await this.db.query(
      `WITH por_paciente AS (
         SELECT p.id,
                p.created_at AS cadastro,
                min(mp.created_at) AS primeiro_plano
           FROM patients p
           LEFT JOIN meal_plans mp
             ON mp.patient_id = p.id
            AND mp.workspace_id = p.workspace_id
            AND mp.is_template = false
            AND mp.is_draft = false
          WHERE p.workspace_id = $1
          GROUP BY p.id, p.created_at
       )
       SELECT count(*) FILTER (WHERE primeiro_plano IS NOT NULL)::int AS com_plano,
              count(*) FILTER (WHERE primeiro_plano IS NULL)::int AS sem_plano,
              percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (primeiro_plano - cadastro)) / 86400.0
              ) AS mediana_dias
         FROM por_paciente`,
      [workspaceId],
    );

    return {
      comPlano: this.inteiro(l?.com_plano),
      semPlano: this.inteiro(l?.sem_plano),
      medianaDias: this.decimalOuNulo(l?.mediana_dias),
    };
  }

  // ── Diário alimentar: engajamento, não adesão ─────────────────────────────
  private async diario(workspaceId: string, dias: number): Promise<BlocoDiario> {
    const [l] = await this.db.query(
      `SELECT (SELECT count(DISTINCT patient_id) FROM food_diary_entries
                 WHERE workspace_id = $1
                   AND tomada_em >= now() - make_interval(days => $2::int))::int AS pacientes_com_registro,
              (SELECT count(*) FROM food_diary_entries
                 WHERE workspace_id = $1
                   AND tomada_em >= now() - make_interval(days => $2::int))::int AS registros,
              (SELECT count(DISTINCT patient_id) FROM food_diary_links
                 WHERE workspace_id = $1
                   AND status = 'ativo'
                   AND expira_em > now())::int AS pacientes_com_link_ativo`,
      [workspaceId, dias],
    );

    const comRegistro = this.inteiro(l?.pacientes_com_registro);
    const comLink = this.inteiro(l?.pacientes_com_link_ativo);

    return {
      registrosNoPeriodo: this.inteiro(l?.registros),
      pacientesComRegistro: comRegistro,
      pacientesComLinkAtivo: comLink,
      usoDoLinkPct: this.pct(comRegistro, comLink),
      adesaoAoPlanoPct: null,
    };
  }

  // ── Metas: é o que diz se o paciente está evoluindo ───────────────────────
  //
  // A série de `physical_assessments` dá a evolução INDIVIDUAL, e a ficha já
  // mostra. Agregar "quantos melhoraram" exigiria saber para que lado é
  // melhorar, e isso depende do objetivo de cada um — perder peso e ganhar
  // massa movem a mesma coluna em direções opostas.
  //
  // `patient_goals` já guarda essa direção: tem valor de partida, valor alvo,
  // prazo e marca de atingida. Então o número honesto de evolução sai daqui, e
  // não de inferir intenção a partir de antropometria.
  private async metas(workspaceId: string): Promise<BlocoMetas> {
    const [l] = await this.db.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE is_achieved)::int AS atingidas,
              count(*) FILTER (
                WHERE NOT is_achieved
                  AND (target_date IS NULL OR target_date >= current_date)
              )::int AS abertas,
              count(*) FILTER (
                WHERE NOT is_achieved AND target_date < current_date
              )::int AS vencidas
         FROM patient_goals
        WHERE workspace_id = $1`,
      [workspaceId],
    );

    const total = this.inteiro(l?.total);
    const atingidas = this.inteiro(l?.atingidas);

    return {
      total,
      atingidas,
      abertas: this.inteiro(l?.abertas),
      vencidas: this.inteiro(l?.vencidas),
      taxaAtingimentoPct: this.pct(atingidas, total),
    };
  }

  // ── Financeiro ────────────────────────────────────────────────────────────
  private async financeiro(workspaceId: string, dias: number): Promise<BlocoFinanceiro> {
    const [l] = await this.db.query(
      `SELECT coalesce(sum(valor_pago_centavos) FILTER (
                WHERE status = 'pago'
                  AND pago_em >= now() - make_interval(days => $2::int)
              ), 0)::bigint AS recebido_centavos,
              count(*) FILTER (
                WHERE status = 'pago'
                  AND pago_em >= now() - make_interval(days => $2::int)
              )::int AS cobrancas_pagas,
              coalesce(sum(valor_centavos) FILTER (
                WHERE status = 'pendente' AND vencimento >= current_date
              ), 0)::bigint AS a_vencer_centavos,
              coalesce(sum(valor_centavos) FILTER (
                WHERE status = 'pendente' AND vencimento < current_date
              ), 0)::bigint AS vencido_centavos,
              count(*) FILTER (
                WHERE status = 'pendente' AND vencimento < current_date
              )::int AS cobrancas_vencidas,
              coalesce(sum(valor_centavos) FILTER (
                WHERE vencimento < current_date AND status IN ('pendente', 'pago')
              ), 0)::bigint AS base_vencida_centavos
         FROM charges
        WHERE workspace_id = $1`,
      [workspaceId, dias],
    );

    const recebido = this.inteiro(l?.recebido_centavos);
    const vencido = this.inteiro(l?.vencido_centavos);
    const baseVencida = this.inteiro(l?.base_vencida_centavos);
    const pagas = this.inteiro(l?.cobrancas_pagas);

    return {
      recebidoNoPeriodoCentavos: recebido,
      aVencerCentavos: this.inteiro(l?.a_vencer_centavos),
      vencidoCentavos: vencido,
      cobrancasVencidas: this.inteiro(l?.cobrancas_vencidas),
      inadimplenciaPct: this.pct(vencido, baseVencida),
      // Divisão inteira de propósito: centavos não têm fração.
      ticketMedioCentavos: pagas > 0 ? Math.round(recebido / pagas) : null,
    };
  }

  // ── Alertas clínicos por categoria ────────────────────────────────────────
  private async alertas(workspaceId: string, dias: number): Promise<BlocoAlertas> {
    const linhas: Array<{
      categoria: string;
      total: unknown;
      pendentes: unknown;
      mediana_horas: unknown;
    }> = await this.db.query(
      `SELECT category AS categoria,
              count(*)::int AS total,
              count(*) FILTER (WHERE NOT is_resolved)::int AS pendentes,
              percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0
              ) FILTER (WHERE is_resolved AND resolved_at IS NOT NULL) AS mediana_horas
         FROM clinical_alerts
        WHERE workspace_id = $1
          AND created_at >= now() - make_interval(days => $2::int)
        GROUP BY category
        ORDER BY total DESC, category ASC
        LIMIT 8`,
      [workspaceId, dias],
    );

    return {
      categorias: (linhas ?? []).map((r) => ({
        categoria: r.categoria,
        total: this.inteiro(r.total),
        pendentes: this.inteiro(r.pendentes),
        medianaHorasResolucao: this.decimalOuNulo(r.mediana_horas),
      })),
    };
  }
}
