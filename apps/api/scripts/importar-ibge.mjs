// Importa a tabela de composicao e as medidas caseiras do IBGE (POF 2008-2009).
//
// COMO RODAR
//
//   node scripts/importar-ibge.mjs <ibge.json>             (ensaio, nao grava)
//   node scripts/importar-ibge.mjs <ibge.json> --aplicar   (grava)
//
// SEM `--aplicar` ELE NAO ESCREVE NADA. O ensaio imprime o que seria gravado,
// com contagens e amostras: escrever 1.972 alimentos e 11.802 medidas na base
// de producao sem ver antes e o tipo de operacao que so se descobre errada
// depois.
//
// DE ONDE VEM O ibge.json
//
// Dos dois arquivos publicos do IBGE, convertidos de .xls para JSON (Node nao
// le .xls sem dependencia nova, e o arquivo baixado e dado nao confiavel que
// nao deve passar perto do build):
//
//   https://ftp.ibge.gov.br/Orcamentos_Familiares/
//     Pesquisa_de_Orcamentos_Familiares_2008_2009/
//       Tabelas_de_Composicao_Nutricional_dos_Alimentos_Consumidos_no_Brasil/
//         tabelacompleta.zip
//       Tabela_de_Medidas_Referidas_para_os_Alimentos_Consumidos_no_Brasil/
//         tabelamedidas_bd.zip
//
// O proprio portal declara: "Todos os arquivos aqui disponiveis sao publicos".
//
// POR QUE A TACO CONTINUA
//
// Decisao do usuario: as duas tabelas convivem e a profissional escolhe. Elas
// discordam entre si para o mesmo alimento -- sao medicoes diferentes, de
// epocas e metodos diferentes -- e eleger uma vencedora seria decidir por ela
// uma questao tecnica. A coluna `fonte` separa as duas, e NENHUM alimento da
// TACO e tocado.
//
// IDEMPOTENTE
//
// A chave e `fonte_id_externo` dentro de `fonte = 'ibge_pof'`. Reexecutar
// atualiza em vez de duplicar. Para desfazer por inteiro:
//
//   DELETE FROM foods WHERE fonte = 'ibge_pof';   -- leva as medidas junto

import { readFileSync, existsSync } from 'node:fs';

const FONTE = 'ibge_pof';
const FONTE_VERSAO = 'IBGE, POF 2008-2009 — Tabela de Composição Nutricional '
  + 'dos Alimentos Consumidos no Brasil; Tabela de Medidas Referidas';
const LICENCA = 'IBGE — dado público. Citação: IBGE, Pesquisa de Orçamentos '
  + 'Familiares 2008-2009.';

const LOTE = 400;

// ── ambiente ────────────────────────────────────────────────────────────────

function carregarEnv(caminho) {
  if (!existsSync(caminho)) return;
  for (const l of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const URL_BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const H = {
  apikey: CHAVE,
  Authorization: `Bearer ${CHAVE}`,
  'Content-Type': 'application/json',
};

// ── indices de coluna, conferidos nos arquivos ──────────────────────────────

export const COL = {
  codigo: 0, alimento: 1, codPrep: 2, preparacao: 3, refDesc: 5,
  energia: 6, proteina: 7, lipidios: 8, carboidrato: 9, fibra: 10,
  calcio: 11, magnesio: 12, manganes: 13, fosforo: 14, ferro: 15,
  sodio: 16, sodioAdicao: 17, potassio: 18, cobre: 19, zinco: 20, selenio: 21,
  retinol: 22, vitaminaA: 23, tiamina: 24, riboflavina: 25, niacina: 26,
  niacinaEq: 27, piridoxina: 28, cobalamina: 29, folato: 30,
  vitaminaD: 31, vitaminaE: 32, vitaminaC: 33, colesterol: 34,
  saturados: 35, monoinsaturados: 36, poliinsaturados: 37,
  linoleico: 38, linolenico: 39, trans: 40, acucarTotal: 41, acucarAdicao: 42,
};

export const MED = { codigo: 0, codPrep: 2, medida: 5, medidaPadrao: 7, gramas: 8 };

// ── conversao ───────────────────────────────────────────────────────────────

/**
 * Numero, ou null. O conversor ja transformou "-" e vazio em null.
 *
 * Arredonda em 4 casas: a planilha traz 135.6229457071333 kcal, e as casas
 * alem da quarta sao ruido de ponto flutuante da propria planilha, nao
 * medicao. Guardadas, apareceriam numa exportacao que a profissional abrisse.
 */
export const numero = (v) =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);

const texto = (v) => String(v ?? '').trim();

/** Chave estavel do alimento: codigo mais preparacao. */
export const chaveExterna = (codigo, codPrep) =>
  `${Math.trunc(Number(codigo))}-${Math.trunc(Number(codPrep ?? 0))}`;

/** "ARROZ (POLIDO, PARBOILIZADO)" + "COZIDO(A)" -> nome legivel. */
export function montarNome(alimento, preparacao) {
  const base = texto(alimento);
  const prep = texto(preparacao);
  if (!prep || /^NAO SE APLICA$/i.test(prep)) return base;
  return `${base}, ${prep.toLowerCase()}`;
}

/**
 * Micronutrientes no jsonb, no formato que a base ja usa:
 * `{ chave: { valor, unidade } }`.
 *
 * Chave AUSENTE quando nao ha dado. E a distincao que sustenta o relatorio de
 * adequacao, onde ausente, zero e cobertura parcial sao tres coisas
 * diferentes: zero AFIRMA que o alimento nao fornece o nutriente.
 */
export function montarMicronutrientes(linha) {
  const mapa = {
    fosforo_mg: [COL.fosforo, 'mg'],
    manganes_mg: [COL.manganes, 'mg'],
    cobre_mg: [COL.cobre, 'mg'],
    selenio_mcg: [COL.selenio, 'mcg'],
    retinol_mcg: [COL.retinol, 'mcg'],
    vitamina_a_rae_mcg: [COL.vitaminaA, 'mcg'],
    tiamina_mg: [COL.tiamina, 'mg'],
    riboflavina_mg: [COL.riboflavina, 'mg'],
    niacina_mg: [COL.niacina, 'mg'],
    niacina_equivalente_mg: [COL.niacinaEq, 'mg'],
    piridoxina_mg: [COL.piridoxina, 'mg'],
    cobalamina_mcg: [COL.cobalamina, 'mcg'],
    folato_dfe_mcg: [COL.folato, 'mcg'],
    vitamina_d_mcg: [COL.vitaminaD, 'mcg'],
    vitamina_e_mg: [COL.vitaminaE, 'mg'],
    vitamina_c_mg: [COL.vitaminaC, 'mg'],
    colesterol_mg: [COL.colesterol, 'mg'],
    sodio_adicao_mg: [COL.sodioAdicao, 'mg'],
    acucar_total_g: [COL.acucarTotal, 'g'],
    acucar_adicao_g: [COL.acucarAdicao, 'g'],
    linoleico_g: [COL.linoleico, 'g'],
    linolenico_g: [COL.linolenico, 'g'],
    monoinsaturados_g: [COL.monoinsaturados, 'g'],
    poliinsaturados_g: [COL.poliinsaturados, 'g'],
  };
  const fora = {};
  for (const [chave, [idx, unidade]] of Object.entries(mapa)) {
    const v = numero(linha[idx]);
    if (v !== null) fora[chave] = { valor: v, unidade };
  }
  return fora;
}

export function montarAlimento(linha) {
  const codigo = numero(linha[COL.codigo]);
  if (codigo === null) return null;
  const nome = montarNome(linha[COL.alimento], linha[COL.preparacao]);
  if (!nome) return null;

  return {
    nome_padronizado: nome,
    // O IBGE nao publica grupo alimentar. A classificacao de troca e
    // derivada da composicao, entao isto nao impede substituicao.
    grupo_alimentar: null,
    energia_kcal: numero(linha[COL.energia]),
    proteinas_g: numero(linha[COL.proteina]),
    lipidios_g: numero(linha[COL.lipidios]),
    carboidratos_g: numero(linha[COL.carboidrato]),
    fibras_g: numero(linha[COL.fibra]),
    calcio_mg: numero(linha[COL.calcio]),
    magnesio_mg: numero(linha[COL.magnesio]),
    ferro_mg: numero(linha[COL.ferro]),
    sodio_mg: numero(linha[COL.sodio]),
    potassio_mg: numero(linha[COL.potassio]),
    zinco_mg: numero(linha[COL.zinco]),
    gordura_saturada_g: numero(linha[COL.saturados]),
    gordura_trans_g: numero(linha[COL.trans]),
    acucares_g: numero(linha[COL.acucarTotal]),
    vitaminas: montarMicronutrientes(linha),
    porcao_padrao_g: 100,
    ativo: true,
    fonte: FONTE,
    fonte_id_externo: chaveExterna(codigo, linha[COL.codPrep]),
    fonte_versao: FONTE_VERSAO,
    licenca: LICENCA,
    confiabilidade: 'alta',
    observacoes_clinicas: texto(linha[COL.refDesc])
      ? `Referência do IBGE: ${texto(linha[COL.refDesc])}`
      : null,
  };
}

/**
 * Medidas de um alimento.
 *
 * Na fonte, a coluna 5 e a medida que a pessoa relatou (colher de sopa,
 * concha, copo) e a coluna 8 e quanto pesa UMA unidade dela. A coluna 7 e a
 * medida de referencia daquele alimento: quando as duas coincidem, aquela e
 * a medida padrao, e e a que a tela oferece primeiro.
 */
/**
 * Unidades que a fonte traz mas que NAO sao medida caseira.
 *
 * "1 grama = 1 g" e "1 quilo = 1000 g" sao identidades: nao dizem nada sobre
 * o alimento. Conferi tambem o mililitro, que poderia carregar densidade --
 * nao carrega: vem 1 g para todos, inclusive para oleo e leite. Sao 4.029
 * das 11.801 linhas, e entrariam no seletor da tela empurrando para baixo a
 * colher de sopa e a concha, que sao as que o paciente usa.
 */
const UNIDADE_SEM_INFORMACAO = /^(grama|quilo|mililitro|litro)s?$/i;

export function montarMedida(linha) {
  const gramas = numero(linha[MED.gramas]);
  const medida = texto(linha[MED.medida]);
  if (gramas === null || gramas <= 0 || !medida) return null;
  if (UNIDADE_SEM_INFORMACAO.test(medida)) return null;
  return {
    chave: chaveExterna(linha[MED.codigo], linha[MED.codPrep]),
    medida: medida.toLowerCase(),
    gramas,
    padrao: texto(linha[MED.medida]) === texto(linha[MED.medidaPadrao]),
  };
}

// ── acesso ao banco ─────────────────────────────────────────────────────────

async function buscarExistentes() {
  const mapa = new Map();
  let de = 0;
  for (;;) {
    const r = await fetch(
      `${URL_BASE}/rest/v1/foods?select=id,fonte_id_externo&fonte=eq.${FONTE}`,
      { headers: { ...H, Range: `${de}-${de + 999}` } },
    );
    if (!r.ok) throw new Error(`leitura falhou: ${r.status} ${await r.text()}`);
    const linhas = await r.json();
    for (const f of linhas) mapa.set(f.fonte_id_externo, f.id);
    if (linhas.length < 1000) break;
    de += 1000;
  }
  return mapa;
}

async function enviarEmLotes(caminho, registros, metodo = 'POST', extra = {}) {
  let gravados = 0;
  for (let i = 0; i < registros.length; i += LOTE) {
    const lote = registros.slice(i, i + LOTE);
    const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
      method: metodo,
      headers: { ...H, Prefer: 'return=minimal', ...extra },
      body: JSON.stringify(lote),
    });
    if (!r.ok) {
      throw new Error(`lote ${i / LOTE + 1} falhou: ${r.status} ${await r.text()}`);
    }
    gravados += lote.length;
    process.stdout.write(`\r  gravados ${gravados}/${registros.length}`);
  }
  if (registros.length) process.stdout.write('\n');
  return gravados;
}

// ── principal ───────────────────────────────────────────────────────────────

async function principal() {
  const caminhoJson = process.argv[2];
  const aplicar = process.argv.includes('--aplicar');

  if (!caminhoJson) {
    console.error('Uso: node scripts/importar-ibge.mjs <ibge.json> [--aplicar]');
    process.exitCode = 1;
    return;
  }
  if (!URL_BASE || !CHAVE) {
    console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.');
    process.exitCode = 1;
    return;
  }

  const bruto = JSON.parse(readFileSync(caminhoJson, 'utf8'));

  const alimentos = [];
  const semCodigo = [];
  for (const linha of bruto.composicao) {
    const a = montarAlimento(linha);
    if (a) alimentos.push(a); else semCodigo.push(linha[COL.alimento]);
  }

  const medidas = [];
  const medidasInvalidas = [];
  for (const linha of bruto.medidas) {
    const m = montarMedida(linha);
    if (m) medidas.push(m); else medidasInvalidas.push(linha[MED.codigo]);
  }

  // Alimento nao tem duas vezes a mesma medida: a restricao UNIQUE no banco
  // rejeitaria o lote inteiro, entao a deduplicacao acontece aqui, onde da
  // para contar quantas eram.
  const vistas = new Set();
  const medidasUnicas = [];
  let duplicadas = 0;
  for (const m of medidas) {
    const k = `${m.chave}|${m.medida}`;
    if (vistas.has(k)) { duplicadas++; continue; }
    vistas.add(k);
    medidasUnicas.push(m);
  }

  const chavesAlimento = new Set(alimentos.map((a) => a.fonte_id_externo));
  const orfas = medidasUnicas.filter((m) => !chavesAlimento.has(m.chave));

  console.log('— composição —');
  console.log(`  linhas lidas:        ${bruto.composicao.length}`);
  console.log(`  alimentos montados:  ${alimentos.length}`);
  console.log(`  descartados:         ${semCodigo.length}`);
  const comMicro = alimentos.filter((a) => Object.keys(a.vitaminas).length).length;
  console.log(`  com micronutrientes: ${comMicro}`);

  console.log('\n— medidas caseiras —');
  console.log(`  linhas lidas:        ${bruto.medidas.length}`);
  console.log(`  válidas:             ${medidas.length}`);
  console.log(`  duplicadas (mesma medida no mesmo alimento): ${duplicadas}`);
  console.log(`  órfãs (sem alimento correspondente):         ${orfas.length}`);
  console.log(`  a gravar:            ${medidasUnicas.length - orfas.length}`);

  console.log('\n— amostra —');
  for (const a of alimentos.slice(0, 3)) {
    console.log(`  ${a.nome_padronizado}`);
    console.log(`    ${a.energia_kcal} kcal · ${Object.keys(a.vitaminas).length} micronutrientes`);
    const suas = medidasUnicas.filter((m) => m.chave === a.fonte_id_externo).slice(0, 4);
    for (const m of suas) {
      console.log(`    1 ${m.medida} = ${m.gramas} g${m.padrao ? '  (padrão)' : ''}`);
    }
  }

  if (!aplicar) {
    console.log('\nENSAIO. Nada foi gravado. Para gravar, acrescente --aplicar.');
    return;
  }

  console.log('\n— gravando —');
  const existentes = await buscarExistentes();
  console.log(`  já existem na base: ${existentes.size}`);

  const novos = alimentos.filter((a) => !existentes.has(a.fonte_id_externo));
  const atualizar = alimentos.filter((a) => existentes.has(a.fonte_id_externo));

  console.log(`  inserir: ${novos.length}   atualizar: ${atualizar.length}`);
  if (novos.length) await enviarEmLotes('foods', novos);

  for (const a of atualizar) {
    const id = existentes.get(a.fonte_id_externo);
    const r = await fetch(`${URL_BASE}/rest/v1/foods?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify(a),
    });
    if (!r.ok) throw new Error(`atualização falhou: ${r.status} ${await r.text()}`);
  }

  // Releitura: os ids dos recem-inseridos so existem depois de gravar.
  const idPorChave = await buscarExistentes();
  const aGravar = medidasUnicas
    .filter((m) => idPorChave.has(m.chave))
    .map((m) => ({
      food_id: idPorChave.get(m.chave),
      medida: m.medida,
      gramas: m.gramas,
      padrao: m.padrao,
      fonte: FONTE,
      fonte_versao: FONTE_VERSAO,
    }));

  console.log(`  medidas a gravar: ${aGravar.length}`);
  // merge-duplicates porque a restricao UNIQUE (food_id, medida) existe: uma
  // reexecucao atualiza a grama em vez de estourar o lote.
  await enviarEmLotes('food_measures', aGravar, 'POST', {
    Prefer: 'return=minimal,resolution=merge-duplicates',
  });

  console.log('\nPronto.');
}

// Só roda quando chamado direto; importado pelo teste, só expõe as funções.
if (process.argv[1] && process.argv[1].endsWith('importar-ibge.mjs')) {
  principal().catch((e) => {
    console.error('\nFALHOU:', e.message);
    process.exitCode = 1;
  });
}
