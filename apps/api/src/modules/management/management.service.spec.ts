import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ManagementService,
  IndicadorFalho,
  BlocoConsultas,
  BlocoFinanceiro,
  BlocoMetas,
  BlocoDiario,
  BlocoPrimeiroPlano,
  BlocoPacientes,
} from './management.service';

// ============================================================================
// O que esta suíte existe para pegar
// ----------------------------------------------------------------------------
// O risco deste serviço não é quebrar — é MENTIR. Um `0` no lugar de um `null`
// não derruba nada, não aparece em log, e coloca "0,0% de falta" na tela de uma
// clínica que não teve consulta nenhuma. Quem lê não tem como saber.
//
// Então quase todo teste aqui é um teste de "devolveu null?". E cada um vem com
// o caso espelhado — o mesmo indicador COM base, calculando certo — porque
// asserção que só confere o nulo passaria num serviço que devolve nulo sempre.
//
// As consultas são SQL cru e aqui elas estão mockadas: isto prova o FORMATO e a
// aritmética, não a sintaxe do SQL. Essa parte se prova contra o banco, com
// `scratchpad/provar-consultas-gestao.mjs`.
// ============================================================================

type Resposta = Record<string, unknown>[];

describe('ManagementService', () => {
  let service: ManagementService;
  let sqlRecebido: Array<{ sql: string; params: unknown[] }>;
  let respostas: Record<string, Resposta | Error>;

  /** Identifica qual dos sete blocos uma consulta é, pelo texto dela. */
  const qual = (sql: string): string => {
    if (sql.includes('em_abandono')) return 'pacientes';
    if (sql.includes('sem_desfecho')) return 'consultas';
    if (sql.includes('por_paciente')) return 'primeiroPlano';
    if (sql.includes('food_diary_entries')) return 'diario';
    if (sql.includes('patient_goals')) return 'metas';
    if (sql.includes('FROM charges')) return 'financeiro';
    if (sql.includes('clinical_alerts')) return 'alertas';
    return 'desconhecido';
  };

  const padroes = (): Record<string, Resposta> => ({
    pacientes: [{ total: 10, ativos: 8, novos: 2, em_abandono: 3, nunca_atendidos: 1 }],
    consultas: [{ realizadas: 40, faltas: 10, canceladas: 5, sem_desfecho: 2 }],
    primeiroPlano: [{ com_plano: 6, sem_plano: 4, mediana_dias: '4.5' }],
    diario: [{ pacientes_com_registro: 3, registros: 57, pacientes_com_link_ativo: 6 }],
    metas: [{ total: 20, atingidas: 5, abertas: 12, vencidas: 3 }],
    financeiro: [
      {
        recebido_centavos: '150000',
        cobrancas_pagas: 10,
        a_vencer_centavos: '40000',
        vencido_centavos: '25000',
        cobrancas_vencidas: 2,
        base_vencida_centavos: '100000',
      },
    ],
    alertas: [
      { categoria: 'interaction', total: 7, pendentes: 3, mediana_horas: '12.5' },
      { categoria: 'lab', total: 2, pendentes: 0, mediana_horas: null },
    ],
  });

  beforeEach(async () => {
    sqlRecebido = [];
    respostas = padroes();

    const mockDataSource = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        sqlRecebido.push({ sql, params });
        const r = respostas[qual(sql)];
        if (r instanceof Error) throw r;
        return r ?? [];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManagementService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ManagementService>(ManagementService);
  });

  // ── Isolamento por workspace ─────────────────────────────────────────────
  it('passa o workspace para TODAS as sete consultas', async () => {
    await service.indicadores('ws-alvo');

    expect(sqlRecebido).toHaveLength(7);
    for (const { sql, params } of sqlRecebido) {
      expect(params[0]).toBe('ws-alvo');
      expect(sql).toContain('workspace_id = $1');
    }
  });

  it('não aceita workspace por outro caminho: o primeiro parâmetro é sempre o recebido', async () => {
    await service.indicadores('ws-a');
    const primeiros = sqlRecebido.map((c) => c.params[0]);
    expect(new Set(primeiros)).toEqual(new Set(['ws-a']));
  });

  // ── Taxa de falta ────────────────────────────────────────────────────────
  it('taxa de falta: calcula sobre realizadas + faltas', async () => {
    const r = await service.indicadores('ws-1');
    const c = r.consultas as BlocoConsultas;
    expect(c.taxaFaltaPct).toBe(20); // 10 / (40 + 10)
  });

  it('taxa de falta: cancelada NÃO entra no denominador', async () => {
    // Mesmas realizadas e faltas, cem canceladas. A taxa não pode se mover:
    // cancelamento com aviso não é falta.
    respostas.consultas = [
      { realizadas: 40, faltas: 10, canceladas: 100, sem_desfecho: 0 },
    ];
    const r = await service.indicadores('ws-1');
    expect((r.consultas as BlocoConsultas).taxaFaltaPct).toBe(20);
  });

  it('taxa de falta: devolve NULL, não 0, quando não houve consulta com desfecho', async () => {
    respostas.consultas = [
      { realizadas: 0, faltas: 0, canceladas: 7, sem_desfecho: 3 },
    ];
    const r = await service.indicadores('ws-1');
    const c = r.consultas as BlocoConsultas;
    expect(c.taxaFaltaPct).toBeNull();
    expect(c.taxaFaltaPct).not.toBe(0);
    // e os números que EXISTEM continuam aparecendo
    expect(c.canceladas).toBe(7);
    expect(c.semDesfecho).toBe(3);
  });

  it('taxa de falta: 0% real é 0, e se distingue de null', async () => {
    respostas.consultas = [
      { realizadas: 30, faltas: 0, canceladas: 0, sem_desfecho: 0 },
    ];
    const r = await service.indicadores('ws-1');
    expect((r.consultas as BlocoConsultas).taxaFaltaPct).toBe(0);
  });

  // ── Primeiro plano ───────────────────────────────────────────────────────
  it('mediana até o primeiro plano: converte e arredonda para uma casa', async () => {
    const r = await service.indicadores('ws-1');
    expect((r.primeiroPlano as BlocoPrimeiroPlano).medianaDias).toBe(4.5);
  });

  it('mediana até o primeiro plano: NULL do banco não vira 0', async () => {
    // Nenhum paciente tem plano: o percentile_cont do Postgres devolve NULL.
    respostas.primeiroPlano = [{ com_plano: 0, sem_plano: 12, mediana_dias: null }];
    const r = await service.indicadores('ws-1');
    const p = r.primeiroPlano as BlocoPrimeiroPlano;
    expect(p.medianaDias).toBeNull();
    expect(p.medianaDias).not.toBe(0);
    expect(p.semPlano).toBe(12);
  });

  // ── Diário alimentar ─────────────────────────────────────────────────────
  it('uso do link: calcula sobre quem tem link ativo', async () => {
    const r = await service.indicadores('ws-1');
    expect((r.diario as BlocoDiario).usoDoLinkPct).toBe(50); // 3 de 6
  });

  it('uso do link: NULL quando ninguém tem link ativo', async () => {
    respostas.diario = [
      { pacientes_com_registro: 0, registros: 0, pacientes_com_link_ativo: 0 },
    ];
    const r = await service.indicadores('ws-1');
    expect((r.diario as BlocoDiario).usoDoLinkPct).toBeNull();
  });

  it('adesão ao plano é SEMPRE null: não existe medida honesta dela hoje', async () => {
    const r = await service.indicadores('ws-1');
    expect((r.diario as BlocoDiario).adesaoAoPlanoPct).toBeNull();
  });

  // ── Metas ────────────────────────────────────────────────────────────────
  it('metas: taxa de atingimento sobre o total', async () => {
    const r = await service.indicadores('ws-1');
    expect((r.metas as BlocoMetas).taxaAtingimentoPct).toBe(25); // 5 de 20
  });

  it('metas: NULL quando não há meta cadastrada', async () => {
    respostas.metas = [{ total: 0, atingidas: 0, abertas: 0, vencidas: 0 }];
    const r = await service.indicadores('ws-1');
    expect((r.metas as BlocoMetas).taxaAtingimentoPct).toBeNull();
  });

  // ── Financeiro ───────────────────────────────────────────────────────────
  it('inadimplência: vencido sobre o que já venceu', async () => {
    const r = await service.indicadores('ws-1');
    expect((r.financeiro as BlocoFinanceiro).inadimplenciaPct).toBe(25); // 25000 / 100000
  });

  it('inadimplência: o que ainda vai vencer não dilui o indicador', async () => {
    // Dez vezes mais a vencer. Como a base só conta vencimento passado, a
    // inadimplência tem de ficar igual — senão emitir cobrança nova "melhora"
    // o número sem ninguém pagar nada.
    respostas.financeiro = [
      {
        recebido_centavos: '150000',
        cobrancas_pagas: 10,
        a_vencer_centavos: '4000000',
        vencido_centavos: '25000',
        cobrancas_vencidas: 2,
        base_vencida_centavos: '100000',
      },
    ];
    const r = await service.indicadores('ws-1');
    expect((r.financeiro as BlocoFinanceiro).inadimplenciaPct).toBe(25);
  });

  it('inadimplência: NULL quando nada venceu ainda', async () => {
    respostas.financeiro = [
      {
        recebido_centavos: '0',
        cobrancas_pagas: 0,
        a_vencer_centavos: '50000',
        vencido_centavos: '0',
        cobrancas_vencidas: 0,
        base_vencida_centavos: '0',
      },
    ];
    const r = await service.indicadores('ws-1');
    const f = r.financeiro as BlocoFinanceiro;
    expect(f.inadimplenciaPct).toBeNull();
    expect(f.ticketMedioCentavos).toBeNull();
    expect(f.aVencerCentavos).toBe(50000);
  });

  it('ticket médio: só existe se alguma cobrança foi paga', async () => {
    const r = await service.indicadores('ws-1');
    expect((r.financeiro as BlocoFinanceiro).ticketMedioCentavos).toBe(15000);
  });

  it('valores em centavos vêm do banco como texto e viram inteiro', async () => {
    const r = await service.indicadores('ws-1');
    const f = r.financeiro as BlocoFinanceiro;
    expect(f.recebidoNoPeriodoCentavos).toBe(150000);
    expect(Number.isInteger(f.recebidoNoPeriodoCentavos)).toBe(true);
  });

  // ── Alertas ──────────────────────────────────────────────────────────────
  it('alertas: agrupa por categoria e preserva mediana nula', async () => {
    const r = await service.indicadores('ws-1');
    const a = r.alertas as { categorias: Array<Record<string, unknown>> };
    expect(a.categorias).toHaveLength(2);
    expect(a.categorias[0]).toEqual({
      categoria: 'interaction',
      total: 7,
      pendentes: 3,
      medianaHorasResolucao: 12.5,
    });
    // Categoria sem nenhum alerta resolvido: mediana é null, não 0.
    expect(a.categorias[1].medianaHorasResolucao).toBeNull();
  });

  it('alertas: lista vazia não quebra', async () => {
    respostas.alertas = [];
    const r = await service.indicadores('ws-1');
    expect((r.alertas as { categorias: unknown[] }).categorias).toEqual([]);
  });

  // ── Janela do período ────────────────────────────────────────────────────
  it('janela: padrão de 90 dias quando não vem nada', async () => {
    const r = await service.indicadores('ws-1');
    expect(r.periodo.dias).toBe(90);
    expect(r.periodo.diasAbandono).toBe(90);
  });

  it('janela: NaN cai no padrão em vez de virar consulta inválida', async () => {
    const r = await service.indicadores('ws-1', { dias: NaN });
    expect(r.periodo.dias).toBe(90);
  });

  it.each([
    [1, 7],
    [0, 7],
    [-30, 7],
    [9999, 365],
    [45, 45],
  ])('janela: %s dias é limitado a %s', async (pedido, esperado) => {
    const r = await service.indicadores('ws-1', { dias: pedido });
    expect(r.periodo.dias).toBe(esperado);
  });

  it('janela: o número limitado é o que vai para o SQL, não o pedido', async () => {
    await service.indicadores('ws-1', { dias: 9999 });
    const consulta = sqlRecebido.find((c) => qual(c.sql) === 'consultas');
    expect(consulta?.params).toContain(365);
    expect(consulta?.params).not.toContain(9999);
  });

  it('janela: de/até delimitam o período informado', async () => {
    const r = await service.indicadores('ws-1', { dias: 30 });
    const dias = (new Date(r.periodo.ate).getTime() - new Date(r.periodo.de).getTime()) / 86400_000;
    expect(Math.round(dias)).toBe(30);
  });

  // ── Isolamento de falha ──────────────────────────────────────────────────
  it('uma consulta que falha derruba só o próprio cartão', async () => {
    respostas.financeiro = new Error('relation "charges" does not exist');

    const r = await service.indicadores('ws-1');

    const f = r.financeiro as IndicadorFalho;
    expect(f.erro).toBe(true);
    expect(f.mensagem).toContain('financeiro');
    // os outros seis continuam inteiros
    expect((r.pacientes as BlocoPacientes).total).toBe(10);
    expect((r.consultas as BlocoConsultas).realizadas).toBe(40);
    expect((r.metas as BlocoMetas).total).toBe(20);
  });

  it('cartão que falhou NÃO vem com zeros disfarçados de dado', async () => {
    respostas.consultas = new Error('timeout');
    const r = await service.indicadores('ws-1');
    expect(r.consultas).toEqual({
      erro: true,
      mensagem: expect.stringContaining('consultas'),
    });
    expect(r.consultas).not.toHaveProperty('realizadas');
    expect(r.consultas).not.toHaveProperty('taxaFaltaPct');
  });

  it('todas falhando ainda devolve o período e sete cartões de erro', async () => {
    for (const k of Object.keys(respostas)) respostas[k] = new Error('banco fora');
    const r = await service.indicadores('ws-1');
    expect(r.periodo.dias).toBe(90);
    for (const bloco of ['pacientes', 'consultas', 'primeiroPlano', 'diario', 'metas', 'financeiro', 'alertas'] as const) {
      expect((r[bloco] as IndicadorFalho).erro).toBe(true);
    }
  });

  // ── Resposta vazia do banco ──────────────────────────────────────────────
  it('consulta que não devolve linha nenhuma não explode', async () => {
    respostas.pacientes = [];
    const r = await service.indicadores('ws-1');
    const p = r.pacientes as BlocoPacientes;
    expect(p.total).toBe(0);
    expect(p.emAbandono).toBe(0);
  });

  // ── Abandono ─────────────────────────────────────────────────────────────
  it('abandono usa a própria janela, separada da do período', async () => {
    await service.indicadores('ws-1', { dias: 30, diasAbandono: 120 });
    const consulta = sqlRecebido.find((c) => qual(c.sql) === 'pacientes');
    expect(consulta?.params).toEqual(['ws-1', 30, 120]);
  });

  it('abandono e nunca-atendidos são contagens separadas', async () => {
    const r = await service.indicadores('ws-1');
    const p = r.pacientes as BlocoPacientes;
    expect(p.emAbandono).toBe(3);
    expect(p.nuncaAtendidos).toBe(1);
  });
});
