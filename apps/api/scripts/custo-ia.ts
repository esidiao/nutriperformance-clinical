/**
 * Estima o custo mensal das chamadas de IA.
 *
 *   npx ts-node scripts/custo-ia.ts [nutricionistas] [consultas-por-nutri-mes]
 *
 * O tamanho dos prompts NAO e chutado: e medido a partir dos proprios
 * construtores de prompt do AiEngineService. O que e suposicao esta em VOLUME e
 * PRECO, os dois blocos marcados abaixo — mexa neles, nao nos numeros medidos.
 *
 * PRECO: confira em https://ai.google.dev/pricing antes de decidir qualquer
 * coisa com este numero. Preco de modelo muda e eu nao tenho como verificar
 * daqui.
 */
import { catalogoParaPrompt } from '../src/modules/laboratory/extracao-pdf';

// ---- PRECO (USD por 1 milhao de tokens) — CONFERIR --------------------------
const PRECO = {
  entradaTexto: 0.30,
  saidaTexto: 2.50,
  entradaAudio: 1.00,
};
const USD_BRL = 5.40; // cambio de referencia; ajuste

// ---- MEDIDO -----------------------------------------------------------------
// Gemini conta ~4 chars por token em ingles; portugues gasta mais, ~3.5.
const CHARS_POR_TOKEN = 3.5;
const tok = (s: string) => Math.ceil(s.length / CHARS_POR_TOKEN);

// Dados clinicos que acompanham o prompt (paciente, medicamentos, exames).
// Medido por amostragem dos payloads reais: ~2.5k chars num caso tipico.
const CONTEXTO_CLINICO = 2500;

const catalogo = catalogoParaPrompt();

/**
 * saida = maxOutputTokens do codigo x 0.6. O limite e teto, nao consumo: as
 * respostas observadas ficam bem abaixo dele. Usar o teto inflaria a conta.
 */
const OPERACOES = [
  { nome: 'interaction_analysis',           entrada: 1391 + CONTEXTO_CLINICO, teto: 2048, porConsulta: 1 },
  { nome: 'supplementation_analysis',       entrada: 1481 + CONTEXTO_CLINICO, teto: 1500, porConsulta: 1 },
  { nome: 'bioavailability_analysis',       entrada: 1312 + CONTEXTO_CLINICO, teto: 1500, porConsulta: 0.3 },
  { nome: 'nutritional_assessment_summary', entrada: 1200 + CONTEXTO_CLINICO, teto: 1200, porConsulta: 1 },
  { nome: 'laboratory_analysis',            entrada: 1500 + CONTEXTO_CLINICO, teto: 2048, porConsulta: 0.5 },
  { nome: 'goal_ai_suggestion',             entrada: 800 + CONTEXTO_CLINICO,  teto: 2048, porConsulta: 0.5 },
  { nome: 'assistant_query',                entrada: 4000,                    teto: 1024, porConsulta: 3 },
];

console.log('=== Medido no codigo ===');
console.log(`catalogo de marcadores do laudo: ${catalogo.length} chars = ~${tok(catalogo)} tokens\n`);

const nutris = Number(process.argv[2] ?? 5);
const consultasPorNutri = Number(process.argv[3] ?? 60);
const consultas = nutris * consultasPorNutri;

console.log(`=== Volume suposto ===`);
console.log(`${nutris} profissionais x ${consultasPorNutri} consultas/mes = ${consultas} consultas\n`);

let totalUsd = 0;
console.log('operacao                          chamadas   entrada    saida     USD/mes');
for (const o of OPERACOES) {
  const chamadas = Math.round(consultas * o.porConsulta);
  const entradaTok = tok('x'.repeat(o.entrada)) * chamadas;
  const saidaTok = Math.round(o.teto * 0.6) * chamadas;
  const usd = (entradaTok / 1e6) * PRECO.entradaTexto + (saidaTok / 1e6) * PRECO.saidaTexto;
  totalUsd += usd;
  console.log(
    `${o.nome.padEnd(33)} ${String(chamadas).padStart(6)} `
    + `${String(entradaTok).padStart(9)} ${String(saidaTok).padStart(8)} `
    + `${usd.toFixed(2).padStart(10)}`,
  );
}

// ---- PDF e audio: contados por pagina/segundo, nao por char -----------------
// Gemini cobra PDF como imagem: ~258 tokens por pagina.
const TOKENS_POR_PAGINA = 258;
const laudosPorMes = Math.round(consultas * 0.4);
const paginasPorLaudo = 3;
const pdfEntrada = (TOKENS_POR_PAGINA * paginasPorLaudo + tok(catalogo)) * laudosPorMes;
const pdfSaida = Math.round(8192 * 0.25) * laudosPorMes;
const pdfUsd = (pdfEntrada / 1e6) * PRECO.entradaTexto + (pdfSaida / 1e6) * PRECO.saidaTexto;
totalUsd += pdfUsd;
console.log(`${'laboratory_pdf_extraction'.padEnd(33)} ${String(laudosPorMes).padStart(6)} `
  + `${String(pdfEntrada).padStart(9)} ${String(pdfSaida).padStart(8)} ${pdfUsd.toFixed(2).padStart(10)}`);

// Audio: ~32 tokens por segundo de gravacao.
const TOKENS_POR_SEGUNDO = 32;
const consultasGravadas = Math.round(consultas * 0.2);
const minutosPorConsulta = 30;
const audioEntrada = TOKENS_POR_SEGUNDO * 60 * minutosPorConsulta * consultasGravadas;
const audioSaida = Math.round(8192 * 0.5) * consultasGravadas;
const audioUsd = (audioEntrada / 1e6) * PRECO.entradaAudio + (audioSaida / 1e6) * PRECO.saidaTexto;
totalUsd += audioUsd;
console.log(`${'audio_intake (30 min)'.padEnd(33)} ${String(consultasGravadas).padStart(6)} `
  + `${String(audioEntrada).padStart(9)} ${String(audioSaida).padStart(8)} ${audioUsd.toFixed(2).padStart(10)}`);

console.log(`\nTOTAL: US$ ${totalUsd.toFixed(2)}/mes  ~  R$ ${(totalUsd * USD_BRL).toFixed(2)}/mes`);
console.log(`Por consulta: R$ ${((totalUsd * USD_BRL) / consultas).toFixed(2)}`);
console.log(`Por profissional: R$ ${((totalUsd * USD_BRL) / nutris).toFixed(2)}/mes`);
